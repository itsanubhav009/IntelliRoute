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