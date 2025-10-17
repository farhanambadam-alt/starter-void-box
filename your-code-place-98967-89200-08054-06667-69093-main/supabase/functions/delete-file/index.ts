import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { getGitHubToken } from '../_shared/github-helper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const deleteFileSchema = z.object({
  owner: z.string().min(1).max(39).regex(/^[a-zA-Z0-9-]+$/, 'Invalid owner name'),
  repo: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/, 'Invalid repo name'),
  path: z.string().min(1).max(4096).refine(
    (p) => !p.includes('..') && !p.startsWith('/'),
    'Path traversal not allowed'
  ),
  sha: z.string().min(1).max(100),
  branch: z.string().min(1).max(255).optional(),
  type: z.enum(['file', 'dir']).optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const validation = deleteFileSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input',
          details: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { owner, repo, path, sha, branch, type } = validation.data;

    const profile = await getGitHubToken(req);
    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authorization check: verify user owns the repository
    if (owner !== profile.github_username) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: can only access your own repositories' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const branchName = branch || 'main';
    console.log(`Deleting ${type === 'dir' ? 'directory' : 'file'}: ${path} on branch: ${branchName}`);

    // For directories, we need to use Git Trees API
    if (type === 'dir') {
      // Get the current branch reference
      const refResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branchName}`,
        {
          headers: {
            'Authorization': `Bearer ${profile.github_access_token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'RepoPush',
          },
        }
      );

      if (!refResponse.ok) {
        const error = await refResponse.text();
        console.error('Failed to get branch reference:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to get branch reference' }),
          { status: refResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const refData = await refResponse.json();
      const currentCommitSha = refData.object.sha;

      // Get the current commit
      const commitResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/commits/${currentCommitSha}`,
        {
          headers: {
            'Authorization': `Bearer ${profile.github_access_token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'RepoPush',
          },
        }
      );

      if (!commitResponse.ok) {
        const error = await commitResponse.text();
        console.error('Failed to get commit:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to get commit' }),
          { status: commitResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const commitData = await commitResponse.json();
      const baseTreeSha = commitData.tree.sha;

      // Get the tree
      const treeResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${baseTreeSha}?recursive=1`,
        {
          headers: {
            'Authorization': `Bearer ${profile.github_access_token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'RepoPush',
          },
        }
      );

      if (!treeResponse.ok) {
        const error = await treeResponse.text();
        console.error('Failed to get tree:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to get tree' }),
          { status: treeResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const treeData = await treeResponse.json();
      
      // Filter out all items in the directory
      const pathPrefix = path.endsWith('/') ? path : `${path}/`;
      const newTree = treeData.tree
        .filter((item: any) => !item.path.startsWith(pathPrefix) && item.path !== path)
        .map((item: any) => ({
          path: item.path,
          mode: item.mode,
          type: item.type,
          sha: item.sha,
        }));

      // Create new tree
      const newTreeResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${profile.github_access_token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'RepoPush',
          },
          body: JSON.stringify({
            tree: newTree,
          }),
        }
      );

      if (!newTreeResponse.ok) {
        const error = await newTreeResponse.text();
        console.error('Failed to create new tree:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to create new tree' }),
          { status: newTreeResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const newTreeData = await newTreeResponse.json();

      // Create new commit
      const newCommitResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/commits`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${profile.github_access_token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'RepoPush',
          },
          body: JSON.stringify({
            message: `Delete directory ${path}`,
            tree: newTreeData.sha,
            parents: [currentCommitSha],
          }),
        }
      );

      if (!newCommitResponse.ok) {
        const error = await newCommitResponse.text();
        console.error('Failed to create commit:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to create commit' }),
          { status: newCommitResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const newCommitData = await newCommitResponse.json();

      // Update branch reference
      const updateRefResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branchName}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${profile.github_access_token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'RepoPush',
          },
          body: JSON.stringify({
            sha: newCommitData.sha,
          }),
        }
      );

      if (!updateRefResponse.ok) {
        const error = await updateRefResponse.text();
        console.error('Failed to update reference:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to update branch' }),
          { status: updateRefResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Directory deleted successfully');
    } else {
      // For files, use the simple contents API
      const deleteBody: Record<string, string> = {
        message: `Delete ${path}`,
        sha: sha,
      };
      
      if (branch) {
        deleteBody.branch = branch;
      }

      const githubResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${profile.github_access_token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'RepoPush',
          },
          body: JSON.stringify(deleteBody),
        }
      );

      if (!githubResponse.ok) {
        const error = await githubResponse.text();
        console.error('Failed to delete file:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to delete file on GitHub' }),
          { status: githubResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('File deleted successfully');
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in delete-file function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
