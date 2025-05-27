const User = require('../models/userModel');
const Session = require('../models/sessionModel');
const jwt = require('jsonwebtoken');
const Joi = require('joi');

// Validation schemas
const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required()
});

// Logger with timestamp
const logger = (message, error = null) => {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  if (error) {
    console.error(`[${timestamp}] ${message}`, error);
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
};

// Generate JWT token
const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    logger('ERROR: JWT_SECRET is not defined in environment variables');
    throw new Error('JWT secret is not defined');
  }
  
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    // Log registration attempt
    logger(`Registration attempt for username: ${req.body.username || 'unknown'}`);
    
    // Validate request body
    const { error } = registerSchema.validate(req.body);
    if (error) {
      logger(`Registration validation failed: ${error.details[0].message}`);
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { username, email, password } = req.body;

    // Check if user already exists
    try {
      const userExists = await User.findByUsername(username);
      if (userExists) {
        logger(`Registration failed: Username ${username} already exists`);
        return res.status(400).json({ 
          success: false,
          message: 'Username already exists' 
        });
      }
    } catch (lookupError) {
      logger(`Error checking for existing username ${username}`, lookupError);
      return res.status(500).json({ 
        success: false,
        message: 'Error checking username availability' 
      });
    }

    // Check if email already exists
    try {
      const emailExists = await User.findByEmail(email);
      if (emailExists) {
        logger(`Registration failed: Email ${email} already exists`);
        return res.status(400).json({ 
          success: false,
          message: 'Email already exists' 
        });
      }
    } catch (lookupError) {
      logger(`Error checking for existing email ${email}`, lookupError);
      return res.status(500).json({ 
        success: false,
        message: 'Error checking email availability' 
      });
    }

    // Create user
    let user;
    try {
      logger(`Creating user: ${username}`);
      user = await User.create({
        username,
        email,
        password
      });
      
      if (!user) {
        logger(`User creation for ${username} returned null/undefined`);
        return res.status(500).json({ 
          success: false,
          message: 'Failed to create user account - no data returned' 
        });
      }
      
      logger(`User created successfully with ID: ${user.id}`);
    } catch (userCreateError) {
      logger(`User creation error for ${username}`, userCreateError);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to create user account',
        details: userCreateError.message
      });
    }

    // Create initial session
    let session = null;
    try {
      logger(`Creating session for user: ${user.id} (${username})`);
      session = await Session.create(user.id, {
        ip_address: req.ip || '0.0.0.0',
        user_agent: req.headers['user-agent'] || 'Unknown'
      });
      
      if (session) {
        logger(`Session created successfully for ${username}: ${session.id}`);
      } else {
        logger(`Session creation returned null/undefined for ${username}`);
        // Continue despite session creation failure
      }
    } catch (sessionError) {
      logger(`Session creation error for user ${user.id} (${username})`, sessionError);
      // Continue despite session error, since user is created
    }

    // Generate token and respond with success
    try {
      const token = generateToken(user.id);
      logger(`User ${username} (${user.id}) registered successfully with token`);
      
      return res.status(201).json({
        success: true,
        id: user.id,
        username: user.username,
        email: user.email,
        token: token,
        session: session ? {
          id: session.id,
          created_at: session.created_at
        } : null
      });
    } catch (tokenError) {
      logger(`Token generation error for ${username}`, tokenError);
      
      // User was created but token generation failed
      return res.status(201).json({
        success: true,
        id: user.id,
        username: user.username,
        email: user.email,
        token: null,
        message: 'User created but session token could not be generated'
      });
    }
  } catch (error) {
    logger(`Unhandled registration error`, error);
    return res.status(500).json({ 
      success: false,
      message: 'Server error during registration',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    // Log login attempt (without password)
    logger(`Login attempt for username: ${req.body.username || 'unknown'}`);
    
    // Validate request body
    const { error } = loginSchema.validate(req.body);
    if (error) {
      logger(`Login validation failed: ${error.details[0].message}`);
      return res.status(400).json({ 
        success: false,
        message: error.details[0].message 
      });
    }

    const { username, password } = req.body;

    // Check if user exists
    let user;
    try {
      user = await User.findByUsername(username);
      if (!user) {
        logger(`Login failed: Username ${username} not found`);
        return res.status(400).json({ 
          success: false,
          message: 'Invalid credentials' 
        });
      }
    } catch (lookupError) {
      logger(`Error looking up user ${username}`, lookupError);
      return res.status(500).json({ 
        success: false,
        message: 'Error verifying credentials' 
      });
    }

    // Check if password matches
    let isMatch = false;
    try {
      isMatch = await User.comparePassword(password, user.password);
      if (!isMatch) {
        logger(`Login failed: Invalid password for ${username}`);
        return res.status(400).json({ 
          success: false,
          message: 'Invalid credentials' 
        });
      }
    } catch (passwordError) {
      logger(`Password comparison error for ${username}`, passwordError);
      return res.status(500).json({ 
        success: false,
        message: 'Error verifying credentials' 
      });
    }

    // Close any existing sessions
    try {
      logger(`Closing existing sessions for user: ${user.id} (${username})`);
      await Session.closeAllForUser(user.id);
    } catch (sessionCloseError) {
      logger(`Error closing existing sessions for ${username}`, sessionCloseError);
      // Continue despite session close errors
    }

    // Create a new session
    let session = null;
    try {
      logger(`Creating new session for user: ${user.id} (${username})`);
      session = await Session.create(user.id, {
        ip_address: req.ip || '0.0.0.0',
        user_agent: req.headers['user-agent'] || 'Unknown'
      });
      
      if (!session) {
        logger(`Session creation returned null/undefined for ${username}`);
        // Continue despite session creation failure
      }
    } catch (sessionError) {
      logger(`Session creation error for ${username}`, sessionError);
      // Continue despite session errors
    }

    // Generate token and respond with success
    try {
      const token = generateToken(user.id);
      logger(`User ${username} (${user.id}) logged in successfully`);
      
      return res.status(200).json({
        success: true,
        id: user.id,
        username: user.username,
        email: user.email,
        token: token,
        session: session ? {
          id: session.id,
          created_at: session.created_at
        } : null
      });
    } catch (tokenError) {
      logger(`Token generation error for ${username}`, tokenError);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to generate authentication token' 
      });
    }
  } catch (error) {
    logger(`Unhandled login error`, error);
    return res.status(500).json({ 
      success: false,
      message: 'Server error during login',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    if (!req.user.username) {
      logger(`Profile request has missing username for user ID: ${userId}`);
      return res.status(400).json({ 
        success: false,
        message: 'User profile incomplete. Please log out and log in again.' 
      });
    }
    const username = req.user.username;
    
    logger(`Profile request for user: ${username} (${userId})`);
    
    let user;
    try {
      user = await User.findById(userId);
      
      if (!user) {
        logger(`Profile not found for user ID: ${userId}`);
        return res.status(404).json({ 
          success: false,
          message: 'User not found' 
        });
      }
    } catch (userLookupError) {
      logger(`Error looking up user profile for ${userId}`, userLookupError);
      return res.status(500).json({ 
        success: false,
        message: 'Error retrieving user profile' 
      });
    }

    // Get current session
    let session = null;
    try {
      session = await Session.findActiveByUserId(userId);
      if (!session) {
        logger(`No active session found for ${username} (${userId})`);
        // Continue without session data
      }
    } catch (sessionError) {
      logger(`Error retrieving session for ${username}`, sessionError);
      // Continue without session data
    }

    logger(`Profile successfully retrieved for ${username}`);
    return res.status(200).json({
      success: true,
      id: user.id,
      username: user.username,
      email: user.email,
      created_at: user.created_at,
      session: session ? {
        id: session.id,
        is_online: session.is_online,
        last_active: session.last_active,
        latitude: session.latitude,
        longitude: session.longitude,
        location_updated_at: session.location_updated_at
      } : null
    });
  } catch (error) {
    logger(`Unhandled profile retrieval error`, error);
    return res.status(500).json({ 
      success: false,
      message: 'Server error retrieving profile',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const username = req.user.username || 'itsanubhav009';
    
    logger(`Logout request for user: ${username} (${userId})`);
    
    // Close all active sessions
    try {
      const result = await Session.closeAllForUser(userId);
      logger(`Sessions closed for ${username}: ${result ? result.count || 'unknown' : 'none'}`);
    } catch (sessionError) {
      logger(`Error closing sessions for ${username}`, sessionError);
      return res.status(500).json({ 
        success: false,
        message: 'Error during logout process' 
      });
    }
    
    logger(`User ${username} logged out successfully`);
    return res.status(200).json({ 
      success: true,
      message: 'Logged out successfully' 
    });
  } catch (error) {
    logger(`Unhandled logout error`, error);
    return res.status(500).json({ 
      success: false,
      message: 'Server error during logout',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  logoutUser
};