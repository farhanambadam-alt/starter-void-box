import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const uploadFilesSchema = z.object({
  owner: z.string().min(1).max(39).regex(/^[a-zA-Z0-9-]+$/, 'Invalid owner name'),
  repo: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/, 'Invalid repo name'),
  files: z.array(
    z.object({
      path: z.string().min(1).max(4096).refine(
        (p) => !p.includes('..') && !p.startsWith('/'),
        'Path traversal not allowed'
      ),
      content: z.string().max(10485760), // 10MB limit per file
    })
  ).min(1).max(100),
  message: z.string().min(1).max(500).optional(),
  branch: z.string().min(1).max(255).regex(/^[a-zA-Z0-9._/-]+$/, 'Invalid branch name').optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const validation = uploadFilesSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input',
          details: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { owner, repo, files, message, branch } = validation.data;

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
      .select('github_access_token, github_username')
      .eq('id', user.id)
      .single();

    if (!profile?.github_access_token || !profile?.github_username) {
      return new Response(
        JSON.stringify({ error: 'GitHub profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authorization check: verify user owns the repository
    if (owner !== profile.github_username) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: can only access your own repositories' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Uploading ${files.length} files...`);

    const results = await Promise.all(
      files.map(async (file: { path: string; content: string }) => {
        try {
          const url = `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`;
          
          const githubResponse = await fetch(url, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${profile.github_access_token}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
              'User-Agent': 'RepoPush',
            },
            body: JSON.stringify({
              message: message || `Upload ${file.path}`,
              content: file.content,
              branch: branch || 'main',
            }),
          });

          if (!githubResponse.ok) {
            const error = await githubResponse.text();
            console.error(`Failed to upload ${file.path}:`, error);
            return {
              path: file.path,
              success: false,
              error: error,
            };
          }

          console.log(`Successfully uploaded ${file.path}`);
          return {
            path: file.path,
            success: true,
          };
        } catch (err) {
          console.error(`Exception uploading ${file.path}:`, err);
          return {
            path: file.path,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;
    console.log(`Upload complete: ${successCount}/${files.length} successful`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        summary: {
          total: files.length,
          successful: successCount,
          failed: files.length - successCount,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in upload-files function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
