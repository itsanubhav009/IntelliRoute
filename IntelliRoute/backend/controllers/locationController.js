const User = require('../models/userModel');

// @desc    Update user location
// @route   POST /api/location/update
// @access  Private
const updateLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    
    // Validate location data
    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }
    
    // Convert to numbers and validate range
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    
    if (isNaN(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({ message: 'Invalid latitude value' });
    }
    
    if (isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ message: 'Invalid longitude value' });
    }
    
    // Update location
    const updatedUser = await User.updateLocation(req.user.id, lat, lng);
    
    res.json({
      success: true,
      data: updatedUser,
      message: 'Location updated successfully'
    });
  } catch (error) {
    console.error('Location update error:', error);
    res.status(500).json({ message: 'Failed to update location' });
  }
};

// @desc    Update user online status
// @route   POST /api/location/status
// @access  Private
const updateOnlineStatus = async (req, res) => {
  try {
    const { isOnline } = req.body;
    
    if (typeof isOnline !== 'boolean') {
      return res.status(400).json({ message: 'isOnline must be a boolean value' });
    }
    
    const updatedUser = await User.updateOnlineStatus(req.user.id, isOnline);
    
    res.json({
      success: true,
      data: updatedUser,
      message: `User is now ${isOnline ? 'online' : 'offline'}`
    });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ message: 'Failed to update online status' });
  }
};

// @desc    Get all live users
// @route   GET /api/location/live
// @access  Private
const getLiveUsers = async (req, res) => {
  try {
    const liveUsers = await User.getLiveUsers();
    
    res.json({
      success: true,
      count: liveUsers.length,
      data: liveUsers
    });
  } catch (error) {
    console.error('Get live users error:', error);
    res.status(500).json({ message: 'Failed to fetch live users' });
  }
};

module.exports = {
  updateLocation,
  updateOnlineStatus,
  getLiveUsers
};