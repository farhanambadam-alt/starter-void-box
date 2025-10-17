import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Github } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const providerToken = session.provider_token;
        const username = session.user.user_metadata.user_name || session.user.user_metadata.preferred_username;
        const avatarUrl = session.user.user_metadata.avatar_url;

        if (providerToken) {
          // Save token and wait for completion
          (async () => {
            try {
              const { error } = await supabase.rpc('update_user_github_token', {
                user_id: session.user.id,
                access_token: providerToken,
                username: username,
                avatar_url: avatarUrl
              });

              if (error) {
                toast({
                  variant: "destructive",
                  title: "Authentication Failed",
                  description: "Failed to save GitHub credentials. Please try logging in again.",
                });
                return; // Don't navigate - stay on auth page
              }
              
              navigate("/dashboard");
              
              // Clean up OAuth hash from URL
              window.history.replaceState(null, '', window.location.pathname);
              
            } catch (err) {
              toast({
                variant: "destructive",
                title: "Authentication Error",
                description: "An error occurred while saving your credentials. Please try again.",
              });
              // Don't navigate - stay on auth page
            }
          })();
        } else {
          toast({
            variant: "destructive",
            title: "Authentication Error",
            description: "No GitHub token received. Please try logging in again.",
          });
          navigate("/dashboard");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const handleGithubLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        scopes: "repo delete_repo",
      },
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: error.message,
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-elevated gradient-card">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-primary/10 rounded-full shadow-glow">
              <Github className="h-12 w-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">Welcome to RepoPush</CardTitle>
          <CardDescription className="text-base">
            Seamlessly manage your GitHub repositories with an intuitive interface.
            Create, upload, and organize your projects effortlessly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleGithubLogin}
            className="w-full h-12 text-base font-medium transition-smooth hover:shadow-glow"
            size="lg"
          >
            <Github className="mr-2 h-5 w-5" />
            Login with GitHub
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            By continuing, you agree to grant RepoPush access to your GitHub repositories.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
