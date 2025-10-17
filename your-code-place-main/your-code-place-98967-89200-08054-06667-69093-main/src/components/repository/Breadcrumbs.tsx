import { ChevronRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BreadcrumbsProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function Breadcrumbs({ currentPath, onNavigate }: BreadcrumbsProps) {
  const pathSegments = currentPath ? currentPath.split('/').filter(Boolean) : [];

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onNavigate("")}
        className="h-8"
      >
        <Home className="h-4 w-4 mr-1" />
        Root
      </Button>

      {pathSegments.map((segment, index) => {
        const path = pathSegments.slice(0, index + 1).join('/');
        const isLast = index === pathSegments.length - 1;

        return (
          <div key={path} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Button
              variant={isLast ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onNavigate(path)}
              className="h-8"
            >
              {segment}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
