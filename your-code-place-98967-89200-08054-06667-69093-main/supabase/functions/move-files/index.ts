import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const moveFilesSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  files: z.array(z.object({
    path: z.string(),
    sha: z.string(),
    type: z.enum(['file', 'dir']),
  })),
  destination: z.string(),
  branch: z.string().default('main'),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { owner, repo, files, destination, branch } = moveFilesSchema.parse(body);

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

    console.log(`Moving ${files.length} items to ${destination}`);

    for (const file of files) {
      const fileName = file.path.split('/').pop();
      const newPath = destination ? `${destination}/${fileName}` : fileName;

      // Get file content
      const getResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${branch}`,
        {
          headers: {
            'Authorization': `Bearer ${profile.github_access_token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'RepoPush',
          },
        }
      );

      if (!getResponse.ok) continue;

      const fileData = await getResponse.json();

      // Create at new location
      await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${newPath}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${profile.github_access_token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'RepoPush',
          },
          body: JSON.stringify({
            message: `Move ${file.path} to ${newPath}`,
            content: fileData.content,
            branch,
          }),
        }
      );

      // Delete old location
      await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${profile.github_access_token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'RepoPush',
          },
          body: JSON.stringify({
            message: `Delete old file ${file.path}`,
            sha: file.sha,
            branch,
          }),
        }
      );
    }

    console.log('Files moved successfully');
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in move-files function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
