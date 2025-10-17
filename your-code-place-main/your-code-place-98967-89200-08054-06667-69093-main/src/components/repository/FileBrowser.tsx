import { 
  Folder, 
  ChevronRight,
  FileCode, 
  FileImage, 
  FileText, 
  File, 
  Pencil, 
  Trash2,
  FileCog,
  FileJson,
  FileSpreadsheet,
  MoreVertical,
  Download,
  FolderOpen,
  FolderInput,
  CheckSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useRef } from "react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface FileItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: "file" | "dir";
  download_url?: string;
}

interface FileBrowserProps {
  files: FileItem[];
  isLoading: boolean;
  selectedFiles: string[];
  onFileClick: (file: FileItem) => void;
  onEdit: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  onDownload: (file: FileItem) => void;
  onRename: (file: FileItem) => void;
  onMove: (files: FileItem[]) => void;
  onToggleSelect: (path: string) => void;
  onToggleSelectAll: () => void;
}

const getFileIcon = (file: FileItem) => {
  if (file.type === 'dir') return Folder;
  
  const ext = file.name.split('.').pop()?.toLowerCase();
  
  if (['js', 'jsx', 'ts', 'tsx'].includes(ext || '')) {
    return FileCode;
  }
  if (['py', 'java', 'cpp', 'c', 'go', 'rs', 'php', 'rb'].includes(ext || '')) {
    return FileCode;
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico'].includes(ext || '')) {
    return FileImage;
  }
  if (['json', 'xml', 'yaml', 'yml'].includes(ext || '')) {
    return FileJson;
  }
  if (['md', 'txt', 'log'].includes(ext || '')) {
    return FileText;
  }
  if (['csv', 'xlsx', 'xls'].includes(ext || '')) {
    return FileSpreadsheet;
  }
  if (['env', 'config', 'conf'].includes(ext || '')) {
    return FileCog;
  }
  
  return File;
};

const getFileColor = (file: FileItem): string => {
  if (file.type === 'dir') return 'text-accent';
  
  const ext = file.name.split('.').pop()?.toLowerCase();
  
  // JavaScript/TypeScript - yellow
  if (['js', 'jsx', 'ts', 'tsx'].includes(ext || '')) return 'text-[hsl(45,90%,60%)]';
  // Python - blue
  if (['py'].includes(ext || '')) return 'text-[hsl(210,80%,60%)]';
  // Images - purple
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) return 'text-[hsl(280,70%,65%)]';
  // JSON/Config - green
  if (['json', 'yaml', 'yml', 'env', 'config'].includes(ext || '')) return 'text-[hsl(140,60%,55%)]';
  // Markdown/Text - slate
  if (['md', 'txt'].includes(ext || '')) return 'text-[hsl(215,20%,60%)]';
  // Other code - orange
  if (['java', 'cpp', 'c', 'go', 'rs', 'php', 'rb'].includes(ext || '')) return 'text-[hsl(25,90%,60%)]';
  
  return 'text-muted-foreground';
};

const isImageFile = (file: FileItem): boolean => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico'].includes(ext || '');
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

export function FileBrowser({ 
  files, 
  isLoading,
  selectedFiles,
  onFileClick, 
  onEdit, 
  onDelete, 
  onDownload,
  onRename,
  onMove,
  onToggleSelect,
  onToggleSelectAll
}: FileBrowserProps) {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [longPressTriggered, setLongPressTriggered] = useState(false);

  const hasSelection = selectedFiles.length > 0;
  const selectedFileObjects = files.filter(f => selectedFiles.includes(f.path));

  const handleImageError = (fileSha: string) => {
    setImageErrors(prev => new Set([...prev, fileSha]));
  };

  const handleLongPressStart = (file: FileItem) => {
    setLongPressTriggered(false);
    longPressTimer.current = setTimeout(() => {
      setLongPressTriggered(true);
      setSelectedFile(file);
      setDrawerOpen(true);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleItemClick = (file: FileItem, e?: React.MouseEvent) => {
    if (e?.target instanceof HTMLInputElement) return;
    if (longPressTriggered) {
      setLongPressTriggered(false);
      return;
    }
    onFileClick(file);
  };

  const handleActionClick = (file: FileItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(file);
    setDrawerOpen(true);
  };

  const handleDrawerAction = (action: 'edit' | 'delete' | 'download' | 'rename' | 'move') => {
    if (!selectedFile) return;
    
    setDrawerOpen(false);
    
    setTimeout(() => {
      switch (action) {
        case 'edit':
          onEdit(selectedFile);
          break;
        case 'delete':
          onDelete(selectedFile);
          break;
        case 'download':
          onDownload(selectedFile);
          break;
        case 'rename':
          onRename(selectedFile);
          break;
        case 'move':
          onMove([selectedFile]);
          break;
      }
    }, 300);
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="divide-y divide-border">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5">
              <Skeleton className="h-4 w-4 flex-shrink-0" />
              <Skeleton className="h-4 flex-1 max-w-[200px]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <Folder className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="text-sm font-medium mb-1 text-foreground">This folder is empty</p>
        <p className="text-xs text-muted-foreground">
          Add files or create a new folder to get started
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {hasSelection && (
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/50">
            <span className="text-sm text-muted-foreground">
              {selectedFiles.length} item{selectedFiles.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2 ml-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onMove(selectedFileObjects)}
              >
                <FolderInput className="h-4 w-4 mr-2" />
                Move
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => selectedFileObjects.forEach(onDelete)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
          <Checkbox
            checked={selectedFiles.length === files.length}
            onCheckedChange={onToggleSelectAll}
          />
          <span className="text-sm font-medium">Select All</span>
        </div>

        <div className="divide-y divide-border/50">
          {files.map((file) => {
            const Icon = getFileIcon(file);
            const isFolder = file.type === 'dir';
            const fileColor = getFileColor(file);
            const isImage = isImageFile(file);
            const showImagePreview = isImage && file.download_url && !imageErrors.has(file.sha);
            const isSelected = selectedFiles.includes(file.path);

            return (
              <div
                key={file.sha}
                className={`group flex items-center gap-2 px-3 py-1.5 hover:bg-accent/10 active:bg-accent/20 transition-colors select-none ${isSelected ? 'bg-accent/20' : ''}`}
                onTouchStart={() => handleLongPressStart(file)}
                onTouchEnd={handleLongPressEnd}
                onTouchMove={handleLongPressEnd}
                onMouseDown={() => handleLongPressStart(file)}
                onMouseUp={handleLongPressEnd}
                onMouseLeave={handleLongPressEnd}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelect(file.path)}
                  onClick={(e) => e.stopPropagation()}
                />

                {isFolder ? (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                ) : (
                  <div className="w-3.5" />
                )}

                <div 
                  className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer"
                  onClick={(e) => handleItemClick(file, e)}
                >
                  <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                    {showImagePreview ? (
                      <img
                        src={file.download_url}
                        alt={file.name}
                        className="w-4 h-4 object-cover rounded-sm"
                        onError={() => handleImageError(file.sha)}
                      />
                    ) : (
                      <Icon className={`h-4 w-4 ${fileColor}`} />
                    )}
                  </div>

                  <span className="text-sm truncate text-foreground flex-1" title={file.name}>
                    {file.name}
                  </span>
                  {!isFolder && (
                    <span className="text-xs text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatFileSize(file.size)}
                    </span>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleActionClick(file, e)}
                  title="More actions"
                >
                  <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-left">
              {selectedFile?.name}
            </DrawerTitle>
            <DrawerDescription className="text-left">
              {selectedFile?.type === 'dir' 
                ? 'Folder actions' 
                : `${formatFileSize(selectedFile?.size || 0)} • File actions`
              }
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="px-4 pb-4 space-y-2">
            {selectedFile?.type === 'file' && (
              <>
                <Button
                  variant="outline"
                  className="w-full justify-start h-14 text-base"
                  onClick={() => handleDrawerAction('edit')}
                >
                  <Pencil className="h-5 w-5 mr-3" />
                  Edit File
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full justify-start h-14 text-base"
                  onClick={() => handleDrawerAction('download')}
                >
                  <Download className="h-5 w-5 mr-3" />
                  Download
                </Button>
              </>
            )}

            <Button
              variant="outline"
              className="w-full justify-start h-14 text-base"
              onClick={() => handleDrawerAction('rename')}
            >
              <Pencil className="h-5 w-5 mr-3" />
              Rename
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-14 text-base"
              onClick={() => handleDrawerAction('move')}
            >
              <FolderInput className="h-5 w-5 mr-3" />
              Move
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-start h-14 text-base text-destructive hover:text-destructive"
              onClick={() => handleDrawerAction('delete')}
            >
              <Trash2 className="h-5 w-5 mr-3" />
              Delete {selectedFile?.type === 'dir' ? 'Folder' : 'File'}
            </Button>
          </div>

          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline" className="w-full h-12 text-base">
                Cancel
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
