-- Create function to update existing user's GitHub token
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
  UPDATE public.profiles
  SET 
    github_access_token = access_token,
    github_username = username,
    github_avatar_url = avatar_url,
    updated_at = now()
  WHERE id = user_id;
END;
$$;