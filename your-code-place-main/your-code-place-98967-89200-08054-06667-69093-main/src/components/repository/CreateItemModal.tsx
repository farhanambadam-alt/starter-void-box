import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface CreateItemModalProps {
  owner: string;
  repo: string;
  branch: string;
  currentPath: string;
  onClose: () => void;
  onCreate: () => void;
}

export function CreateItemModal({
  owner,
  repo,
  branch,
  currentPath,
  onClose,
  onCreate,
}: CreateItemModalProps) {
  const [itemType, setItemType] = useState<"file" | "folder">("file");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the file or folder.",
        variant: "destructive",
      });
      return;
    }

    // Validate name
    if (/[<>:"/\\|?*]/.test(name)) {
      toast({
        title: "Invalid name",
        description: "File name contains invalid characters.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const path = currentPath ? `${currentPath}/${name}` : name;
      const fileContent = itemType === "folder" ? "" : content;
      const filePath = itemType === "folder" ? `${path}/.gitkeep` : path;

      const { data, error } = await supabase.functions.invoke('create-file', {
        body: {
          owner,
          repo,
          path: filePath,
          content: fileContent,
          message: `Create ${itemType === "folder" ? "folder" : "file"} ${name}`,
          branch,
        }
      });

      if (error) {
        console.error('Error creating item:', error);
        toast({
          title: "Creation failed",
          description: error.message?.includes('already exists')
            ? "A file or folder with this name already exists."
            : "Could not create the item. Please try again.",
          variant: "destructive",
        });
        return;
      }

      onCreate();
    } catch (err) {
      console.error('Exception creating item:', err);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Item</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <RadioGroup value={itemType} onValueChange={(v) => setItemType(v as "file" | "folder")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="file" id="file" />
                <Label htmlFor="file" className="cursor-pointer">File</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="folder" id="folder" />
                <Label htmlFor="folder" className="cursor-pointer">Folder</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={itemType === "folder" ? "folder-name" : "file.txt"}
              disabled={isCreating}
            />
          </div>

          {itemType === "file" && (
            <div className="space-y-2">
              <Label htmlFor="content">Content (optional)</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="File content..."
                className="font-mono text-sm min-h-[200px]"
                disabled={isCreating}
              />
            </div>
          )}

          {itemType === "folder" && (
            <p className="text-sm text-muted-foreground">
              A .gitkeep file will be created inside the folder to make it visible in Git.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create {itemType}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
