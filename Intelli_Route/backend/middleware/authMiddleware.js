// Fix for auth middleware to ensure username is properly populated
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get complete user information including username
      const user = await User.findById(decoded.id);
      
      if (!user) {
        console.error(`[2025-04-09 11:25:30] Auth error: User ID ${decoded.id} not found`);
        return res.status(401).json({ message: 'Not authorized, token invalid' });
      }

      // Important: Set COMPLETE user info including username
      req.user = {
        id: user.id,
        username: user.username,  // Ensure username is included
        email: user.email
      };

      next();
    } catch (error) {
      console.error(`[2025-04-09 11:25:30] Auth error:`, error);
      res.status(401).json({ message: 'Not authorized, token invalid' });
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

module.exports = { protect };