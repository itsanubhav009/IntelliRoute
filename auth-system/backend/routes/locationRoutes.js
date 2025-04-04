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
  console.log(`${req.method} ${req.path} - User ID: ${req.user?.id || 'unknown'}`);
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
    
    const userId = req.user?.id;
    const username = req.user?.username || 'Unknown';
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
        
        // Update user location and set them as ONLINE
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
    
    const userId = req.user?.id;
    
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
// GET /api/location/live - Get all ONLINE user locations
router.get('/live', async (req, res) => {
  try {
    // Add artificial delay as requested
    await addDelay(2000);
    
    // Try using Supabase if available
    if (databaseClient && typeof databaseClient.from === 'function') {
      try {
        console.log('Fetching online users with locations');
        
        // UPDATED QUERY - Wider time window and less restrictive conditions
        // Get users who:
        // 1. Have been active in the last 30 minutes (instead of 5)
        // 2. Have location data
        // 3. Status check is now optional
        const thirtyMinutesAgo = new Date();
        thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);
        
        const { data, error } = await databaseClient
          .from('profiles')
          .select('id, username, latitude, longitude, last_active, status')
          .gt('last_active', thirtyMinutesAgo.toISOString())
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);
          
        if (error) {
          console.error('Supabase query error:', error);
          throw error;
        }
        
        console.log(`Found ${data.length} active users with locations`);
        return res.json({ 
          data,
          method: 'supabase'
        });
      } catch (supabaseError) {
        console.error('Supabase operation failed:', supabaseError);
        // Fall through to memory DB option
      }
    }
    
    // Fallback to memory database - get all users with recent activity
    const users = memoryDB.getAllUsers();
    
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