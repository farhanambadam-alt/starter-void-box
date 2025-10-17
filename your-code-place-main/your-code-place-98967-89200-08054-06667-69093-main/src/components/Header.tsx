import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Github } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface HeaderProps {
  username?: string | null;
  showNav?: boolean;
}

export const Header = ({ username, showNav = false }: HeaderProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "Error signing out",
        description: error.message,
      });
    } else {
      navigate("/auth");
    }
  };

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Github className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            RepoPush
          </h1>
        </div>
        
        {showNav && username && (
          <nav className="flex items-center gap-4" data-tutorial="navigation">
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
              data-tutorial="new-repo"
            >
              Push
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/repositories")}
            >
              Repositories
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/pull-requests")}
            >
              Pull Requests
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/sync")}
            >
              Sync
            </Button>
            <Button
              variant="outline"
              onClick={handleLogout}
            >
              Logout
            </Button>
          </nav>
        )}
      </div>
    </header>
  );
};
