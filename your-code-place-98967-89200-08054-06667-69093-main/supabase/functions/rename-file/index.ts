import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const renameFileSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  path: z.string(),
  new_path: z.string(),
  sha: z.string().min(1),
  branch: z.string().default('main'),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { owner, repo, path, new_path, sha, branch } = renameFileSchema.parse(body);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('github_access_token')
      .eq('id', user.id)
      .single();

    if (!profile?.github_access_token) {
      return new Response(
        JSON.stringify({ error: 'GitHub token not found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Renaming file: ${path} to ${new_path}`);

    // Get file content
    const getResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      {
        headers: {
          'Authorization': `Bearer ${profile.github_access_token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'RepoPush',
        },
      }
    );

    if (!getResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to get file content' }),
        { status: getResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fileData = await getResponse.json();

    // Create file at new location
    const createResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${new_path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${profile.github_access_token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'RepoPush',
        },
        body: JSON.stringify({
          message: `Rename ${path} to ${new_path}`,
          content: fileData.content,
          branch,
        }),
      }
    );

    if (!createResponse.ok) {
      const error = await createResponse.text();
      console.error('Failed to create file at new location:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to create file at new location' }),
        { status: createResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete old file
    const deleteResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${profile.github_access_token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'RepoPush',
        },
        body: JSON.stringify({
          message: `Delete old file ${path}`,
          sha,
          branch,
        }),
      }
    );

    if (!deleteResponse.ok) {
      console.error('Failed to delete old file');
    }

    console.log('File renamed successfully');
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in rename-file function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
