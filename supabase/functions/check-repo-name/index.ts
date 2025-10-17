import { getGitHubToken } from '../_shared/github-helper.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const checkRepoSchema = z.object({
  repositoryName: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/, 'Invalid repository name'),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const validation = checkRepoSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input',
          details: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { repositoryName } = validation.data;

    const profile = await getGitHubToken(req);
    if (!profile) {
      return new Response(
        JSON.stringify({ 
          error: "We're still setting up your GitHub connection. This usually takes just a moment. Please wait and try again.",
          errorCode: 'TOKEN_NOT_READY'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const githubToken = profile.github_access_token;
    const owner = profile.github_username;

    console.log(`Checking if repository ${owner}/${repositoryName} exists`);

    // Check if repository exists
    const checkResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repositoryName}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'RepoPush',
        },
      }
    );

    if (checkResponse.status === 401) {
      return new Response(
        JSON.stringify({ error: 'Your GitHub token is invalid or has expired. Please log out and log back in.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const exists = checkResponse.ok;
    console.log(`Repository ${repositoryName} ${exists ? 'exists' : 'is available'}`);

    return new Response(
      JSON.stringify({
        exists,
        available: !exists,
        message: exists 
          ? `Repository "${repositoryName}" already exists` 
          : `Repository name "${repositoryName}" is available`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-repo-name function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
