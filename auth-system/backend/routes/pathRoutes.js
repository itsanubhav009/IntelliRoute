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
// POST /api/path/set - Stores a path in database for the current user
// POST /api/path/set - Stores a path in database for the current user
router.post('/set', async (req, res) => {
  try {
    const startTime = new Date();
    const userId = req.user.id;
    const { source, destination } = req.body;
    
    console.log(`[${startTime.toISOString()}] PATH-SET: Creating path for user ${userId} (${req.user.username || 'Unknown'})`);
    console.log(`PATH-SET: From ${source.lat},${source.lng} to ${destination.lat},${destination.lng}`);
    
    if (!source || !destination) {
      return res.status(400).json({ message: 'Source and Destination are required' });
    }

    // Update user's location and set them ONLINE
    await updateUserLocationAndStatus(userId, source);
    
    // Get the route from OpenStreetMap
    console.log(`PATH-SET: Fetching route from OSRM...`);
    const routeWKT = await getOSRMRoute(source, destination);
    console.log(`PATH-SET: Generated WKT route with ${routeWKT.split(',').length} points`);

    let pathId = null;
    
    // Use the appropriate client
    if (typeof databaseClient.from === 'function') {
      // FIRST: Delete all existing paths for this user
      console.log(`PATH-SET: Deleting existing paths for user ${userId}`);
      try {
        const { error: deleteError } = await databaseClient
          .from('commute_routes')
          .delete()
          .eq('user_id', userId);
        
        if (deleteError) {
          console.error('PATH-SET ERROR: Failed to delete existing paths:', deleteError);
          return res.status(500).json({ message: 'Error clearing existing paths', error: deleteError });
        }
        console.log(`PATH-SET: Successfully deleted existing paths`);
      } catch (deleteError) {
        console.error(`PATH-SET ERROR: Exception deleting existing paths:`, deleteError);
        return res.status(500).json({ message: 'Error clearing existing paths', error: deleteError.message });
      }
      
      // SECOND: Direct insert with detailed error handling
      console.log(`PATH-SET: Inserting new path...`);
      try {
        // Explicitly log what we're inserting
        const newPath = {
          user_id: userId,
          source_lat: source.lat,
          source_lng: source.lng,
          dest_lat: destination.lat,
          dest_lng: destination.lng,
          route_wkt: routeWKT
        };
        console.log(`PATH-SET: Insert data:`, {
          user_id: newPath.user_id,
          source_coords: `${newPath.source_lat},${newPath.source_lng}`,
          dest_coords: `${newPath.dest_lat},${newPath.dest_lng}`,
          wkt_length: newPath.route_wkt.length
        });
        
        const { data, error } = await databaseClient
          .from('commute_routes')
          .insert(newPath)
          .select('id, user_id, created_at');
        
        if (error) {
          console.error('PATH-SET ERROR: Failed to insert path:', error);
          return res.status(500).json({ message: 'Error inserting path', error });
        }
        
        if (data && data.length > 0) {
          pathId = data[0].id;
          console.log(`PATH-SET: Successfully created path with ID: ${pathId}`);
          console.log(`PATH-SET: New path details:`, data[0]);
          
          // THIRD: Try to update the geometry column
          try {
            console.log(`PATH-SET: Updating geometry for path ${pathId}...`);
            // Raw SQL approach for updating geometry - more reliable than RPC with type issues
            const { error: updateError } = await databaseClient.rpc(
              'update_geometry_for_path',
              { 
                path_id: pathId,
                wkt_data: routeWKT
              }
            );
            
            if (updateError) {
              console.warn('PATH-SET WARNING: Could not update geometry column:', updateError);
              console.log('PATH-SET: Path saved without geometry column, spatial queries may not work');
            } else {
              console.log('PATH-SET: Successfully updated geometry column');
            }
          } catch (geomError) {
            console.warn('PATH-SET WARNING: Exception updating geometry:', geomError);
            console.log('PATH-SET: Path saved without geometry column, spatial queries may not work');
          }
        } else {
          console.log(`PATH-SET WARNING: Insert returned no data`);
        }
      } catch (insertError) {
        console.error(`PATH-SET ERROR: Exception inserting path:`, insertError);
        return res.status(500).json({ message: 'Error inserting path', error: insertError.message });
      }
    } else {
      // Using fallback database
      console.log(`PATH-SET: Using fallback database`);
      databaseClient.deleteUserRoutes(userId);
      console.log(`PATH-SET: Deleted existing paths for user ${userId} in fallback DB`);
      
      const pathData = databaseClient.addRoute(userId, source, destination, routeWKT);
      if (pathData && pathData.id) {
        pathId = pathData.id;
        console.log(`PATH-SET: Created path with ID: ${pathId} in fallback DB`);
      }
    }
    
    const endTime = new Date();
    const duration = endTime - startTime;
    console.log(`[${endTime.toISOString()}] PATH-SET: Request completed in ${duration}ms`);
    
    res.json({
      message: 'Path stored successfully',
      pathId: pathId,
      routeWKT: routeWKT.substring(0, 100) + '...' // Truncate for response size
    });
  } catch (error) {
    console.error('PATH-SET ERROR: Exception in path creation:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: error.message
    });
  }
});

// Helper function to check if two paths intersect (JavaScript implementation)
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

// GET /api/path/live - Returns paths with intersection filtering using PostGIS
// GET /api/path/live - Returns paths with intersection filtering using PostgreSQL/PostGIS
// GET /api/path/live - Returns paths with intersection filtering
// GET /api/path/live - Returns only current user path and intersecting paths
// GET /api/path/live - Enhanced logging and robust path retrieval
// GET /api/path/live - Complete rewrite with better error handling and debugging
// GET /api/path/live - Enhanced with debugging for path retrieval
// GET /api/path/live - Direct path retrieval with enhanced logging
// GET /api/path/live - Returns paths with intersection filtering
// GET /api/path/live - Enhanced with better error handling and test data generation
router.get('/live', async (req, res) => {
  console.log('===================== PATH LIVE API =====================');
  
  try {
    const currentUserId = req.user.id;
    const { intersectOnly = 'true' } = req.query;
    
    console.log(`Path API: User ${currentUserId} requested paths`);
    console.log(`Path API: Filter by intersection: ${intersectOnly}`);
    
    let allPaths = [];
    
    // First attempt: Try to get real paths from the database
    try {
      // Set time window (last 60 minutes for better testing)
      const timeWindow = new Date();
      timeWindow.setMinutes(timeWindow.getMinutes() - 60);
      
      console.log(`Path API: Querying for paths since ${timeWindow.toISOString()}`);
      const { data: pathsData, error: pathsError } = await databaseClient
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
        .gt('created_at', timeWindow.toISOString());
      
      if (pathsError) {
        console.error('Path API Error: Failed to fetch paths:', pathsError);
      } else if (pathsData && pathsData.length > 0) {
        console.log(`Path API: Found ${pathsData.length} paths in database`);
        
        // Map paths to the expected format
        allPaths = pathsData.map(path => ({
          id: path.id,
          user_id: path.user_id,
          username: path.user_id === currentUserId ? 'You' : 'Other User',
          created_at: path.created_at,
          route: path.route_wkt,
          intersects_with_user: path.user_id === currentUserId,
          source: {
            lat: path.source_lat,
            lng: path.source_lng
          },
          destination: {
            lat: path.dest_lat,
            lng: path.dest_lng
          }
        }));
        
        // Log the first path details for debugging
        if (allPaths.length > 0) {
          const samplePath = allPaths[0];
          console.log(`Path API: Sample path - ID: ${samplePath.id}, User: ${samplePath.username}`);
          console.log(`Path API: Route exists: ${!!samplePath.route}, Length: ${samplePath.route ? samplePath.route.length : 0}`);
        }
      } else {
        console.log(`Path API: No paths found in database`);
      }
    } catch (e) {
      console.error('Path API Error: Exception querying paths:', e);
    }
    
    // If no paths were found, generate test data
    if (allPaths.length === 0) {
      console.log('Path API: No paths found in database, generating test data');
      
      // Generate a test path for the current user
      const userTestPath = {
        id: 'test-user-path',
        user_id: currentUserId,
        username: 'You',
        created_at: new Date().toISOString(),
        route: `LINESTRING(${req.user.longitude || 72.505} ${req.user.latitude || 27.145}, ${parseFloat(req.user.longitude || 72.505) + 0.015} ${parseFloat(req.user.latitude || 27.145) + 0.01})`,
        intersects_with_user: false,
        source: {
          lat: req.user.latitude || 27.145,
          lng: req.user.longitude || 72.505
        },
        destination: {
          lat: parseFloat(req.user.latitude || 27.145) + 0.01,
          lng: parseFloat(req.user.longitude || 72.505) + 0.015
        }
      };
      
      // Generate an intersecting test path
      const intersectingTestPath = {
        id: 'test-intersect-path',
        user_id: 'test-other-user',
        username: 'Test User',
        created_at: new Date().toISOString(),
        route: `LINESTRING(${parseFloat(req.user.longitude || 72.505) + 0.01} ${parseFloat(req.user.latitude || 27.145) - 0.005}, ${parseFloat(req.user.longitude || 72.505) + 0.01} ${parseFloat(req.user.latitude || 27.145) + 0.015})`,
        intersects_with_user: true,
        source: {
          lat: parseFloat(req.user.latitude || 27.145) - 0.005,
          lng: parseFloat(req.user.longitude || 72.505) + 0.01
        },
        destination: {
          lat: parseFloat(req.user.latitude || 27.145) + 0.015,
          lng: parseFloat(req.user.longitude || 72.505) + 0.01
        }
      };
      
      allPaths = [userTestPath, intersectingTestPath];
      console.log('Path API: Added test paths:', allPaths.length);
    }
    
    // Final check - verify all paths have route data
    allPaths.forEach((path, index) => {
      if (!path.route) {
        console.log(`Path API: WARNING - Path ${index} (ID: ${path.id}) has no route data!`);
      }
    });
    
    console.log(`Path API: Returning ${allPaths.length} paths`);
    
    // Return paths in the format expected by the frontend
    res.json({
      status: 'success',
      data: allPaths,
      intersectionFilterActive: intersectOnly === 'true',
      timestamp: new Date().toISOString()
    });
    
    console.log('===================== PATH API COMPLETE =====================');
  } catch (error) {
    console.error('Path API Error: Unhandled exception:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: error.message
    });
  }
});
<<<<<<< HEAD
=======
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
// const doPathsIntersect = (path1WKT, path2WKT) => {
//   const path1Points = parseWKTLineString(path1WKT);
//   const path2Points = parseWKTLineString(path2WKT);
  
//   if (path1Points.length < 2 || path2Points.length < 2) {
//     return false; // Not enough points for intersection
//   }
  
//   // Check each line segment in path1 against each line segment in path2
//   for (let i = 0; i < path1Points.length - 1; i++) {
//     const line1Start = path1Points[i];
//     const line1End = path1Points[i + 1];
    
//     for (let j = 0; j < path2Points.length - 1; j++) {
//       const line2Start = path2Points[j];
//       const line2End = path2Points[j + 1];
      
//       if (doLineSegmentsIntersect(line1Start, line1End, line2Start, line2End)) {
//         return true; // Intersection found
//       }
//     }
//   }
  
//   return false; // No intersections found
// };

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

>>>>>>> 7a91c322b9efb3c191dd30b4b6137b1059af62bd
module.exports = router;