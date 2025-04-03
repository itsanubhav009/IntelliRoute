const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createClient } = require('@supabase/supabase-js');

// Create a memory database for fallback
const memoryDB = {
  users: {},
  addOrUpdateUser: function(userId, username, latitude, longitude) {
    this.users[userId] = {
      id: userId,
      username: username || 'Unknown User',
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      last_active: new Date().toISOString()
    };
    return this.users[userId];
  },
  getAllUsers: function() {
    return Object.values(this.users);
  }
};

// Initialize Supabase with better error handling
let supabase = null;
try {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized');
  } else {
    console.log('Supabase credentials missing, using memory database');
  }
} catch (err) {
  console.error('Failed to initialize Supabase:', err);
}

// Log system info for debugging
console.log('Current Date and Time (UTC):', new Date().toISOString());
console.log('Node.js version:', process.version);
console.log('Environment:', process.env.NODE_ENV || 'development');

// Middleware to log all requests
router.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - User ID: ${req.user?.id || 'unknown'}`);
  next();
});

// Require authentication for all routes
router.use(protect);

// POST /api/location/update - Update user's location
router.post('/update', async (req, res) => {
  const startTime = Date.now();
  try {
    const userId = req.user?.id;
    const username = req.user?.username || 'Unknown';
    const { latitude, longitude } = req.body;
    
    console.log('Location update request details:', {
      userId,
      username,
      latitude,
      longitude,
      timestamp: new Date().toISOString()
    });
    
    if (!userId) {
      return res.status(401).json({ message: 'User ID not found in request' });
    }
    
    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }
    
    // OPTION 1: Try using Supabase if available
    if (supabase) {
      try {
        console.log('Attempting Supabase update for user:', userId);
        
        // Debug check if profiles table exists
        const { data: tableCheck, error: tableError } = await supabase
          .from('profiles')
          .select('id')
          .limit(1);
          
        if (tableError) {
          console.error('Error checking profiles table:', tableError);
          throw new Error(`Table check failed: ${tableError.message}`);
        }
        
        console.log('Profiles table check result:', tableCheck);
        
        // Attempt the update
        const { data, error } = await supabase
          .from('profiles')
          .update({
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            last_active: new Date().toISOString()
          })
          .eq('id', userId)
          .select();
        
        if (error) {
          console.error('Supabase update error:', error);
          throw error;
        }
        
        console.log('Supabase update successful:', data);
        return res.json({
          message: 'Location updated successfully',
          user: data[0],
          method: 'supabase'
        });
      } catch (supabaseError) {
        console.error('Supabase operation failed:', supabaseError);
        // Fall through to memory DB option
      }
    }
    
    // OPTION 2: Fallback to memory database
    console.log('Using memory database fallback');
    const user = memoryDB.addOrUpdateUser(userId, username, latitude, longitude);
    
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

// GET /api/location/live - Get all active user locations
router.get('/live', async (req, res) => {
  const startTime = Date.now();
  try {
    // OPTION 1: Try using Supabase if available
    if (supabase) {
      try {
        console.log('Attempting to get live locations using Supabase');
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, latitude, longitude, last_active')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);
          
        if (error) {
          console.error('Supabase query error:', error);
          throw error;
        }
        
        console.log(`Found ${data.length} users with locations`);
        return res.json({ 
          data,
          method: 'supabase',
          executionTime: `${Date.now() - startTime}ms`
        });
      } catch (supabaseError) {
        console.error('Supabase operation failed:', supabaseError);
        // Fall through to memory DB option
      }
    }
    
    // OPTION 2: Fallback to memory database
    console.log('Using memory database fallback for live locations');
    const users = memoryDB.getAllUsers();
    
    return res.json({ 
      data: users,
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
    
    console.error('Exception in get live locations:', errorDetails);
    res.status(500).json({ 
      message: 'Internal server error',
      error: errorDetails,
      executionTime: `${Date.now() - startTime}ms`
    });
  }
});

module.exports = router;