import { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface FileItem {
  name: string;
  path: string;
  sha: string;
  type: "file" | "dir";
}

interface MoveItemsDialogProps {
  files: FileItem[];
  owner: string;
  repo: string;
  branch: string;
  currentPath: string;
  onClose: () => void;
  onMove: () => void;
}

export function MoveItemsDialog({
  files,
  owner,
  repo,
  branch,
  currentPath,
  onClose,
  onMove,
}: MoveItemsDialogProps) {
  const [destination, setDestination] = useState("");
  const [folders, setFolders] = useState<string[]>([]);
  const [isMoving, setIsMoving] = useState(false);
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);

  useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    try {
      const { data } = await supabase.functions.invoke('get-repo-contents', {
        body: { owner, repo, path: '', ref: branch }
      });

      if (data?.contents) {
        const allFolders = collectFolders(data.contents, '');
        setFolders(['Root', ...allFolders]);
      }
    } catch (err) {
      console.error('Error fetching folders:', err);
    } finally {
      setIsLoadingFolders(false);
    }
  };

  const collectFolders = (items: any[], prefix: string): string[] => {
    const folders: string[] = [];
    items.forEach(item => {
      if (item.type === 'dir') {
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
        folders.push(fullPath);
      }
    });
    return folders;
  };

  const handleMove = async () => {
    setIsMoving(true);
    try {
      const destinationPath = destination === 'Root' ? '' : destination;
      
      const { error } = await supabase.functions.invoke('move-files', {
        body: {
          owner,
          repo,
          files: files.map(f => ({ path: f.path, sha: f.sha, type: f.type })),
          destination: destinationPath,
          branch,
        }
      });

      if (error) {
        console.error('Error moving items:', error);
        toast({
          title: "Move failed",
          description: "Could not move the items. Please try again.",
          variant: "destructive",
        });
        return;
      }

      onMove();
      toast({
        title: "Moved ✓",
        description: `${files.length} item${files.length > 1 ? 's' : ''} moved successfully.`,
      });
    } catch (err) {
      console.error('Exception moving items:', err);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {files.length} Item{files.length > 1 ? 's' : ''}</DialogTitle>
          <DialogDescription>
            Select a destination folder
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Destination</Label>
            {isLoadingFolders ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading folders...
              </div>
            ) : (
              <Select value={destination} onValueChange={setDestination}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((folder) => (
                    <SelectItem key={folder} value={folder}>
                      {folder}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isMoving}>
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={isMoving || !destination}>
            {isMoving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
