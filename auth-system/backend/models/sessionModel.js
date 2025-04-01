const supabase = require('../config/supabase');

class Session {
  // Create a new session
  static async create(userId, data = {}) {
    const sessionData = {
      user_id: userId,
      is_online: true,
      last_active: new Date().toISOString(),
      ...data
    };

    const { data: session, error } = await supabase
      .from('user_sessions')
      .insert([sessionData])
      .select('*');

    if (error) {
      throw error;
    }
    
    return session[0];
  }

  // Find active session for a user
  static async findActiveByUserId(userId) {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_online', true)
      .order('last_active', { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }
    
    return data[0] || null;
  }

  // Update a session
  static async update(sessionId, updateData) {
    const { data, error } = await supabase
      .from('user_sessions')
      .update({
        last_active: new Date().toISOString(),
        ...updateData
      })
      .eq('id', sessionId)
      .select('*');

    if (error) {
      throw error;
    }
    
    return data[0];
  }

  // Update location for a session
  static async updateLocation(sessionId, latitude, longitude) {
    const { data, error } = await supabase
      .from('user_sessions')
      .update({
        latitude,
        longitude,
        location_updated_at: new Date().toISOString(),
        last_active: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select('*');

    if (error) {
      throw error;
    }
    
    return data[0];
  }

  // Close a session
  static async close(sessionId) {
    const { data, error } = await supabase
      .from('user_sessions')
      .update({
        is_online: false,
        last_active: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select('*');

    if (error) {
      throw error;
    }
    
    return data[0];
  }

  // Get all active sessions with user info
  static async getAllActive() {
    // Consider sessions active if they've been active in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('user_sessions')
      .select(`
        *,
        users:user_id (id, username, email)
      `)
      .eq('is_online', true)
      .gt('last_active', fiveMinutesAgo);

    if (error) {
      throw error;
    }
    
    return data;
  }

  // Close all sessions for a user
  static async closeAllForUser(userId) {
    const { data, error } = await supabase
      .from('user_sessions')
      .update({
        is_online: false,
        last_active: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('is_online', true)
      .select('*');

    if (error) {
      throw error;
    }
    
    return data;
  }
}

module.exports = Session;