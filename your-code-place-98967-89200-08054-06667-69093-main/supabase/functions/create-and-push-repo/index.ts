import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { getGitHubToken, createOrGetBranch } from '../_shared/github-helper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { repositoryName, fileMap, importMode, githubUrl, targetBranch } = await req.json();

    if (!repositoryName) {
      return new Response(
        JSON.stringify({ error: 'Repository name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const profile = await getGitHubToken(req);
    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Your GitHub token is invalid or has expired. Please log out and log back in.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const githubToken = profile.github_access_token;
    const owner = profile.github_username;
    const branch = targetBranch || 'main';

    console.log(`Processing repository: ${repositoryName} for user: ${owner}, mode: ${importMode}, branch: ${branch}`);

    // Check if repository exists
    const checkRepoResponse = await fetch(`https://api.github.com/repos/${owner}/${repositoryName}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'RepoPush',
      },
    });

    const repoExists = checkRepoResponse.ok;
    let repoData: any;

    if (repoExists) {
      console.log(`Repository ${repositoryName} already exists`);
      
      if (importMode === 'overwrite') {
        console.log('Overwrite mode: attempting to delete existing repository...');
        const deleteResponse = await fetch(`https://api.github.com/repos/${owner}/${repositoryName}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'RepoPush',
          },
        });
        
        if (deleteResponse.ok) {
          console.log('Repository deleted successfully');
          // Wait for GitHub to process deletion
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else if (deleteResponse.status === 403) {
          const errorText = await deleteResponse.text();
          console.error('Permission denied to delete repository:', errorText);
          return new Response(
            JSON.stringify({ 
              error: 'Cannot overwrite: Missing permissions. Please log out and log back in to grant the required "delete_repo" permission, or manually delete the repository on GitHub first.' 
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          const deleteError = await deleteResponse.text();
          console.error('Failed to delete repository:', deleteError);
          return new Response(
            JSON.stringify({ 
              error: `Failed to delete existing repository: ${deleteResponse.statusText}. Please delete it manually on GitHub or use "Add" mode.` 
            }),
            { status: deleteResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create new repository after deletion
        const createRepoResponse = await fetch('https://api.github.com/user/repos', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'RepoPush',
          },
          body: JSON.stringify({
            name: repositoryName,
            auto_init: true,
            private: false,
          }),
        });

        if (!createRepoResponse.ok) {
          const error = await createRepoResponse.text();
          console.error('Failed to create repository:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to create repository on GitHub' }),
            { status: createRepoResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        repoData = await createRepoResponse.json();
        console.log('Repository created successfully:', repoData.html_url);
        
        // Ensure the target branch exists after recreating repo
        if (branch !== 'main') {
          console.log(`Creating target branch: ${branch} after repo recreation`);
          const branchResult = await createOrGetBranch(owner, repositoryName, branch, githubToken);
          if (!branchResult.success) {
            return new Response(
              JSON.stringify({ error: `Failed to create/access branch: ${branchResult.error}` }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      } else {
        // Add mode: use existing repository
        console.log('Add mode: using existing repository');
      repoData = await checkRepoResponse.json();
      
      // Ensure the target branch exists
      const branchResult = await createOrGetBranch(owner, repositoryName, branch, githubToken);
      if (!branchResult.success) {
        return new Response(
          JSON.stringify({ error: `Failed to create/access branch: ${branchResult.error}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      }
    } else {
      // Repository doesn't exist, create it
      console.log(`Creating new repository: ${repositoryName}`);
      const createRepoResponse = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'RepoPush',
        },
        body: JSON.stringify({
          name: repositoryName,
          auto_init: true,
          private: false,
        }),
      });

      if (!createRepoResponse.ok) {
        const error = await createRepoResponse.text();
        console.error('Failed to create repository:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to create repository on GitHub' }),
          { status: createRepoResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      repoData = await createRepoResponse.json();
      console.log('Repository created successfully:', repoData.html_url);
      
      // Ensure the target branch exists for new repos
      if (branch !== 'main') {
        console.log(`Creating target branch: ${branch}`);
        const branchResult = await createOrGetBranch(owner, repositoryName, branch, githubToken);
        if (!branchResult.success) {
          return new Response(
            JSON.stringify({ error: `Failed to create/access branch: ${branchResult.error}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    let finalFileMap = fileMap;

    // If GitHub URL is provided, fetch the repository contents
    if (githubUrl) {
      console.log('Fetching repository contents from GitHub URL:', githubUrl);
      
      // Parse GitHub URL to extract owner and repo
      const urlMatch = githubUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
      if (!urlMatch) {
        return new Response(
          JSON.stringify({ error: 'Invalid GitHub URL format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const [, sourceOwner, sourceRepo] = urlMatch;
      
      // File limit to prevent timeouts
      const MAX_FILES = 500;
      
      try {
        // Fetch the repository tree recursively
        const treeResponse = await fetch(
          `https://api.github.com/repos/${sourceOwner}/${sourceRepo}/git/trees/main?recursive=1`,
          {
            headers: {
              'Authorization': `Bearer ${githubToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'RepoPush',
            },
          }
        );

        if (!treeResponse.ok) {
          // Try 'master' branch if 'main' doesn't exist
          const masterTreeResponse = await fetch(
            `https://api.github.com/repos/${sourceOwner}/${sourceRepo}/git/trees/master?recursive=1`,
            {
              headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'RepoPush',
              },
            }
          );

          if (!masterTreeResponse.ok) {
            throw new Error('Failed to fetch repository tree');
          }

          const masterTreeData = await masterTreeResponse.json();
          finalFileMap = {};

          // Check file count
          const fileCount = masterTreeData.tree.filter((item: any) => item.type === 'blob').length;
          if (fileCount > MAX_FILES) {
            return new Response(
              JSON.stringify({ 
                error: `Repository is too large (${fileCount} files). Maximum ${MAX_FILES} files allowed. Please use a smaller repository or clone it manually.` 
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Fetch each file's content
          let filesProcessed = 0;
          for (const item of masterTreeData.tree) {
            if (item.type === 'blob' && filesProcessed < MAX_FILES) {
              const fileResponse = await fetch(
                `https://api.github.com/repos/${sourceOwner}/${sourceRepo}/contents/${item.path}`,
                {
                  headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'RepoPush',
                  },
                }
              );

              if (fileResponse.ok) {
                const fileData = await fileResponse.json();
                // Decode base64 content
                finalFileMap[item.path] = atob(fileData.content);
                filesProcessed++;
              }
            }
          }
        } else {
          const treeData = await treeResponse.json();
          finalFileMap = {};

          // Check file count
          const fileCount = treeData.tree.filter((item: any) => item.type === 'blob').length;
          if (fileCount > MAX_FILES) {
            return new Response(
              JSON.stringify({ 
                error: `Repository is too large (${fileCount} files). Maximum ${MAX_FILES} files allowed. Please use a smaller repository or clone it manually.` 
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Fetch each file's content
          let filesProcessed = 0;
          for (const item of treeData.tree) {
            if (item.type === 'blob' && filesProcessed < MAX_FILES) {
              const fileResponse = await fetch(
                `https://api.github.com/repos/${sourceOwner}/${sourceRepo}/contents/${item.path}`,
                {
                  headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'RepoPush',
                  },
                }
              );

              if (fileResponse.ok) {
                const fileData = await fileResponse.json();
                // Decode base64 content
                finalFileMap[item.path] = atob(fileData.content);
                filesProcessed++;
              }
            }
          }
        }

        console.log(`Fetched ${Object.keys(finalFileMap).length} files from source repository`);
      } catch (err) {
        console.error('Error fetching repository contents:', err);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch repository contents from GitHub' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Upload files if we have any
    if (finalFileMap && Object.keys(finalFileMap).length > 0) {
      console.log(`Uploading ${Object.keys(finalFileMap).length} files...`);
      
      for (const [path, content] of Object.entries(finalFileMap)) {
        try {
          // Convert content to base64, handling both text and binary data
          let base64Content: string;
          try {
            // First try direct btoa for text files
            base64Content = btoa(content as string);
          } catch {
            // For binary files, convert using Uint8Array
            const encoder = new TextEncoder();
            const uint8Array = encoder.encode(content as string);
            const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
            base64Content = btoa(binaryString);
          }
          
          const uploadResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repositoryName}/contents/${path}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
              'User-Agent': 'RepoPush',
            },
            body: JSON.stringify({
              message: `Add ${path}`,
              content: base64Content,
              branch: branch, // Push to specified branch
            }),
          }
        );

          if (!uploadResponse.ok) {
            console.error(`Failed to upload ${path}:`, await uploadResponse.text());
          } else {
            console.log(`Successfully uploaded: ${path}`);
          }
        } catch (err) {
          console.error(`Error uploading ${path}:`, err);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        repository_url: repoData.html_url,
        repository_name: repositoryName,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-and-push-repo function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
