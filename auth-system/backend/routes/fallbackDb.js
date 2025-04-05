console.log('⚠️ USING IN-MEMORY DATABASE FALLBACK');

const memoryDB = {
  profiles: {},
  routes: [],
  
  // Add or update a user profile with online status
  addOrUpdateUser: function(userId, username, latitude, longitude, status = 'online') {
    this.profiles[userId] = {
      id: userId,
      username: username || 'Unknown User',
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      last_active: new Date().toISOString(),
      status: status
    };
    return this.profiles[userId];
  },
  
  // Set a user as offline
  setUserOffline: function(userId) {
    if (this.profiles[userId]) {
      this.profiles[userId].status = 'offline';
      this.profiles[userId].last_active = new Date().toISOString();
    }
    return this.profiles[userId];
  },
  
  // Get all online users
  getOnlineUsers: function() {
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);
    
    return Object.values(this.profiles).filter(user => {
      return user.status === 'online' && 
             new Date(user.last_active) > thirtyMinutesAgo &&
             user.latitude && user.longitude;
    });
  },
  
  // Add a new route
  addRoute: function(userId, source, destination, routeWkt) {
    const routeId = Date.now().toString();
    
    const newRoute = {
      id: routeId,
      user_id: userId,
      source_lat: source.lat,
      source_lng: source.lng,
      dest_lat: destination.lat,
      dest_lng: destination.lng,
      route_wkt: routeWkt,
      created_at: new Date().toISOString()
    };
    
    this.routes.push(newRoute);
    return newRoute;
  },
  
  // Get paths only for online users
  getLivePaths: function() {
    // Get online user IDs
    const onlineUsers = this.getOnlineUsers();
    const onlineUserIds = onlineUsers.map(user => user.id);
    
    // Filter routes by online users
    return this.routes
      .filter(route => onlineUserIds.includes(route.user_id))
      .map(route => ({
        id: route.id,
        user_id: route.user_id,
        created_at: route.created_at,
        route: route.route_wkt,
        source: {
          lat: route.source_lat,
          lng: route.source_lng
        },
        destination: {
          lat: route.dest_lat,
          lng: route.dest_lng
        }
      }));
  }
};

module.exports = memoryDB;