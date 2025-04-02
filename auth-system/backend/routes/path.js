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
      const userId = req.user.id;
      const { source, destination, routeWKT } = req.body;
      
      if (!source || !destination || !routeWKT) {
        return res.status(400).json({ message: 'Source, Destination and routeWKT are required' });
      }
  
      // Example: routeWKT = "LINESTRING(77.209 28.6139, 75.04335 23.84495, 72.8777 19.076)"
      // Insert the route. The geometry column is updated using PostGIS' ST_GeomFromText function.
      const { data, error } = await supabase
        .from('user_paths')
        .insert([
          {
            user_id: userId,
            route_geometry: routeWKT ? supabase.raw(`ST_SetSRID(ST_GeomFromText(?), 4326)`, [routeWKT]) : null
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
    // Get paths from memory
    const livePaths = Array.from(inMemoryPaths.values()).map(item => ({
      user_id: item.user_id,
      route: JSON.stringify(item.path_points)
    }));
    
    res.json({ data: livePaths });
  } catch (error) {
    console.error('Error in /path/live:', error);
    res.json({ data: [] });
  }
});

module.exports = router;