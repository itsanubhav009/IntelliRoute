const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const pathRoutes = require('./routes/pathRoutes');
const locationRoutes = require('./routes/locationRoutes');
require('dotenv').config();

// Initialize app
const app = express();
const PORT = process.env.PORT || 5000;

// IMPORTANT: Set up middleware BEFORE routes
// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
// Add this before your routes
// Add this before your route handlers
// Add this to your existing routes
const chatRoutes = require('./routes/chatRoutes');
app.use('/api/chat', chatRoutes);
// Global middleware for request diagnostic logging
app.use((req, res, next) => {
  const start = Date.now();
  
  // Log the start of the request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - START`);
  
  // When the response finishes, log the response time
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - COMPLETE (${duration}ms)`);
  });
  
  // Track auth token presence
  const hasToken = req.headers.authorization && req.headers.authorization.startsWith('Bearer');
  console.log(`[DEBUG] Request has auth token: ${hasToken ? 'Yes' : 'No'}`);
  
  next();
});

// Add this to your error handler to improve error logging
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.stack);
  
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
});
app.use((req, res, next) => {
  // Extract token from header
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.split(' ')[1] : null;
  
  console.log(`[DEBUG] Request: ${req.method} ${req.path}`);
  console.log(`[DEBUG] Auth Header: ${token ? 'Present' : 'Missing'}`);
  
  next();
});
// THEN add routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/path', pathRoutes);
app.use('/api/location', locationRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});