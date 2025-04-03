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
  console.log('Using Supabase database client for paths');
} catch (error) {
  console.error('Supabase error in paths, using fallback database:', error.message);
  databaseClient = require('./fallbackDb');
}

// All routes below require authentication
router.use(protect);

// POST /api/path/set - Stores a path in database
router.post('/set', async (req, res) => {
  try {
    const userId = req.user.id;
    const { source, destination, routeWKT } = req.body;
    
    console.log('Received path data:', { source, destination, routeWKT });
    
    if (!source || !destination || !routeWKT) {
      return res.status(400).json({ message: 'Source, Destination and routeWKT are required' });
    }

    let pathData;
    
    // Use the appropriate client
    if (typeof databaseClient.from === 'function') {
      // Using Supabase
      const { data, error } = await databaseClient
        .from('user_routes')
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
    } else {
      // Using fallback
      pathData = databaseClient.addRoute(userId, source, destination, routeWKT);
    }
    
    res.json({
      message: 'Path stored successfully',
      pathId: pathData?.id
    });
  } catch (error) {
    console.error('Exception in path creation:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: error.message
    });
  }
});

// GET /api/path/live - Returns all paths
router.get('/live', async (req, res) => {
  try {
    let pathsData;
    
    // Use the appropriate client
    if (typeof databaseClient.from === 'function') {
      // Using Supabase
      const { data, error } = await databaseClient
        .from('user_routes')
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
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Database error fetching paths:', error);
        return res.status(500).json({ message: 'Error fetching paths', error });
      }
      
      // Transform the data
      pathsData = data.map(path => ({
        id: path.id,
        user_id: path.user_id,
        created_at: path.created_at,
        route: path.route_wkt
      }));
    } else {
      // Using fallback
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

module.exports = router;