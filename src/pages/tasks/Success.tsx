import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TaskSuccess() {
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get("id") || "";

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-8 animate-in zoom-in duration-500">
        <CheckCircle2 size={48} />
      </div>
      
      <h1 className="text-3xl font-bold text-center mb-4">Task Posted Successfully!</h1>
      <p className="text-muted-foreground text-center max-w-md mb-8">
        Your task is now live. Taskers can find it and apply. Check the task page to see applicants, message them and pick one.
      </p>
      
      <div className="bg-card border border-border p-6 rounded-2xl w-full max-w-md mb-8 space-y-4">
        <div className="flex justify-between items-center pb-4 border-b border-border">
          <span className="text-muted-foreground text-sm">Status</span>
          <span className="font-medium text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            Open for applications
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-sm">Task ID</span>
          <span className="font-mono text-sm">#{taskId ? taskId.slice(-6).toUpperCase() : "N/A"}</span>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <Button variant="outline" size="lg" className="flex-1" asChild>
          <Link to="/home">Back to Home</Link>
        </Button>
        <Button size="lg" className="flex-1" asChild>
          <Link to={taskId ? `/tasks/${taskId}` : "/tasks"}>
            View Task <ChevronRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
