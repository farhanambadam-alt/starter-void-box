import { useState, useRef } from "react";
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
import { Progress } from "@/components/ui/progress";
import { Upload, Loader2, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface FileUploaderProps {
  owner: string;
  repo: string;
  branch: string;
  currentPath: string;
  onClose: () => void;
  onUploadComplete: () => void;
}

export function FileUploader({
  owner,
  repo,
  branch,
  currentPath,
  onClose,
  onUploadComplete,
}: FileUploaderProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(filesArray);
      setCommitMessage(`Upload ${filesArray.length} file${filesArray.length > 1 ? 's' : ''}`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const filesArray = Array.from(e.dataTransfer.files);
      setSelectedFiles(filesArray);
      setCommitMessage(`Upload ${filesArray.length} file${filesArray.length > 1 ? 's' : ''}`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const filesData = await Promise.all(
        selectedFiles.map(async (file) => {
          const content = await readFileAsBase64(file);
          const path = currentPath ? `${currentPath}/${file.name}` : file.name;
          return { path, content };
        })
      );

      const { data, error } = await supabase.functions.invoke('upload-files', {
        body: {
          owner,
          repo,
          files: filesData,
          branch,
          message: commitMessage,
        }
      });

      if (error) {
        console.error('Error uploading files:', error);
        toast({
          title: "Upload failed",
          description: "Could not upload files. Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (data?.results) {
        const failed = data.results.filter((r: any) => !r.success);
        if (failed.length > 0) {
          toast({
            title: "Partial upload",
            description: `${failed.length} file(s) failed to upload.`,
            variant: "destructive",
          });
        } else {
          onUploadComplete();
        }
      }
    } catch (err) {
      console.error('Exception uploading files:', err);
      toast({
        title: "Error",
        description: "Something went wrong during upload.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result?.toString().split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">
              Click to browse or drag and drop files
            </p>
            <p className="text-xs text-muted-foreground">
              Upload multiple files at once
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Files ({selectedFiles.length})</Label>
              <div className="max-h-[200px] overflow-auto space-y-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded"
                  >
                    <span className="text-sm truncate flex-1">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      disabled={isUploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="commit-message">Commit Message</Label>
            <Input
              id="commit-message"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Upload files..."
              disabled={isUploading}
            />
          </div>

          {isUploading && (
            <div className="space-y-2">
              <Label>Uploading...</Label>
              <Progress value={uploadProgress} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
          >
            {isUploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Upload {selectedFiles.length > 0 && `(${selectedFiles.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
