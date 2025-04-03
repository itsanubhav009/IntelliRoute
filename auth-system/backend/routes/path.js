const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { protect } = require('../middleware/authMiddleware');

// In-memory storage for paths (persists until server restart)
const inMemoryPaths = new Map();

// Dummy function to calculate a route between source and destination.
function calculatePath(source, destination) {
  const mid = {
    lat: (source.lat + destination.lat) / 2,
    lng: (source.lng + destination.lng) / 2,
  };
  return [source, mid, destination];
}

// All routes below require authentication.
router.use(protect);

// POST /api/path/set - Calculates a path and stores it in memory
router.post('/set', async (req, res) => {
  try {
    console.log('Request body received:', JSON.stringify(req.body));
    const userId = req.user.id;
    const { source, destination, routeWKT: providedRouteWKT } = req.body;
    
    // Debug extracted values
    console.log('Extracted values:', { 
      userIdExists: !!userId,
      sourceExists: !!source, 
      destinationExists: !!destination, 
      routeWKTExists: !!providedRouteWKT 
    });
    
    // More detailed validation
    const missingFields = [];
    if (!source) missingFields.push('source');
    if (!destination) missingFields.push('destination');
    
    if (missingFields.length > 0) {
      console.log('Missing fields:', missingFields);
      return res.status(400).json({ 
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }
    
    // Generate WKT if not provided
    let routeWKT = providedRouteWKT;
    if (!routeWKT && source && destination) {
      // Create a direct line from source to destination
      routeWKT = `LINESTRING(${source.lng} ${source.lat}, ${destination.lng} ${destination.lat})`;
      console.log('Generated routeWKT:', routeWKT);
    }
    
   // Now proceed with the database insert
   const { data, error } = await supabase
   .from('user_paths')
   .insert([
     {
       user_id: userId,
       route_geometry: routeWKT
     }
   ])
   .select('id, route_geometry');
     
      if (error) {
        console.error('Error inserting path:', error);
        return res.status(500).json({ message: 'Error inserting path', error });
      }
      
      // Alternatively, to view the geometry as text on retrieval, you may use a query that casts or uses ST_AsText.
      res.json({
        message: 'Path stored successfully',
        data
      });
    } catch (error) {
      console.error('Error in /path/set:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  });

// GET /api/path/live - Returns live user paths from memory
router.get('/live', protect, async (req, res) => {
  try {
    const { data: livePaths, error } = await supabase
      .from('user_paths')
      .select('id, user_id, ST_AsText(route_geometry) as route, created_at');

    if (error) {
      console.error('Error fetching live paths:', error);
      return res.status(500).json({ message: 'Error fetching live paths', error });
    }

    res.json({ data: livePaths });
  } catch (error) {
    console.error('Error in /path/live:', error);
    res.status(500).json({ data: [] });
  }
});

module.exports = router;