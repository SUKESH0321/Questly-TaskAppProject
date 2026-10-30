import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
      <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-8">
        <Compass size={48} className="text-primary" />
      </div>
      <h1 className="text-7xl font-bold text-primary mb-4">404</h1>
      <h2 className="text-2xl font-bold text-foreground mb-2">Page Not Found</h2>
      <p className="text-muted-foreground max-w-md mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button size="lg" asChild>
        <Link to="/home">
          <Home className="mr-2 h-5 w-5" />
          Back to Home
        </Link>
      </Button>
    </div>
  );
}