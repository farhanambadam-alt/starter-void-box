import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitPullRequest, Loader2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGitHubRepos } from "@/hooks/useGitHubRepos";

const PullRequests = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [username, setUsername] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [headBranch, setHeadBranch] = useState("");
  const [baseBranch, setBaseBranch] = useState("");
  const [prTitle, setPrTitle] = useState("");
  const [prDescription, setPrDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [prUrl, setPrUrl] = useState("");

  const { repos, branches, loadingRepos, loadingBranches, fetchRepos, fetchBranches } = useGitHubRepos();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        fetchProfile(session.user.id);
        fetchRepos();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate("/auth");
      } else if (session) {
        fetchProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("github_username")
      .eq("id", userId)
      .single();

    if (!error && data) {
      setUsername(data.github_username);
    }
  };

  useEffect(() => {
    if (selectedRepo) {
      fetchBranches(selectedRepo);
    }
  }, [selectedRepo]);

  const handleCreatePR = async () => {
    if (!selectedRepo || !headBranch || !baseBranch || !prTitle.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required fields",
      });
      return;
    }

    if (headBranch === baseBranch) {
      toast({
        variant: "destructive",
        title: "Invalid Branches",
        description: "Head and base branches must be different",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-pull-request', {
        body: {
          repositoryName: selectedRepo,
          title: prTitle,
          body: prDescription,
          head: headBranch,
          base: baseBranch,
        },
      });

      if (data?.error) {
        if (data.error.includes('token') || data.error.includes('expired')) {
          throw new Error('Your GitHub session has expired. Please log out and log back in.');
        }
        throw new Error(data.error);
      }
      if (error) throw error;

      setPrUrl(data.pull_request_url);
      
      toast({
        title: "Success!",
        description: "Pull request created successfully",
      });

      // Reset form
      setPrTitle("");
      setPrDescription("");
      setHeadBranch("");
      setBaseBranch("");

    } catch (error: any) {
      console.error('Error creating PR:', error);
      toast({
        variant: "destructive",
        title: "Failed to create pull request",
        description: error.message || "Unable to create pull request. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header username={username} showNav={true} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center">
            <GitPullRequest className="h-16 w-16 mx-auto mb-4 text-primary" />
            <h2 className="text-3xl font-bold mb-2">Create Pull Request</h2>
            <p className="text-muted-foreground">
              Merge your feature branch into another branch
            </p>
          </div>

          <Card className="shadow-elevated gradient-card">
            <CardHeader>
              <CardTitle>Pull Request Details</CardTitle>
              <CardDescription>
                Choose branches and provide details for your pull request
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="repo">Select Repository</Label>
                <Select value={selectedRepo} onValueChange={setSelectedRepo} disabled={loadingRepos}>
                  <SelectTrigger className="bg-secondary">
                    <SelectValue placeholder={loadingRepos ? "Loading repositories..." : "Choose a repository"} />
                  </SelectTrigger>
                  <SelectContent>
                    {repos.map((repo) => (
                      <SelectItem key={repo.name} value={repo.name}>
                        {repo.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedRepo && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="head">Merge From (Head)</Label>
                      <Select value={headBranch} onValueChange={setHeadBranch} disabled={loadingBranches}>
                        <SelectTrigger className="bg-secondary">
                          <SelectValue placeholder="Feature branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch.name} value={branch.name}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="base">Into (Base)</Label>
                      <Select value={baseBranch} onValueChange={setBaseBranch} disabled={loadingBranches}>
                        <SelectTrigger className="bg-secondary">
                          <SelectValue placeholder="Target branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch.name} value={branch.name}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Pull Request Title *</Label>
                    <Input
                      id="title"
                      placeholder="Brief description of changes"
                      value={prTitle}
                      onChange={(e) => setPrTitle(e.target.value)}
                      className="bg-secondary"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Detailed description of the changes..."
                      value={prDescription}
                      onChange={(e) => setPrDescription(e.target.value)}
                      className="bg-secondary min-h-[120px]"
                    />
                  </div>

                  {prUrl && (
                    <div className="p-4 bg-primary/10 rounded-lg flex items-center justify-between">
                      <span className="text-sm">Pull request created!</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(prUrl, '_blank')}
                      >
                        View on GitHub
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  )}

                  <Button
                    onClick={handleCreatePR}
                    disabled={isLoading || !prTitle.trim() || !headBranch || !baseBranch}
                    className="w-full h-12 text-base font-medium transition-smooth hover:shadow-glow"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Creating Pull Request...
                      </>
                    ) : (
                      <>
                        <GitPullRequest className="mr-2 h-5 w-5" />
                        Create Pull Request
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PullRequests;
