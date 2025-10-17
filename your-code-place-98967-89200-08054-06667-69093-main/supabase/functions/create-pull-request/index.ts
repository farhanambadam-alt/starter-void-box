import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { getGitHubToken } from '../_shared/github-helper.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const createPRSchema = z.object({
  repositoryName: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/, 'Invalid repository name'),
  title: z.string().min(1).max(256),
  body: z.string().max(65536).optional(),
  head: z.string().min(1).max(255).regex(/^[a-zA-Z0-9._/-]+$/, 'Invalid head branch'),
  base: z.string().min(1).max(255).regex(/^[a-zA-Z0-9._/-]+$/, 'Invalid base branch'),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const validation = createPRSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input',
          details: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { repositoryName, title, body: prBody, head, base } = validation.data;

    const profile = await getGitHubToken(req);
    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized or GitHub token not found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const githubToken = profile.github_access_token;
    const owner = profile.github_username;

    console.log(`Creating PR for ${owner}/${repositoryName}: ${head} -> ${base}`);

    const prResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repositoryName}/pulls`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'RepoPush',
        },
        body: JSON.stringify({
          title,
          body: prBody || '',
          head,
          base,
        }),
      }
    );

    if (!prResponse.ok) {
      const errorText = await prResponse.text();
      console.error('Failed to create PR:', errorText);
      
      if (prResponse.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Your GitHub token is invalid or has expired. Please log out and log back in.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (prResponse.status === 422) {
        // Parse error details
        let errorDetail = 'No changes to merge between these branches';
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.errors && errorData.errors[0]?.message) {
            errorDetail = errorData.errors[0].message;
          }
        } catch (e) {
          // Use default message
        }
        
        return new Response(
          JSON.stringify({ error: errorDetail }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to create pull request. Please check your branch selections and try again.' }),
        { status: prResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prData = await prResponse.json();
    console.log('PR created successfully:', prData.html_url);

    return new Response(
      JSON.stringify({
        success: true,
        pull_request_url: prData.html_url,
        pull_request_number: prData.number,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-pull-request function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
