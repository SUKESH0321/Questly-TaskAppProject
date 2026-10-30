import { Link, useRouteError } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

export default function RouteError() {
  const error = useRouteError() as { status?: number; statusText?: string; message?: string };
  
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
      <div className="w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center mb-8">
        <AlertTriangle size={48} className="text-destructive" />
      </div>
      <h1 className="text-3xl font-bold text-foreground mb-4">Something went wrong</h1>
      <p className="text-muted-foreground max-w-md mb-2">
        {error?.status === 404
          ? "The page you're looking for doesn't exist or has been moved."
          : "An unexpected error occurred while loading this page."}
      </p>
      {error?.status && (
        <p className="text-sm text-muted-foreground mb-8">
          Error {error.status}{error.statusText ? `: ${error.statusText}` : ""}
        </p>
      )}
      <div className="flex gap-4">
        <Button size="lg" onClick={() => window.location.reload()} variant="outline">
          <RefreshCw className="mr-2 h-5 w-5" />
          Try Again
        </Button>
        <Button size="lg" asChild>
          <Link to="/home">
            <Home className="mr-2 h-5 w-5" />
            Back to Home
          </Link>
        </Button>
      </div>
    </div>
  );
}