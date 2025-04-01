-- Function to create users table if it doesn't exist
CREATE OR REPLACE FUNCTION create_users_table_if_not_exists()
RETURNS void AS $$
BEGIN
  -- Check if the table exists
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'users'
  ) THEN
    -- Create the users table
    CREATE TABLE public.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(30) NOT NULL UNIQUE,
      email VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(100) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Add a comment to the table
    COMMENT ON TABLE public.users IS 'Table for storing user authentication data';
    
    -- Add RLS policies
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    
    -- Create policy for authenticated users to select their own record
    CREATE POLICY "Users can view their own data" 
      ON public.users FOR SELECT 
      USING (auth.uid() = id);
      
    -- Create policy for authenticated users to update their own record
    CREATE POLICY "Users can update their own data" 
      ON public.users FOR UPDATE 
      USING (auth.uid() = id);
  END IF;
END;
$$ LANGUAGE plpgsql;
