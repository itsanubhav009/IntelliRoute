const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const https = require('https');

// Try to load Supabase
let databaseClient;
try {
  databaseClient = require('../config/supabase');
  if (!databaseClient || typeof databaseClient.from !== 'function') {
    throw new Error('Supabase client not properly initialized');
  }
  console.log('Using Supabase database client for paths');
} catch (error) {
  console.error('Supabase error in paths, using fallback database:', error.message);
  databaseClient = require('./fallbackDb');
}

// All routes below require authentication
router.use(protect);

// Helper function: Artificial delay to slow down requests as requested
const addDelay = (ms = 2000) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Helper function: Make HTTPS request without external dependencies
const makeHttpRequest = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse response: ' + e.message));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
};

// Helper to get route from OpenStreetMap (OSRM)
const getOSRMRoute = async (source, destination) => {
  try {
    // Call the OSRM API
    const osrmURL = `https://router.project-osrm.org/route/v1/driving/${source.lng},${source.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
    
    console.log(`Fetching route from OSRM: ${osrmURL}`);
    const data = await makeHttpRequest(osrmURL);
    
    if (data.code !== 'Ok' || !data.routes || !data.routes[0]) {
      console.error('OSRM API error or no routes returned:', data);
      // Fallback to direct line if routing fails
      return `LINESTRING(${source.lng} ${source.lat}, ${destination.lng} ${destination.lat})`;
    }
    
    // Extract the coordinates from the route
    const coordinates = data.routes[0].geometry.coordinates;
    
    // Convert to WKT LINESTRING format
    const points = coordinates.map(point => `${point[0]} ${point[1]}`).join(', ');
    const wkt = `LINESTRING(${points})`;
    
    console.log(`Generated WKT route with ${coordinates.length} points`);
    return wkt;
  } catch (error) {
    console.error('Error fetching OSRM route:', error);
    // Fallback to direct line if routing fails
    return `LINESTRING(${source.lng} ${source.lat}, ${destination.lng} ${destination.lat})`;
  }
};

// Update user's location and set them as ONLINE
const updateUserLocationAndStatus = async (userId, source) => {
  if (typeof databaseClient.from !== 'function') {
    return;
  }
  
  try {
    const now = new Date().toISOString();
    console.log(`Updating location for user ${userId} to ${source.lat}, ${source.lng} at ${now}`);
    
    const { data, error } = await databaseClient
      .from('profiles')
      .update({
        latitude: source.lat,
        longitude: source.lng,
        last_active: now,
        status: 'online' // Set user as online
      })
      .eq('id', userId);
      
    if (error) {
      console.error('Error updating user location and status:', error);
    } else {
      console.log('User location and online status updated successfully');
    }
  } catch (error) {
    console.error('Exception updating user location and status:', error);
  }
};

// POST /api/path/set - Stores a path in database for the current user
router.post('/set', async (req, res) => {
  try {
    // Add artificial delay as requested
    await addDelay(2000);
    
    const userId = req.user.id;
    const { source, destination } = req.body;
    
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] User ${userId} requested to create a path:`, { source, destination });
    
    if (!source || !destination) {
      return res.status(400).json({ message: 'Source and Destination are required' });
    }

    // Update user's location and set them ONLINE
    await updateUserLocationAndStatus(userId, source);
    
    // Get the route from OpenStreetMap
    const routeWKT = await getOSRMRoute(source, destination);

    let pathData;
    let pathId = null;
    
    // Use the appropriate client
    if (typeof databaseClient.from === 'function') {
      // Using Supabase
      const { data, error } = await databaseClient
        .from('commute_routes')
        .insert([
          {
            user_id: userId,
            source_lat: source.lat,
            source_lng: source.lng,
            dest_lat: destination.lat,
            dest_lng: destination.lng,
            route_wkt: routeWKT
          }
        ])
        .select('id');
      
      if (error) {
        console.error('Database error inserting path:', error);
        return res.status(500).json({ message: 'Error inserting path', error });
      }
      
      pathData = data[0];
      if (pathData && pathData.id) {
        pathId = pathData.id;
        console.log(`Created path with ID: ${pathId}`);
      }
    } else {
      // Using fallback
      pathData = databaseClient.addRoute(userId, source, destination, routeWKT);
      if (pathData && pathData.id) {
        pathId = pathData.id;
        console.log(`Created path with ID: ${pathId} in fallback DB`);
      }
    }
    
    res.json({
      message: 'Path stored successfully',
      pathId: pathId,  // Changed from pathData?.id to pathId
      routeWKT
    });
  } catch (error) {
    console.error('Exception in path creation:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: error.message
    });
  }
});

// Helper function to check if two paths intersect
const doPathsIntersect = (path1, path2) => {
  try {
    // Parse LINESTRING format to arrays of points
    const getPoints = (pathStr) => {
      if (!pathStr || !pathStr.startsWith('LINESTRING')) return [];
      const coordsStr = pathStr.substring(pathStr.indexOf('(') + 1, pathStr.lastIndexOf(')'));
      return coordsStr.split(',').map(pair => {
        const [lng, lat] = pair.trim().split(' ').map(parseFloat);
        return [lng, lat];
      });
    };
    
    // Check if line segments intersect
    const segmentsIntersect = (p1, p2, p3, p4) => {
      // Line 1 represented as a1x + b1y = c1
      const a1 = p2[1] - p1[1];
      const b1 = p1[0] - p2[0];
      const c1 = a1 * p1[0] + b1 * p1[1];
      
      // Line 2 represented as a2x + b2y = c2
      const a2 = p4[1] - p3[1];
      const b2 = p3[0] - p4[0];
      const c2 = a2 * p3[0] + b2 * p3[1];
      
      const determinant = a1 * b2 - a2 * b1;
      
      if (determinant === 0) return false; // Parallel lines
      
      const x = (b2 * c1 - b1 * c2) / determinant;
      const y = (a1 * c2 - a2 * c1) / determinant;
      
      // Check if intersection point is within both line segments
      return (
        x >= Math.min(p1[0], p2[0]) && x <= Math.max(p1[0], p2[0]) &&
        y >= Math.min(p1[1], p2[1]) && y <= Math.max(p1[1], p2[1]) &&
        x >= Math.min(p3[0], p4[0]) && x <= Math.max(p3[0], p4[0]) &&
        y >= Math.min(p3[1], p4[1]) && y <= Math.max(p3[1], p4[1])
      );
    };
    
    const points1 = getPoints(path1);
    const points2 = getPoints(path2);
    
    if (points1.length < 2 || points2.length < 2) return false;
    
    // Check each segment in path1 against each segment in path2
    for (let i = 0; i < points1.length - 1; i++) {
      for (let j = 0; j < points2.length - 1; j++) {
        if (segmentsIntersect(points1[i], points1[i+1], points2[j], points2[j+1])) {
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking path intersection:', error);
    return false;
  }
};

// GET /api/path/live - Returns paths with intersection filtering
router.get('/live', async (req, res) => {
  try {
    // Add artificial delay as requested
    await addDelay(2000);
    
    const currentUserId = req.user.id;
    const { intersectOnly } = req.query;
    
    console.log(`Fetching paths for current user: ${currentUserId}`);
    console.log(`Intersection filter: ${intersectOnly ? 'On' : 'Off'}`);
    
    let pathsData = [];
    
    // Use the appropriate client
    if (typeof databaseClient.from === 'function') {
      // First, get the current user's most recent path for intersection checking
      let currentUserPath = null;
      
      if (intersectOnly === 'true') {
        const { data: userPath, error: userPathError } = await databaseClient
          .from('commute_routes')
          .select('id, route_wkt')
          .eq('user_id', currentUserId)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (userPathError) {
          console.error('Error fetching current user path:', userPathError);
        } else if (userPath && userPath.length > 0) {
          currentUserPath = userPath[0];
          console.log(`Found current user's path with ID ${currentUserPath.id}`);
        }
      }
      
      // Get all paths - we'll filter later
      const thirtyMinutesAgo = new Date();
      thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);
      
      // Get active user IDs
      const { data: activeUsers, error: userError } = await databaseClient
        .from('profiles')
        .select('id')
        .gt('last_active', thirtyMinutesAgo.toISOString());
        
      if (userError) {
        console.error('Error fetching active users:', userError);
      } else if (activeUsers && activeUsers.length > 0) {
        const activeUserIds = activeUsers.map(user => user.id);
        console.log(`Found ${activeUserIds.length} active users`);
        
        // Get paths for active users
        const { data: paths, error: pathsError } = await databaseClient
          .from('commute_routes')
          .select(`
            id,
            user_id,
            created_at,
            source_lat,
            source_lng,
            dest_lat,
            dest_lng,
            route_wkt
          `)
          .in('user_id', activeUserIds)
          .order('created_at', { ascending: false });
        
        if (pathsError) {
          console.error('Error fetching paths:', pathsError);
        } else if (paths && paths.length > 0) {
          console.log(`Found ${paths.length} total paths`);
          
          // Filter based on intersection if needed
          if (intersectOnly === 'true' && currentUserPath) {
            pathsData = paths.filter(path => {
              // Always include the current user's own paths
              if (path.user_id === currentUserId) return true;
              
              // For other users' paths, check for intersection
              return doPathsIntersect(currentUserPath.route_wkt, path.route_wkt);
            }).map(path => ({
              id: path.id,
              user_id: path.user_id,
              created_at: path.created_at,
              route: path.route_wkt,
              is_current_user: path.user_id === currentUserId,
              intersects_with_user: path.user_id !== currentUserId,
              source: {
                lat: path.source_lat,
                lng: path.source_lng
              },
              destination: {
                lat: path.dest_lat,
                lng: path.dest_lng
              }
            }));
            
            console.log(`Found ${pathsData.length} paths that intersect with user's path`);
          } else {
            // No filtering needed, include all paths
            pathsData = paths.map(path => ({
              id: path.id,
              user_id: path.user_id,
              created_at: path.created_at,
              route: path.route_wkt,
              is_current_user: path.user_id === currentUserId,
              source: {
                lat: path.source_lat,
                lng: path.source_lng
              },
              destination: {
                lat: path.dest_lat,
                lng: path.dest_lng
              }
            }));
          }
        }
      }
    } else {
      // Using fallback - in fallback mode, just get all paths
      pathsData = databaseClient.getLivePaths();
    }
    
    res.json({ 
      data: pathsData || [], 
      intersectionFilterActive: intersectOnly === 'true'
    });
  } catch (error) {
    console.error('Exception in paths fetch:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: error.message
    });
  }
});

module.exports = router;