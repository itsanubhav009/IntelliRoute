const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// Try to load Supabase, fallback to memory DB if issues
let databaseClient;
try {
  databaseClient = require('../config/supabase');
  if (!databaseClient || typeof databaseClient.from !== 'function') {
    throw new Error('Supabase client not properly initialized');
  }
  console.log('[2025-04-10 13:10:23] Using Supabase database client for locations');
} catch (error) {
  console.error('[2025-04-10 13:10:23] Supabase error in locations, using fallback database:', error.message);
  databaseClient = require('./fallbackDb');
}

// Simple cache for path users to prevent duplicate database queries
const pathUserCache = {
  data: new Map(),
  set: function(pathId, radius, users) {
    const key = `${pathId}-${radius}`;
    const entry = { users, timestamp: Date.now() };
    this.data.set(key, entry);
  },
  get: function(pathId, radius) {
    const key = `${pathId}-${radius}`;
    const entry = this.data.get(key);
    if (entry && Date.now() - entry.timestamp < 5000) { // 5-second cache
      return entry.users;
    }
    return null;
  },
  clear: function() {
    this.data.clear();
    console.log('[2025-04-10 13:10:23] Path user cache cleared');
  }
};

// Helper function: Artificial delay to slow down requests - conditional based on environment
const addDelay = (ms = 2000) => {
  // Skip delays in production
  if (process.env.NODE_ENV === 'production') return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, ms));
};

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

// Middleware to log all requests
router.use((req, res, next) => {
  const userId = req.user ? req.user.id : 'unknown';
  // For logging only, use [unknown] as fallback
  const displayUsername = req.user && req.user.username ? req.user.username : '[unknown]';
  console.log(`[2025-04-10 13:10:23] ${req.method} ${req.path} - User: ${displayUsername} (${userId})`);
  next();
});

// Require authentication for all routes
router.use(protect);

// POST /api/location/update - Update user's location and set to ONLINE
router.post('/update', async (req, res) => {
  const startTime = Date.now();
  try {
    // Add artificial delay as requested
    await addDelay(2000);
    
    // Validate user data first
    const { isValid, missingFields } = validateUserData(req.user);
    if (!isValid) {
      console.error(`[2025-04-10 13:10:23] Location update error: Missing ${missingFields.join(', ')}`);
      return res.status(400).json({ 
        success: false,
        message: 'Your profile is incomplete. Please log out and log in again.' 
      });
    }
    
    const userId = req.user.id;
    const username = req.user.username; // No fallback - validated above
    const { latitude, longitude } = req.body;
    
    console.log(`[2025-04-10 13:10:23] Location update request details:`, {
      userId,
      username,
      latitude,
      longitude
    });
    
    if (!latitude || !longitude) {
      return res.status(400).json({ 
        success: false,
        message: 'Latitude and longitude are required' 
      });
    }
    
    // Clear path user cache when a user's location updates - they might now be along different paths
    pathUserCache.clear();
    
    // Try using Supabase if available
    if (databaseClient && typeof databaseClient.from === 'function') {
      try {
        console.log(`[2025-04-10 13:10:23] Attempting Supabase update for user: ${username} (${userId})`);
        
        // FIRST - Check if user profile exists, if not create it
        const { data: existingUser, error: checkError } = await databaseClient
          .from('profiles')
          .select('id')
          .eq('id', userId);
          
        if (checkError) {
          console.error('[2025-04-10 13:10:23] Error checking user profile:', checkError);
          throw checkError;
        }
        
        // If user doesn't exist in profiles table, create a new profile
        if (!existingUser || existingUser.length === 0) {
          console.log(`[2025-04-10 13:10:23] User ${username} (${userId}) not found in profiles. Creating new profile.`);
          
          const { data: newProfile, error: insertError } = await databaseClient
            .from('profiles')
            .insert([{
              id: userId,
              username: username, // Using validated username
              status: 'online',
              last_active: new Date().toISOString(),
              latitude: parseFloat(latitude),
              longitude: parseFloat(longitude)
            }])
            .select();
            
          if (insertError) {
            console.error('[2025-04-10 13:10:23] Error creating user profile:', insertError);
            throw insertError;
          }
          
          console.log(`[2025-04-10 13:10:23] Created new profile for user ${username}`);
          return res.json({
            success: true,
            message: 'New profile created with location',
            user: newProfile[0],
            method: 'supabase',
            executionTime: `${Date.now() - startTime}ms`
          });
        }
        
        // Update existing user location and set them as ONLINE
        const { data, error } = await databaseClient
          .from('profiles')
          .update({
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            last_active: new Date().toISOString(),
            status: 'online' // Set user as online when they update location
          })
          .eq('id', userId)
          .select();
        
        if (error) {
          console.error('[2025-04-10 13:10:23] Supabase update error:', error);
          throw error;
        }
        
        console.log(`[2025-04-10 13:10:23] Supabase update successful - ${username} marked as ONLINE`);
        return res.json({
          success: true,
          message: 'Location updated successfully and user set to online',
          user: data[0],
          method: 'supabase',
          executionTime: `${Date.now() - startTime}ms`
        });
      } catch (supabaseError) {
        console.error('[2025-04-10 13:10:23] Supabase operation failed:', supabaseError);
        // Fall through to memory DB option
      }
    }
    
    // Fallback to memory database
    console.log('[2025-04-10 13:10:23] Using memory database fallback');
    const user = memoryDB.addOrUpdateUser(userId, username, latitude, longitude, 'online');
    
    return res.json({
      success: true,
      message: 'Location updated successfully (fallback)',
      user,
      method: 'memory',
      executionTime: `${Date.now() - startTime}ms`
    });
  } catch (error) {
    const errorDetails = {
      message: error.message || 'Unknown error',
      name: error.name || 'Error',
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
    
    console.error('[2025-04-10 13:10:23] Exception in location update:', errorDetails);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: errorDetails,
      executionTime: `${Date.now() - startTime}ms`
    });
  }
});

// POST /api/location/offline - Mark user as offline when they logout
router.post('/offline', async (req, res) => {
  const startTime = Date.now();
  try {
    // Add artificial delay as requested
    await addDelay(1000);
    
    // Validate user data first
    const { isValid, missingFields } = validateUserData(req.user);
    if (!isValid) {
      console.error(`[2025-04-10 13:10:23] Set offline error: Missing ${missingFields.join(', ')}`);
      return res.status(400).json({ 
        success: false,
        message: 'Your profile is incomplete. Please log out and log in again.' 
      });
    }
    
    const userId = req.user.id;
    const username = req.user.username; // No fallback - validated above
    
    // Try using Supabase if available
    if (databaseClient && typeof databaseClient.from === 'function') {
      try {
        console.log(`[2025-04-10 13:10:23] Marking user ${username} (${userId}) as OFFLINE`);
        
        const { data, error } = await databaseClient
          .from('profiles')
          .update({
            status: 'offline',
            last_active: new Date().toISOString()
          })
          .eq('id', userId)
          .select();
        
        if (error) {
          console.error('[2025-04-10 13:10:23] Supabase update error:', error);
          throw error;
        }
        
        console.log(`[2025-04-10 13:10:23] User ${username} marked as OFFLINE successfully`);
        return res.json({
          success: true,
          message: 'User set to offline',
          user: data[0],
          method: 'supabase',
          executionTime: `${Date.now() - startTime}ms`
        });
      } catch (supabaseError) {
        console.error('[2025-04-10 13:10:23] Supabase operation failed:', supabaseError);
        // Fall through to memory DB option
      }
    }
    
    // Fallback to memory database
    const user = memoryDB.setUserOffline(userId);
    
    return res.json({
      success: true,
      message: 'User set to offline (fallback)',
      user,
      method: 'memory',
      executionTime: `${Date.now() - startTime}ms`
    });
  } catch (error) {
    console.error('[2025-04-10 13:10:23] Exception in setting user offline:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message,
      executionTime: `${Date.now() - startTime}ms`
    });
  }
});

// GET /api/location/live - Get all ONLINE user locations
router.get('/live', async (req, res) => {
  const startTime = Date.now();
  try {
    // Add artificial delay as requested
    await addDelay(2000);

    // Validate user data first
    const { isValid, missingFields } = validateUserData(req.user);
    if (!isValid) {
      console.error(`[2025-04-10 13:10:23] Get live users error: Missing ${missingFields.join(', ')}`);
      return res.status(400).json({ 
        success: false,
        message: 'Your profile is incomplete. Please log out and log in again.' 
      });
    }
    
    const userId = req.user.id;
    const username = req.user.username; // No fallback - validated above
    
    // Try using Supabase if available
    if (databaseClient && typeof databaseClient.from === 'function') {
      try {
        console.log('[2025-04-10 13:10:23] Fetching online users with locations');
        
        // Check for recent users - active within last 55 minutes
        const thirtyMinutesAgo = new Date();
        thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 55);
        
        // Debug by getting the current user specifically
        const { data: debugUser } = await databaseClient
          .from('profiles')
          .select('id, username, status, latitude, longitude, last_active')
          .eq('id', userId);
        
        if (debugUser && debugUser.length > 0) {
          console.log('[2025-04-10 13:10:23] Current user data:', debugUser[0]);
        } else {
          console.log('[2025-04-10 13:10:23] Current user not found in profiles! Creating a default entry.');
          
          // Create an entry for the current user if one doesn't exist
          const { data: newUser, error: insertError } = await databaseClient
            .from('profiles')
            .insert([{
              id: userId,
              username: username, // Using validated username
              status: 'online',
              last_active: new Date().toISOString()
            }])
            .select();
            
          if (insertError) {
            console.error('[2025-04-10 13:10:23] Error creating profile:', insertError);
          } else {
            console.log('[2025-04-10 13:10:23] Created new profile:', newUser[0]);
          }
        }
        
        // Get all online users - this is just for the base map view
        const { data, error } = await databaseClient
          .from('profiles')
          .select('id, username, latitude, longitude, last_active, status')
          .gt('last_active', thirtyMinutesAgo.toISOString());
        
        if (error) {
          console.error('[2025-04-10 13:10:23] Supabase query error:', error);
          throw error;
        }
        
        // Filter after querying to see what we're getting - only include users with valid coordinates
        const usersWithLocation = data.filter(user => 
          user.latitude && 
          user.longitude && 
          parseFloat(user.latitude) !== 0 && 
          parseFloat(user.longitude) !== 0);
        
        // Log detailed information about returned users
        usersWithLocation.forEach(user => {
          console.log(`[2025-04-10 13:10:23] Found user with location: ${user.username} (${user.id}), status: ${user.status}, coordinates: ${user.latitude},${user.longitude}`);
        });
        
        console.log(`[2025-04-10 13:10:23] Found ${usersWithLocation.length} users with locations out of ${data.length} active users`);
        
        // If current user is missing from the results despite having location data, add them manually
        const currentUserInResults = usersWithLocation.some(user => user.id === userId);
        if (!currentUserInResults && debugUser && debugUser.length > 0 && debugUser[0].latitude && debugUser[0].longitude) {
          console.log('[2025-04-10 13:10:23] Adding current user to results manually');
          usersWithLocation.push(debugUser[0]);
        }
        
        // Return the filtered list
        return res.json({ 
          success: true,
          data: usersWithLocation,
          method: 'supabase',
          executionTime: `${Date.now() - startTime}ms`,
          timestamp: new Date().toISOString()
        });
      } catch (supabaseError) {
        console.error('[2025-04-10 13:10:23] Supabase operation failed:', supabaseError);
        // Fall through to memory DB option
      }
    }
    
    // Fallback to memory database - get only online users
    const users = memoryDB.getOnlineUsers();
    
    return res.json({ 
      success: true,
      data: users,
      method: 'memory',
      executionTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[2025-04-10 13:10:23] Exception in get live locations:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message,
      executionTime: `${Date.now() - startTime}ms`
    });
  }
});

// GET /api/location/along-my-path - Get users along current user's path
// Updated /location/along-my-path endpoint in locationRoutes.js

// GET /api/location/along-my-path - Get users who are physically located along current user's path
router.get('/along-my-path', async (req, res) => {
  const startTime = Date.now();
  try {
    // Validate user data first
    const { isValid, missingFields } = validateUserData(req.user);
    if (!isValid) {
      console.error(`[2025-04-10 13:49:08] Along path error: Missing ${missingFields.join(', ')}`);
      return res.status(400).json({ 
        success: false,
        message: 'Your profile is incomplete. Please log out and log in again.',
        status: 'profile_incomplete'
      });
    }

    const userId = req.user.id;
    const username = req.user.username; // Validated above
    const radius = parseFloat(req.query.radius || '500'); 
    
    console.log(`[2025-04-10 13:49:08] LOCATION-ALONG-PATH: Finding users physically located along path for ${username} (${userId}) with radius ${radius}m`);
    
    // Try using Supabase if available
    if (databaseClient && typeof databaseClient.from === 'function') {
      // Check cache first
      const cachedUsers = pathUserCache.get(null, radius);
      if (cachedUsers) {
        console.log(`[2025-04-10 13:49:08] LOCATION-ALONG-PATH: Using cached results for user ${username}`);
        return res.json({
          success: true,
          status: 'success',
          data: cachedUsers,
          radius,
          cached: true,
          executionTime: `${Date.now() - startTime}ms`,
          timestamp: new Date().toISOString()
        });
      }
      
      // Step 1: Find the user's most recent path
      const { data: pathData, error: pathError } = await databaseClient
        .from('commute_routes')
        .select('id, source_lat, source_lng, dest_lat, dest_lng, route_wkt')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (pathError) {
        console.error(`[2025-04-10 13:49:08] LOCATION-ALONG-PATH ERROR: Failed to fetch path:`, pathError);
        return res.status(500).json({ 
          success: false,
          message: 'Error finding your path', 
          error: pathError.message,
          executionTime: `${Date.now() - startTime}ms`
        });
      }
      
      if (!pathData || pathData.length === 0) {
        console.log(`[2025-04-10 13:49:08] LOCATION-ALONG-PATH: No path found for user ${username} (${userId})`);
        return res.status(404).json({ 
          success: false,
          message: 'No path found for your user. Create a route first.',
          status: 'no_path',
          executionTime: `${Date.now() - startTime}ms`
        });
      }
      
      const pathId = pathData[0].id;
      console.log(`[2025-04-10 13:49:08] LOCATION-ALONG-PATH: Found path ${pathId} for user ${username}`);
      
      // Step 2: Find users whose CURRENT LOCATION is along this path
      console.log(`[2025-04-10 13:49:08] LOCATION-ALONG-PATH: Finding users physically located along path ${pathId} with radius ${radius}m`);
      
      const { data: usersData, error: usersError } = await databaseClient.rpc(
        'find_users_along_path',
        { 
          path_id: pathId,
          distance_meters: radius,
          exclude_user_id: userId  // Don't include the path owner in results
        }
      );
      
      if (usersError) {
        console.error(`[2025-04-10 13:49:08] LOCATION-ALONG-PATH ERROR: Failed to find users:`, usersError);
        return res.status(500).json({ 
          success: false,
          message: 'Error finding users along path', 
          error: usersError.message,
          executionTime: `${Date.now() - startTime}ms`
        });
      }
      
      // Log details about each user found
      if (usersData && usersData.length > 0) {
        usersData.forEach(user => {
          console.log(`[2025-04-10 13:49:08] User ${user.username} (${user.id}) is physically located along path ${pathId}`);
        });
      }
      
      // Store in cache for future requests
      pathUserCache.set(null, radius, usersData || []);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`[2025-04-10 13:49:08] LOCATION-ALONG-PATH: Found ${usersData ? usersData.length : 0} users physically located along path. Request completed in ${duration}ms`);
      
      return res.json({
        success: true,
        status: 'success',
        data: usersData || [], // These users are physically located along the path
        pathId,
        radius,
        pathDetails: {
          source: { lat: pathData[0].source_lat, lng: pathData[0].source_lng },
          destination: { lat: pathData[0].dest_lat, lng: pathData[0].dest_lng }
        },
        meta: {
          processingTime: duration,
          userCount: (usersData || []).length
        },
        timestamp: new Date().toISOString()
      });
    } else {
      // Fallback to memory database
      return res.status(501).json({ 
        success: false,
        message: 'This feature requires database support',
        executionTime: `${Date.now() - startTime}ms`
      });
    }
  } catch (error) {
    console.error(`[2025-04-10 13:49:08] LOCATION-ALONG-PATH ERROR: Unhandled exception:`, error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      executionTime: `${Date.now() - startTime}ms`
    });
  }
});

// GET /api/location/along-path - Get ONLY users that are along a specific path
router.get('/along-path', async (req, res) => {
  const startTime = Date.now();
  try {
    // Add artificial delay as requested
    await addDelay(1000);
    
    // Validate user data first
    const { isValid, missingFields } = validateUserData(req.user);
    if (!isValid) {
      console.error(`[2025-04-10 13:10:23] Along specific path error: Missing ${missingFields.join(', ')}`);
      return res.status(400).json({ 
        success: false,
        message: 'Your profile is incomplete. Please log out and log in again.' 
      });
    }
    
    const userId = req.user.id;
    const username = req.user.username; // No fallback - validated above
    const pathId = req.query.pathId;
    const radius = parseFloat(req.query.radius || '500'); 
    
    console.log(`[2025-04-10 13:10:23] LOCATION-ALONG-SPECIFIC-PATH: Retrieving users along path ${pathId} within ${radius}m radius for user ${username} (${userId})`);
    
    if (!pathId) {
      return res.status(400).json({ 
        success: false,
        message: 'Path ID is required' 
      });
    }
    
    // Check cache first
    const cachedUsers = pathUserCache.get(pathId, radius);
    if (cachedUsers) {
      console.log(`[2025-04-10 13:10:23] LOCATION-ALONG-SPECIFIC-PATH: Using cached results for path ${pathId}`);
      return res.json({ 
        success: true,
        data: cachedUsers,  // These are ONLY users physically along this specific path
        pathId,
        radius,
        cached: true,
        method: 'supabase',
        executionTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Try using Supabase if available
    if (databaseClient && typeof databaseClient.from === 'function') {
      try {
        // First, get the path details
        const { data: pathData, error: pathError } = await databaseClient
          .from('commute_routes')
          .select('id, route_geom, route_wkt, source_lat, source_lng, dest_lat, dest_lng, user_id')
          .eq('id', pathId)
          .single();
          
        if (pathError || !pathData) {
          console.error('[2025-04-10 13:10:23] Error fetching path:', pathError);
          return res.status(404).json({ 
            success: false,
            message: 'Path not found', 
            error: pathError,
            executionTime: `${Date.now() - startTime}ms`
          });
        }
        
        // Get the owner of this path for display purposes
        const pathOwner = pathData.user_id || "unknown";
        console.log(`[2025-04-10 13:10:23] Path ${pathId} belongs to user ${pathOwner}`);
        
        // Get users physically located along this specific path using PostGIS
        const { data: usersAlongPath, error: usersError } = await databaseClient.rpc(
          'find_users_along_path',
          { 
            path_id: pathId,
            distance_meters: radius,
            exclude_user_id: pathOwner // Exclude the path owner themselves
          }
        );
        
        if (usersError) {
          console.error('[2025-04-10 13:10:23] Error finding users along path:', usersError);
          return res.status(500).json({ 
            success: false,
            message: 'Error finding users along path', 
            error: usersError,
            executionTime: `${Date.now() - startTime}ms`
          });
        }
        
        // Store in cache for future requests
        pathUserCache.set(pathId, radius, usersAlongPath || []);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        console.log(`[2025-04-10 13:10:23] LOCATION-ALONG-SPECIFIC-PATH: Found ${usersAlongPath ? usersAlongPath.length : 0} users physically located along path ${pathId}. Request completed in ${duration}ms`);
        
        return res.json({ 
          success: true,
          data: usersAlongPath || [], // These are ONLY users physically along this specific path
          pathId,
          radius,
          pathOwner: pathOwner,
          pathDetails: {
            source: { lat: pathData.source_lat, lng: pathData.source_lng },
            destination: { lat: pathData.dest_lat, lng: pathData.dest_lng }
          },
          method: 'supabase',
          meta: {
            processingTime: duration,
            userCount: (usersAlongPath || []).length
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('[2025-04-10 13:10:23] Supabase query error:', error);
        return res.status(500).json({ 
          success: false,
          message: 'Database error', 
          error: error.message,
          executionTime: `${Date.now() - startTime}ms`
        });
      }
    } else {
      // Fallback to memory database - simple proximity check
      return res.status(501).json({ 
        success: false,
        message: 'This feature requires PostGIS capabilities',
        executionTime: `${Date.now() - startTime}ms`
      });
    }
  } catch (error) {
    console.error('[2025-04-10 13:10:23] Exception in get users along path:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error.message,
      executionTime: `${Date.now() - startTime}ms`
    });
  }
});

module.exports = router;