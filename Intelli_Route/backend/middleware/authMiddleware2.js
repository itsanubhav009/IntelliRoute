const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');

// Fix the protect middleware to properly identify users
const protect = asyncHandler(async (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Add user info to request
      req.user = decoded;
      
      // Debug log with timestamp
      console.log(`[${new Date().toISOString()}] Request authenticated for user: ${req.user.id}`);
      next();
    } catch (error) {
      console.error('Auth token verification failed:', error.message);
      res.status(401);
      throw new Error('Not authorized, invalid token');
    }
  } else {
    console.log(`[${new Date().toISOString()}] No auth token in request`);
    res.status(401);
    throw new Error('Not authorized, no token');
  }
});

module.exports = { protect };