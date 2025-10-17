import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      } else {
        setIsLoading(false);
      }
    });
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-2xl mx-auto text-center space-y-8">
        <div className="flex justify-center">
          <div className="p-4 bg-primary/10 rounded-full shadow-glow">
            <Github className="h-16 w-16 text-primary" />
          </div>
        </div>
        
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight">
            Welcome to RepoPush
          </h1>
          <p className="text-xl text-muted-foreground max-w-xl mx-auto">
            Seamlessly manage your GitHub repositories with an intuitive interface.
            Create, upload, and organize your projects effortlessly.
          </p>
        </div>

        <div className="space-y-4">
          <Button
            onClick={() => navigate("/auth")}
            size="lg"
            className="h-12 px-8 text-lg font-medium transition-smooth hover:shadow-glow"
          >
            <Github className="mr-2 h-5 w-5" />
            Get Started
          </Button>
          
          <p className="text-sm text-muted-foreground">
            Connect your GitHub account to start managing repositories
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
