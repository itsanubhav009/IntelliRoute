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
  console.log('[2025-04-10 11:38:53] Using Supabase database client for paths');
} catch (error) {
  console.error('[2025-04-10 11:38:53] Supabase error in paths, using fallback database:', error.message);
  databaseClient = require('./fallbackDb');
}

// All routes below require authentication
router.use(protect);

// Helper function: Artificial delay to slow down requests as requested
const addDelay = (ms = 2000) => {
  if (process.env.NODE_ENV === 'production') return Promise.resolve();
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
    
    console.log(`[2025-04-10 11:38:53] Fetching route from OSRM: ${osrmURL}`);
    const data = await makeHttpRequest(osrmURL);
    
    if (data.code !== 'Ok' || !data.routes || !data.routes[0]) {
      console.error('[2025-04-10 11:38:53] OSRM API error or no routes returned:', data);
      // Fallback to direct line if routing fails
      return `LINESTRING(${source.lng} ${source.lat}, ${destination.lng} ${destination.lat})`;
    }
    
    // Extract the coordinates from the route
    const coordinates = data.routes[0].geometry.coordinates;
    
    // Convert to WKT LINESTRING format
    const points = coordinates.map(point => `${point[0]} ${point[1]}`).join(', ');
    const wkt = `LINESTRING(${points})`;
    
    console.log(`[2025-04-10 11:38:53] Generated WKT route with ${coordinates.length} points`);
    return wkt;
  } catch (error) {
    console.error('[2025-04-10 11:38:53] Error fetching OSRM route:', error);
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
    console.log(`[2025-04-10 11:38:53] Updating location for user ${userId} to ${source.lat}, ${source.lng} at ${now}`);
    
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
      console.error('[2025-04-10 11:38:53] Error updating user location and status:', error);
    } else {
      console.log('[2025-04-10 11:38:53] User location and online status updated successfully');
    }
  } catch (error) {
    console.error('[2025-04-10 11:38:53] Exception updating user location and status:', error);
  }
};

// POST /api/path/set - Stores a path in database for the current user
router.post('/set', async (req, res) => {
  try {
    const startTime = new Date();
    const { isValid, missingFields } = validateUserData(req.user);
    if (!isValid) {
      console.error(`[2025-04-10 11:38:53] Missing user data: ${missingFields.join(', ')}`);
      return res.status(400).json({ 
        success: false,
        message: 'Your profile is incomplete. Please log out and log in again.' 
      });
    }
    
    const userId = req.user.id;
    const username = req.user.username; // Validated above
    const { source, destination } = req.body;
    
    console.log(`[2025-04-10 11:38:53] PATH-SET: Creating path for user ${userId} (${username})`);
    console.log(`[2025-04-10 11:38:53] PATH-SET: From ${source.lat},${source.lng} to ${destination.lat},${destination.lng}`);
    
    if (!source || !destination) {
      return res.status(400).json({ 
        success: false,
        message: 'Source and Destination are required' 
      });
    }

    // Update user's location and set them ONLINE
    await updateUserLocationAndStatus(userId, source);
    
    // Get the route from OpenStreetMap
    console.log(`[2025-04-10 11:38:53] PATH-SET: Fetching route from OSRM...`);
    const routeWKT = await getOSRMRoute(source, destination);
    console.log(`[2025-04-10 11:38:53] PATH-SET: Generated WKT route with ${routeWKT.split(',').length} points`);

    let pathId = null;
    
    // Use the appropriate client
    if (typeof databaseClient.from === 'function') {
      // FIRST: Delete all existing paths for this user
      console.log(`[2025-04-10 11:38:53] PATH-SET: Deleting existing paths for user ${userId}`);
      try {
        const { error: deleteError } = await databaseClient
          .from('commute_routes')
          .delete()
          .eq('user_id', userId);
        
        if (deleteError) {
          console.error('[2025-04-10 11:38:53] PATH-SET ERROR: Failed to delete existing paths:', deleteError);
          return res.status(500).json({ 
            success: false,
            message: 'Error clearing existing paths', 
            error: deleteError 
          });
        }
        console.log(`[2025-04-10 11:38:53] PATH-SET: Successfully deleted existing paths`);
      } catch (deleteError) {
        console.error(`[2025-04-10 11:38:53] PATH-SET ERROR: Exception deleting existing paths:`, deleteError);
        return res.status(500).json({ 
          success: false,
          message: 'Error clearing existing paths', 
          error: deleteError.message 
        });
      }
      
      // SECOND: Direct insert with detailed error handling
      console.log(`[2025-04-10 11:38:53] PATH-SET: Inserting new path...`);
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
        console.log(`[2025-04-10 11:38:53] PATH-SET: Insert data:`, {
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
          console.error('[2025-04-10 11:38:53] PATH-SET ERROR: Failed to insert path:', error);
          return res.status(500).json({ 
            success: false,
            message: 'Error inserting path', 
            error 
          });
        }
        
        if (data && data.length > 0) {
          pathId = data[0].id;
          console.log(`[2025-04-10 11:38:53] PATH-SET: Successfully created path with ID: ${pathId}`);
          console.log(`[2025-04-10 11:38:53] PATH-SET: New path details:`, data[0]);
          
          // THIRD: Try to update the geometry column
          try {
            console.log(`[2025-04-10 11:38:53] PATH-SET: Updating geometry for path ${pathId}...`);
            const { error: updateError } = await databaseClient.rpc(
              'update_geometry_for_path',
              { 
                path_id: pathId, 
                wkt_data: routeWKT
              }
            );
            
            if (updateError) {
              console.warn('[2025-04-10 11:38:53] PATH-SET WARNING: Could not update geometry column:', updateError);
              console.log('[2025-04-10 11:38:53] PATH-SET: Path saved without geometry column, spatial queries may not work');
            } else {
              console.log('[2025-04-10 11:38:53] PATH-SET: Successfully updated geometry column');
            }
          } catch (geomError) {
            console.warn('[2025-04-10 11:38:53] PATH-SET WARNING: Exception updating geometry:', geomError);
            console.log('[2025-04-10 11:38:53] PATH-SET: Path saved without geometry column, spatial queries may not work');
          } 
        } else {
          console.log(`[2025-04-10 11:38:53] PATH-SET WARNING: Insert returned no data`);
        }
      } catch (insertError) {
        console.error(`[2025-04-10 11:38:53] PATH-SET ERROR: Exception inserting path:`, insertError);
        return res.status(500).json({ 
          success: false,
          message: 'Error inserting path', 
          error: insertError.message 
        });
      }
    } else {
      // Using fallback database
      console.log(`[2025-04-10 11:38:53] PATH-SET: Using fallback database`);
      databaseClient.deleteUserRoutes(userId);
      console.log(`[2025-04-10 11:38:53] PATH-SET: Deleted existing paths for user ${userId} in fallback DB`);
      
      const pathData = databaseClient.addRoute(userId, source, destination, routeWKT);
      if (pathData && pathData.id) {
        pathId = pathData.id;
        console.log(`[2025-04-10 11:38:53] PATH-SET: Created path with ID: ${pathId} in fallback DB`);
      }
    }
    
    const endTime = new Date();
    const duration = endTime - startTime;
    console.log(`[2025-04-10 11:38:53] PATH-SET: Request completed in ${duration}ms`);
    
    res.json({
      success: true,
      message: 'Path stored successfully',
      pathId: pathId,
      routeWKT: routeWKT.substring(0, 100) + '...' // Truncate for response size
    });
  } catch (error) {
    console.error('[2025-04-10 11:38:53] PATH-SET ERROR: Exception in path creation:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error', 
      error: error.message
    });
  }
});

// GET /api/path/live - Returns ONLY current user's path and users along it
router.get('/live', async (req, res) => {
  const startTime = new Date();
  try {
    // Add artificial delay as requested
    await addDelay(1500);

    // Validate user data first
    const { isValid, missingFields } = validateUserData(req.user);
    if (!isValid) {
      console.error(`[2025-04-10 11:38:53] PATH-LIVE ERROR: Missing user data: ${missingFields.join(', ')}`);
      return res.status(400).json({ 
        success: false,
        message: 'Your profile is incomplete. Please log out and log in again.' 
      });
    }

    const currentUserId = req.user.id;
    const username = req.user.username; // Validated above
    
    // Parse query parameters
    const { proximityRadius = '500', intersectOnly = 'false' } = req.query;
    const radiusValue = parseFloat(proximityRadius);
    
    // We're ignoring intersectOnly parameter as per your request - only showing current user's path
    console.log(`[2025-04-10 11:38:53] PATH-LIVE: Request from user ${username} (${currentUserId})`);
    console.log(`[2025-04-10 11:38:53] PATH-LIVE: Looking for user's path with proximity radius ${radiusValue}m`);
    
    let currentUserPath = null;
    let usersAlongPath = [];
    
    // Try using Supabase if available
    if (databaseClient && typeof databaseClient.from === 'function') {
      try {
        // STEP 1: Get ONLY the current user's path
        const { data: pathData, error: pathError } = await databaseClient
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
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (pathError) {
          console.error(`[2025-04-10 11:38:53] PATH-LIVE ERROR: Failed to fetch path:`, pathError);
          throw pathError;
        }
        
        if (!pathData || pathData.length === 0) {
          console.log(`[2025-04-10 11:38:53] PATH-LIVE: No path found for user ${username} (${currentUserId})`);
          
          // No path found - return empty data
          return res.json({
            success: true,
            status: 'no_path',
            message: 'No path found for current user. Create a route first.',
            data: [],
            usersAlongPath: [],
            proximityRadius: radiusValue,
            timestamp: new Date().toISOString()
          });
        }
        
        // Found a path - format it for the frontend
        currentUserPath = {
          id: pathData[0].id,
          user_id: pathData[0].user_id,
          username: 'You', // Always "You" for current user's path
          created_at: pathData[0].created_at,
          route: pathData[0].route_wkt,
          source: {
            lat: pathData[0].source_lat,
            lng: pathData[0].source_lng
          },
          destination: {
            lat: pathData[0].dest_lat,
            lng: pathData[0].dest_lng
          }
        };
        
        console.log(`[2025-04-10 11:38:53] PATH-LIVE: Found user's path ID: ${currentUserPath.id}`);
        
        // STEP 2: Find users along this path using PostGIS
        try {
          console.log(`[2025-04-10 11:38:53] PATH-LIVE: Finding users along path ${currentUserPath.id} with radius ${radiusValue}m`);
          
          // Call the stored procedure to find users along path
          const { data: usersData, error: usersError } = await databaseClient.rpc(
            'find_users_along_path',
            { 
              path_id: currentUserPath.id,
              distance_meters: radiusValue,
              exclude_user_id: currentUserId
            }
          );
          
          if (usersError) {
            console.error(`[2025-04-10 11:38:53] PATH-LIVE ERROR: Failed to find users along path:`, usersError);
            // Continue with empty users - not a critical error
          } else if (usersData && usersData.length > 0) {
            console.log(`[2025-04-10 11:38:53] PATH-LIVE: Found ${usersData.length} users along the path`);
            usersAlongPath = usersData;
          } else {
            console.log(`[2025-04-10 11:38:53] PATH-LIVE: No users found along the path`);
          }
        } catch (usersError) {
          console.error(`[2025-04-10 11:38:53] PATH-LIVE ERROR: Exception finding users along path:`, usersError);
          // Continue with empty users - not a critical error
        }
      } catch (dbError) {
        console.error(`[2025-04-10 11:38:53] PATH-LIVE ERROR: Database error:`, dbError);
        throw dbError;
      }
    } else {
      // Fallback for memory database
      console.log(`[2025-04-10 11:38:53] PATH-LIVE: Using fallback database`);
      
      try {
        // In memory implementation - should only return current user's path
        const path = databaseClient.getUserRoute(currentUserId);
        if (path) {
          currentUserPath = {
            id: path.id,
            user_id: path.user_id,
            username: 'You',
            created_at: path.created_at,
            route: path.route_wkt,
            source: path.source,
            destination: path.destination
          };
          
          // Find nearby users
          usersAlongPath = databaseClient.getUsersNearPath(path.id, radiusValue, currentUserId);
        }
      } catch (memoryError) {
        console.error(`[2025-04-10 11:38:53] PATH-LIVE ERROR: Memory DB error:`, memoryError);
      }
    }
    
    // Prepare result - ONLY current user's path and users along it
    const result = {
      success: true,
      status: 'success',
      data: currentUserPath ? [currentUserPath] : [], // Return array with ONLY the current user's path
      usersAlongPath: usersAlongPath || [],
      proximityRadius: radiusValue,
      timestamp: new Date().toISOString()
    };
    
    const endTime = new Date();
    const duration = endTime - startTime;
    console.log(`[2025-04-10 11:38:53] PATH-LIVE: Request completed in ${duration}ms`);
    console.log(`[2025-04-10 11:38:53] PATH-LIVE: Returning 1 path and ${usersAlongPath.length} users along path`);
    
    return res.json(result);
  } catch (error) {
    console.error(`[2025-04-10 11:38:53] PATH-LIVE ERROR: Unhandled exception:`, error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Helper function to validate user has required fields
const validateUserData = (user, requiredFields = ['id', 'username']) => {
  if (!user) return { isValid: false, missingFields: ['user object'] };
  
  const missingFields = requiredFields.filter(field => {
    return !user[field];
  });
  
  return {
    isValid: missingFields.length === 0,
    missingFields
  };
};

module.exports = router;