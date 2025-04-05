const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const https = require('https');
// At the beginning of your pathRoutes.js file
// This should come BEFORE any route definitions
router.use(protect);
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
      console.log(`Created path with ID: ${pathData.id}`);
    } else {
      // Using fallback
      pathData = databaseClient.addRoute(userId, source, destination, routeWKT);
      console.log(`Created path with ID: ${pathData.id} in fallback DB`);
    }
    
    res.json({
      message: 'Path stored successfully',
      pathId: pathData?.id,
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

// GET /api/path/live - Returns paths ONLY for ONLINE users
// GET /api/path/live - Returns paths for active users
router.get('/live', async (req, res) => {
  try {
    // Add artificial delay as requested
    await addDelay(2000);
    
    const currentUserId = req.user?.id;
    console.log(`Fetching paths for current user: ${currentUserId}`);
    
    let pathsData = [];
    
    // Use the appropriate client
    if (typeof databaseClient.from === 'function') {
      // UPDATED QUERY: Use a wider time window (30 minutes)
      // or include current user's ID directly
      const thirtyMinutesAgo = new Date();
      thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);
      
      // First try to get all paths for the current user
      const { data: userPaths, error: userPathsError } = await databaseClient
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
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false });
      
      if (userPathsError) {
        console.error('Error fetching user paths:', userPathsError);
      } else if (userPaths && userPaths.length > 0) {
        // We found paths for the current user
        pathsData = userPaths.map(path => ({
          id: path.id,
          user_id: path.user_id,
          created_at: path.created_at,
          route: path.route_wkt,
          source: {
            lat: path.source_lat,
            lng: path.source_lng
          },
          destination: {
            lat: path.dest_lat,
            lng: path.dest_lng
          }
        }));
        
        console.log(`Found ${pathsData.length} paths for current user`);
      } else {
        console.log('No paths found for current user, getting recent paths');
        
        // Get active user profiles
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
            pathsData = paths.map(path => ({
              id: path.id,
              user_id: path.user_id,
              created_at: path.created_at,
              route: path.route_wkt,
              source: {
                lat: path.source_lat,
                lng: path.source_lng
              },
              destination: {
                lat: path.dest_lat,
                lng: path.dest_lng
              }
            }));
            
            console.log(`Found ${pathsData.length} paths for active users`);
          }
        }
      }
    } else {
      // Using fallback - in fallback mode, just get all paths
      pathsData = databaseClient.getLivePaths();
    }
    
    res.json({ data: pathsData || [] });
  } catch (error) {
    console.error('Exception in paths fetch:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: error.message
    });
  }
});
// Add these new functions to your pathRoutes.js file

// Helper function to check if two line segments intersect
const doLineSegmentsIntersect = (line1Start, line1End, line2Start, line2End) => {
  // Line 1 represented as a1x + b1y = c1
  const a1 = line1End[1] - line1Start[1];
  const b1 = line1Start[0] - line1End[0];
  const c1 = a1 * line1Start[0] + b1 * line1Start[1];
  
  // Line 2 represented as a2x + b2y = c2
  const a2 = line2End[1] - line2Start[1];
  const b2 = line2Start[0] - line2End[0];
  const c2 = a2 * line2Start[0] + b2 * line2Start[1];
  
  const determinant = a1 * b2 - a2 * b1;
  
  if (determinant === 0) {
    // Lines are parallel
    return false;
  } else {
    const x = (b2 * c1 - b1 * c2) / determinant;
    const y = (a1 * c2 - a2 * c1) / determinant;
    
    // Check if intersection point is within both line segments
    return (
      (x >= Math.min(line1Start[0], line1End[0]) && x <= Math.max(line1Start[0], line1End[0])) &&
      (y >= Math.min(line1Start[1], line1End[1]) && y <= Math.max(line1Start[1], line1End[1])) &&
      (x >= Math.min(line2Start[0], line2End[0]) && x <= Math.max(line2Start[0], line2End[0])) &&
      (y >= Math.min(line2Start[1], line2End[1]) && y <= Math.max(line2Start[1], line2End[1]))
    );
  }
};

// Helper to parse WKT LINESTRING format
const parseWKTLineString = (wkt) => {
  if (!wkt || !wkt.startsWith('LINESTRING')) return [];
  
  try {
    const coordsStr = wkt.substring(wkt.indexOf('(') + 1, wkt.lastIndexOf(')'));
    return coordsStr.split(',').map(pair => {
      const [lng, lat] = pair.trim().split(' ').map(parseFloat);
      return [lng, lat]; // Return as [lng, lat]
    });
  } catch (e) {
    console.error('Error parsing WKT:', e);
    return [];
  }
};

// Helper to check if two paths intersect
const doPathsIntersect = (path1WKT, path2WKT) => {
  const path1Points = parseWKTLineString(path1WKT);
  const path2Points = parseWKTLineString(path2WKT);
  
  if (path1Points.length < 2 || path2Points.length < 2) {
    return false; // Not enough points for intersection
  }
  
  // Check each line segment in path1 against each line segment in path2
  for (let i = 0; i < path1Points.length - 1; i++) {
    const line1Start = path1Points[i];
    const line1End = path1Points[i + 1];
    
    for (let j = 0; j < path2Points.length - 1; j++) {
      const line2Start = path2Points[j];
      const line2End = path2Points[j + 1];
      
      if (doLineSegmentsIntersect(line1Start, line1End, line2Start, line2End)) {
        return true; // Intersection found
      }
    }
  }
  
  return false; // No intersections found
};

// Update the /path/live GET endpoint to handle intersection filtering
router.get('/live', async (req, res) => {
  try {
    // Add artificial delay as requested
    await addDelay(2000);
    
    const currentUserId = req.user?.id;
    const { intersectOnly } = req.query; // New query parameter
    
    console.log(`Fetching paths for current user: ${currentUserId}`);
    console.log(`Intersection filter: ${intersectOnly ? 'On' : 'Off'}`);
    
    let pathsData = [];
    let userPath = null; // Will store the current user's path if intersectOnly is true
    
    // Use the appropriate client
    if (typeof databaseClient.from === 'function') {
      // Get the current user's most recent path if we're doing intersection filtering
      if (intersectOnly === 'true' && currentUserId) {
        const { data: currentUserPath, error: userPathError } = await databaseClient
          .from('commute_routes')
          .select('id, route_wkt')
          .eq('user_id', currentUserId)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (userPathError) {
          console.error('Error fetching current user path:', userPathError);
        } else if (currentUserPath && currentUserPath.length > 0) {
          userPath = currentUserPath[0];
          console.log(`Found current user's path with ID ${userPath.id}`);
        } else {
          console.log('No path found for current user');
        }
      }
      
      // Get active user profiles within 30 minutes
      const thirtyMinutesAgo = new Date();
      thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);
      
      const { data: activeUsers, error: userError } = await databaseClient
        .from('profiles')
        .select('id')
        .gt('last_active', thirtyMinutesAgo.toISOString());
        
      if (userError) {
        console.error('Error fetching active users:', userError);
      } else if (activeUsers && activeUsers.length > 0) {
        const activeUserIds = activeUsers.map(user => user.id);
        
        // Exclude current user if we're doing intersection filtering
        const pathQueryUserIds = intersectOnly === 'true' && userPath ? 
          activeUserIds.filter(id => id !== currentUserId) : 
          activeUserIds;
          
        console.log(`Found ${pathQueryUserIds.length} active users for path query`);
        
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
          .in('user_id', pathQueryUserIds)
          .order('created_at', { ascending: false });
        
        if (pathsError) {
          console.error('Error fetching paths:', pathsError);
        } else if (paths && paths.length > 0) {
          // If we need to filter by intersection
          if (intersectOnly === 'true' && userPath) {
            const intersectingPaths = paths.filter(path => 
              path.user_id === currentUserId || doPathsIntersect(userPath.route_wkt, path.route_wkt)
            );
            
            console.log(`Found ${intersectingPaths.length} intersecting paths out of ${paths.length} total`);
            
            pathsData = intersectingPaths.map(path => ({
              id: path.id,
              user_id: path.user_id,
              created_at: path.created_at,
              route: path.route_wkt,
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
          } else {
            // Return all paths
            pathsData = paths.map(path => ({
              id: path.id,
              user_id: path.user_id,
              created_at: path.created_at,
              route: path.route_wkt,
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
      intersectionFilterActive: intersectOnly === 'true' && userPath !== null
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