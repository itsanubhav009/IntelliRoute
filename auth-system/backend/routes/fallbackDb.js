// In-memory database fallback
console.log('⚠️ USING IN-MEMORY DATABASE FALLBACK');

const memDb = {
  profiles: {},
  routes: []
};

// Add or update a user profile
const updateUserLocation = (userId, username, latitude, longitude) => {
  memDb.profiles[userId] = {
    id: userId,
    username: username || 'User',
    latitude,
    longitude,
    last_active: new Date().toISOString()
  };
  
  return memDb.profiles[userId];
};

// Get all user profiles
const getLiveUsers = () => {
  return Object.values(memDb.profiles);
};

// Add a new route
const addRoute = (userId, source, destination, routeWkt) => {
  const routeId = Date.now().toString();
  
  const newRoute = {
    id: routeId,
    user_id: userId,
    username: memDb.profiles[userId]?.username || 'Unknown',
    source_lat: source.lat,
    source_lng: source.lng,
    dest_lat: destination.lat,
    dest_lng: destination.lng,
    route_wkt: routeWkt,
    created_at: new Date().toISOString()
  };
  
  memDb.routes.push(newRoute);
  return newRoute;
};

// Get all routes
const getLivePaths = () => {
  return memDb.routes.map(route => ({
    id: route.id,
    user_id: route.user_id,
    username: route.username,
    created_at: route.created_at,
    route: route.route_wkt
  }));
};

module.exports = {
  updateUserLocation,
  getLiveUsers,
  addRoute,
  getLivePaths
};