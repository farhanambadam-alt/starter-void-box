import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { GitBranch, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface BranchSelectorProps {
  owner: string;
  repo: string;
  currentBranch: string;
  onBranchChange: (branch: string) => void;
}

export function BranchSelector({ 
  owner, 
  repo, 
  currentBranch, 
  onBranchChange 
}: BranchSelectorProps) {
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (repo) {
      fetchBranches();
    }
  }, [owner, repo]);

  const fetchBranches = async () => {
    if (!repo) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-repo-branches', {
        body: { repositoryName: repo }
      });

      if (error) {
        console.error('Error fetching branches:', error);
        toast({
          title: "Failed to load branches",
          description: "Could not fetch repository branches.",
          variant: "destructive",
        });
        return;
      }

      if (data?.branches) {
        setBranches(data.branches.map((b: any) => b.name));
      }
    } catch (err) {
      console.error('Exception fetching branches:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 min-w-[200px]">
      <GitBranch className="h-4 w-4 text-muted-foreground" />
      {isLoading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : (
        <Select value={currentBranch} onValueChange={onBranchChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select branch" />
          </SelectTrigger>
          <SelectContent>
            {branches.map((branch) => (
              <SelectItem key={branch} value={branch}>
                {branch}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
