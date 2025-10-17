import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface RenameItemDialogProps {
  file: { name: string; path: string; sha: string; type: "file" | "dir" };
  owner: string;
  repo: string;
  branch: string;
  currentPath: string;
  onClose: () => void;
  onRename: () => void;
}

export function RenameItemDialog({
  file,
  owner,
  repo,
  branch,
  currentPath,
  onClose,
  onRename,
}: RenameItemDialogProps) {
  const [newName, setNewName] = useState(file.name);
  const [isRenaming, setIsRenaming] = useState(false);

  const handleRename = async () => {
    if (!newName || newName === file.name) {
      toast({
        title: "Invalid name",
        description: "Please enter a different name.",
        variant: "destructive",
      });
      return;
    }

    setIsRenaming(true);
    try {
      const newPath = currentPath ? `${currentPath}/${newName}` : newName;
      
      const { error } = await supabase.functions.invoke('rename-file', {
        body: {
          owner,
          repo,
          path: file.path,
          new_path: newPath,
          sha: file.sha,
          branch,
        }
      });

      if (error) {
        console.error('Error renaming item:', error);
        toast({
          title: "Rename failed",
          description: "Could not rename the item. Please try again.",
          variant: "destructive",
        });
        return;
      }

      onRename();
      toast({
        title: "Renamed ✓",
        description: `${file.name} renamed to ${newName}.`,
      });
    } catch (err) {
      console.error('Exception renaming item:', err);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename {file.type === "dir" ? "Folder" : "File"}</DialogTitle>
          <DialogDescription>
            Enter a new name for {file.name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="new-name"
              disabled={isRenaming}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isRenaming}>
            Cancel
          </Button>
          <Button onClick={handleRename} disabled={isRenaming}>
            {isRenaming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
