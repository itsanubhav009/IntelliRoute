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
  console.log('Using Supabase database client for locations');
} catch (error) {
  console.error('Supabase error in locations, using fallback database:', error.message);
  databaseClient = require('./fallbackDb');
}

// Helper function: Artificial delay to slow down requests as requested
const addDelay = (ms = 2000) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Middleware to log all requests
router.use((req, res, next) => {
  const userId = req.user ? req.user.id : 'unknown';
  console.log(`${req.method} ${req.path} - User ID: ${userId}`);
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
    
    const userId = req.user ? req.user.id : null;
    const username = req.user ? (req.user.username || 'Unknown') : 'Unknown';
    const { latitude, longitude } = req.body;
    
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Location update request details:`, {
      userId,
      username,
      latitude,
      longitude
    });
    
    if (!userId) {
      return res.status(401).json({ message: 'User ID not found in request' });
    }
    
    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }
    
    // Try using Supabase if available
    if (databaseClient && typeof databaseClient.from === 'function') {
      try {
        console.log('Attempting Supabase update for user:', userId);
        
        // FIRST - Check if user profile exists, if not create it
        const { data: existingUser, error: checkError } = await databaseClient
          .from('profiles')
          .select('id')
          .eq('id', userId);
          
        if (checkError) {
          console.error('Error checking user profile:', checkError);
          throw checkError;
        }
        
        // If user doesn't exist in profiles table, create a new profile
        if (!existingUser || existingUser.length === 0) {
          console.log(`User ${userId} not found in profiles table. Creating new profile.`);
          
          const { data: newProfile, error: insertError } = await databaseClient
            .from('profiles')
            .insert([{
              id: userId,
              username: username,
              status: 'online',
              last_active: new Date().toISOString(),
              latitude: parseFloat(latitude),
              longitude: parseFloat(longitude)
            }])
            .select();
            
          if (insertError) {
            console.error('Error creating user profile:', insertError);
            throw insertError;
          }
          
          console.log(`Created new profile for user ${userId}`);
          return res.json({
            message: 'New profile created with location',
            user: newProfile[0],
            method: 'supabase'
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
          console.error('Supabase update error:', error);
          throw error;
        }
        
        console.log('Supabase update successful - user marked as ONLINE');
        return res.json({
          message: 'Location updated successfully and user set to online',
          user: data[0],
          method: 'supabase'
        });
      } catch (supabaseError) {
        console.error('Supabase operation failed:', supabaseError);
        // Fall through to memory DB option
      }
    }
    
    // Fallback to memory database
    console.log('Using memory database fallback');
    const user = memoryDB.addOrUpdateUser(userId, username, latitude, longitude, 'online');
    
    return res.json({
      message: 'Location updated successfully (fallback)',
      user,
      method: 'memory'
    });
  } catch (error) {
    const errorDetails = {
      message: error.message || 'Unknown error',
      name: error.name || 'Error',
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
    
    console.error('Exception in location update:', errorDetails);
    res.status(500).json({ 
      message: 'Internal server error',
      error: errorDetails,
      executionTime: `${Date.now() - startTime}ms`
    });
  }
});

// POST /api/location/offline - Mark user as offline when they logout
router.post('/offline', async (req, res) => {
  try {
    // Add artificial delay as requested
    await addDelay(1000);
    
    const userId = req.user ? req.user.id : null;
    
    if (!userId) {
      return res.status(401).json({ message: 'User ID not found in request' });
    }
    
    // Try using Supabase if available
    if (databaseClient && typeof databaseClient.from === 'function') {
      try {
        console.log('Marking user as OFFLINE:', userId);
        
        const { data, error } = await databaseClient
          .from('profiles')
          .update({
            status: 'offline',
            last_active: new Date().toISOString()
          })
          .eq('id', userId)
          .select();
        
        if (error) {
          console.error('Supabase update error:', error);
          throw error;
        }
        
        console.log('User marked as OFFLINE successfully');
        return res.json({
          message: 'User set to offline',
          user: data[0],
          method: 'supabase'
        });
      } catch (supabaseError) {
        console.error('Supabase operation failed:', supabaseError);
        // Fall through to memory DB option
      }
    }
    
    // Fallback to memory database
    const user = memoryDB.setUserOffline(userId);
    
    return res.json({
      message: 'User set to offline (fallback)',
      user,
      method: 'memory'
    });
  } catch (error) {
    console.error('Exception in setting user offline:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: error.message
    });
  }
});

// GET /api/location/live - Get all ONLINE user locations
router.get('/live', async (req, res) => {
  try {
    // Add artificial delay as requested
    await addDelay(2000);
    
    // Try using Supabase if available
    if (databaseClient && typeof databaseClient.from === 'function') {
      try {
        console.log('Fetching online users with locations - DEBUG QUERY');
        
        // Remove the status filter that might be causing issues
        const thirtyMinutesAgo = new Date();
        thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);
        
        // Debug by getting the current user specifically
        const { data: debugUser } = await databaseClient
          .from('profiles')
          .select('id, username, status, latitude, longitude, last_active')
          .eq('id', req.user.id);
        
        if (debugUser && debugUser.length > 0) {
          console.log('Current user data:', debugUser[0]);
        } else {
          console.log('Current user not found in profiles! Creating a default entry.');
          
          // Create an entry for the current user if one doesn't exist
          const { data: newUser, error: insertError } = await databaseClient
            .from('profiles')
            .insert([{
              id: req.user.id,
              username: req.user.username || 'Unknown',
              status: 'online',
              last_active: new Date().toISOString()
            }])
            .select();
            
          if (insertError) {
            console.error('Error creating profile:', insertError);
          } else {
            console.log('Created new profile:', newUser[0]);
          }
        }
        
        // Simpler query - just get recent users with location data
        const { data, error } = await databaseClient
          .from('profiles')
          .select('id, username, latitude, longitude, last_active, status')
          .gt('last_active', thirtyMinutesAgo.toISOString());
        
        if (error) {
          console.error('Supabase query error:', error);
          throw error;
        }
        
        // Filter after querying to see what we're getting
        const usersWithLocation = data.filter(user => 
          user.latitude && 
          user.longitude && 
          parseFloat(user.latitude) !== 0 && 
          parseFloat(user.longitude) !== 0);
        
        // Log detailed information about returned users
        usersWithLocation.forEach(user => {
          console.log(`Found user with location: ${user.username} (${user.id}), status: ${user.status}, coordinates: ${user.latitude},${user.longitude}`);
        });
        
        console.log(`Found ${usersWithLocation.length} users with locations out of ${data.length} active users`);
        
        // If current user is missing from the results despite having location data, add them manually
        const currentUserInResults = usersWithLocation.some(user => user.id === req.user.id);
        if (!currentUserInResults && debugUser && debugUser.length > 0 && debugUser[0].latitude && debugUser[0].longitude) {
          console.log('Adding current user to results manually');
          usersWithLocation.push(debugUser[0]);
        }
        
        // Return the filtered list
        return res.json({ 
          data: usersWithLocation,
          method: 'supabase'
        });
      } catch (supabaseError) {
        console.error('Supabase operation failed:', supabaseError);
        // Fall through to memory DB option
      }
    }
    
    // Fallback to memory database - get only online users
    const users = memoryDB.getOnlineUsers();
    
    return res.json({ 
      data: users,
      method: 'memory'
    });
  } catch (error) {
    console.error('Exception in get live locations:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router;