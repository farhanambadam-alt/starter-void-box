import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const repoSettingsSchema = z.object({
  description: z.string().max(350, "Description must be less than 350 characters").optional(),
  homepage: z.string().max(255, "Homepage URL must be less than 255 characters").optional(),
  private: z.boolean(),
  default_branch: z.string().optional(),
  topics: z.string().optional(),
});

type RepoSettingsForm = z.infer<typeof repoSettingsSchema>;

interface Repository {
  name: string;
  full_name: string;
  description: string | null;
  homepage: string | null;
  private: boolean;
  default_branch?: string;
  topics?: string[];
}

interface RepositorySettingsDialogProps {
  repo: Repository | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export const RepositorySettingsDialog = ({
  repo,
  open,
  onOpenChange,
  onUpdate,
}: RepositorySettingsDialogProps) => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<RepoSettingsForm>({
    resolver: zodResolver(repoSettingsSchema),
    values: repo ? {
      description: repo.description || "",
      homepage: repo.homepage || "",
      private: repo.private,
      default_branch: repo.default_branch || "",
      topics: repo.topics?.join(", ") || "",
    } : undefined,
  });

  useEffect(() => {
    if (repo && open) {
      fetchBranches();
    }
  }, [repo, open]);

  const fetchBranches = async () => {
    if (!repo) return;
    try {
      const [owner, repoName] = repo.full_name.split('/');
      const { data, error } = await supabase.functions.invoke('get-repo-branches', {
        body: { owner, repo: repoName }
      });
      if (!error && data) {
        setBranches(data.map((b: any) => b.name));
      }
    } catch (err) {
      console.error('Error fetching branches:', err);
    }
  };

  const isPrivate = watch("private");

  const onSubmit = async (data: RepoSettingsForm) => {
    if (!repo) return;

    setIsSaving(true);
    try {
      const [owner, repoName] = repo.full_name.split('/');
      
      // Prepare topics array
      const topicsArray = data.topics 
        ? data.topics.split(',').map(t => t.trim()).filter(Boolean)
        : [];

      const { error } = await supabase.functions.invoke('update-repo', {
        body: {
          owner,
          repo: repoName,
          description: data.description || "",
          homepage: data.homepage || "",
          private: data.private,
          default_branch: data.default_branch || repo.default_branch,
          topics: topicsArray,
        }
      });

      if (error) throw error;

      toast({
        title: "Settings updated",
        description: "Repository settings have been saved successfully",
      });

      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update repository settings",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRepo = async () => {
    if (!repo) return;
    
    setIsDeleting(true);
    try {
      const [owner, repoName] = repo.full_name.split('/');
      const { error } = await supabase.functions.invoke('delete-repo', {
        body: { owner, repo: repoName }
      });

      if (error) throw error;

      toast({
        title: "Repository deleted",
        description: `${repo.name} has been permanently deleted`,
      });

      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete repository",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Repository Settings</DialogTitle>
          <DialogDescription>
            Update settings for {repo?.name}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="A short description of your repository"
              {...register("description")}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="homepage">Homepage URL</Label>
            <Input
              id="homepage"
              type="url"
              placeholder="https://example.com"
              {...register("homepage")}
            />
            {errors.homepage && (
              <p className="text-sm text-destructive">{errors.homepage.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="default_branch">Default Branch</Label>
            <Select
              value={watch("default_branch") || repo?.default_branch}
              onValueChange={(value) => setValue("default_branch", value)}
            >
              <SelectTrigger id="default_branch">
                <SelectValue placeholder="Select default branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch} value={branch}>
                    {branch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The default branch for pull requests and code commits
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="topics">Topics</Label>
            <Input
              id="topics"
              placeholder="react, typescript, web (comma-separated)"
              {...register("topics")}
            />
            <p className="text-xs text-muted-foreground">
              Add topics to help people find your repository
            </p>
          </div>

          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor="private">Private Repository</Label>
              <p className="text-sm text-muted-foreground">
                {isPrivate ? "Only you can see this repository" : "Anyone can see this repository"}
              </p>
            </div>
            <Switch
              id="private"
              checked={isPrivate}
              onCheckedChange={(checked) => setValue("private", checked)}
            />
          </div>

          <Separator className="my-6" />

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h3 className="font-semibold text-destructive">Danger Zone</h3>
            </div>
            
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Delete this repository</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Once deleted, it will be gone forever. Please be certain.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDangerZone(true)}
                  disabled={showDangerZone}
                >
                  Delete Repository
                </Button>
              </div>

              {showDangerZone && (
                <div className="mt-4 pt-4 border-t border-destructive/20">
                  <p className="text-sm font-medium mb-2">
                    Type <code className="px-1 py-0.5 bg-muted rounded">{repo?.name}</code> to confirm deletion:
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder={repo?.name}
                      onChange={(e) => {
                        if (e.target.value === repo?.name) {
                          e.target.dataset.confirmed = "true";
                        } else {
                          delete e.target.dataset.confirmed;
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDeleteRepo}
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Deleting..." : "I understand, delete"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
