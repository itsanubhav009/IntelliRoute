const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');

class User {
  // Find user by username
  static async findByUsername(username) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error) {
      return null;
    }
    
    return data;
  }

  // Find user by email
  static async findByEmail(email) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      return null;
    }
    
    return data;
  }

  // Find user by ID
  static async findById(id) {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email, created_at, latitude, longitude, is_online, last_active')
      .eq('id', id)
      .single();

    if (error) {
      return null;
    }
    
    return data;
  }

  // Create a new user
  static async create(userData) {
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);

    const { data, error } = await supabase
      .from('users')
      .insert([{
        username: userData.username,
        email: userData.email,
        password: hashedPassword,
        is_online: true,
        last_active: new Date().toISOString()
      }])
      .select('id, username, email, created_at, is_online');

    if (error) {
      throw error;
    }
    
    return data[0];
  }

  // Update user location
  static async updateLocation(userId, latitude, longitude) {
    const { data, error } = await supabase
      .from('users')
      .update({
        latitude,
        longitude,
        location_updated_at: new Date().toISOString(),
        is_online: true,
        last_active: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id, username, latitude, longitude, is_online');

    if (error) {
      throw error;
    }
    
    return data[0];
  }

  // Update user online status
  static async updateOnlineStatus(userId, isOnline) {
    const { data, error } = await supabase
      .from('users')
      .update({
        is_online: isOnline,
        last_active: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id, username, is_online, last_active');

    if (error) {
      throw error;
    }
    
    return data[0];
  }

  // Get all online users
  static async getLiveUsers() {
    // Consider users active if they've been active in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('users')
      .select('id, username, latitude, longitude, last_active')
      .eq('is_online', true)
      .gt('last_active', fiveMinutesAgo);

    if (error) {
      throw error;
    }
    
    return data;
  }

  // Check if password matches
  static async comparePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
}

module.exports = User;