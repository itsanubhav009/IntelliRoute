const express = require('express');
const router = express.Router();
const { updateLocation, updateOnlineStatus, getLiveUsers } = require('../controllers/locationController');
const { protect } = require('../middleware/authMiddleware');

// All routes are protected
router.use(protect);

router.post('/update', updateLocation);
router.post('/status', updateOnlineStatus);
router.get('/live', getLiveUsers);

module.exports = router;