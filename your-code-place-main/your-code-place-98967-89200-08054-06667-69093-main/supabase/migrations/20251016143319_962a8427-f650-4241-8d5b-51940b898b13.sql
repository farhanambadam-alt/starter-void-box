-- Security fixes for profiles table and update_user_github_token function

-- 1. Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Create RLS policies for profiles table
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- 3. Update the update_user_github_token function with authorization check
CREATE OR REPLACE FUNCTION public.update_user_github_token(
  user_id uuid,
  access_token text,
  username text,
  avatar_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- CRITICAL: Verify caller is updating their own profile
  -- This prevents attackers from hijacking other users' tokens
  IF auth.uid() != user_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot update another user''s token';
  END IF;
  
  -- Use UPSERT to handle both new and existing profiles
  -- This fixes the race condition where profiles might not exist yet
  INSERT INTO public.profiles (id, github_access_token, github_username, github_avatar_url, updated_at)
  VALUES (user_id, access_token, username, avatar_url, now())
  ON CONFLICT (id)
  DO UPDATE SET
    github_access_token = EXCLUDED.github_access_token,
    github_username = EXCLUDED.github_username,
    github_avatar_url = EXCLUDED.github_avatar_url,
    updated_at = now();
    
  -- Log for debugging (will appear in Edge Function logs)
  RAISE NOTICE 'Token updated successfully for user %', user_id;
END;
$$;