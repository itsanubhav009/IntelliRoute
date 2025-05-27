const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create the Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Export the client directly
module.exports = supabase;

// IMPORTANT: Add a verification console log to confirm it's working
console.log('Supabase client initialized successfully. from() method exists:', !!supabase.from);