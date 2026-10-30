import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Star,
  Share2,
  ExternalLink,
  CheckCircle2,
  Pencil,
  Check,
  Trash2,
  MessageSquare,
} from "lucide-react";
import { getApiError } from "@/lib/errors";
import { toast } from "sonner";
import { celebrate } from "@/lib/confetti";
import { haptic } from "@/lib/haptics";
import { SearchTimer, ExpiredPanel } from "@/components/shared/SearchTimer";
import { VerifiedBadges } from "@/components/shared/VerifiedBadges";
import { syncServerTime, useServerNow } from "@/lib/serverTime";
import { TaskStepper } from "@/components/shared/TaskStepper";
import { CATEGORIES, CATEGORY_ICONS, categoryStyle } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import api from "@/lib/api";
import { LogoMark } from "@/components/shared/Logo";
import { usePaymentStore } from "@/stores/paymentStore";
import { useAuthStore } from "@/stores/authStore";
import { useTaskStore } from "@/stores/taskStore";
import { PaymentModal } from "@/components/payments/PaymentModal";
import { ReleasePaymentButton } from "@/components/payments/ReleasePaymentButton";
import { EscrowBadge } from "@/components/shared/EscrowBadge";

interface Task {
  id: string;
  title: string;
  category: string;
  description: string;
  budget: number;
  urgencyBonus?: number;
  location: string;
  distance: string;
  time: string;
  date: string;
  imageUrl?: string;
  status: string;
  posterId: string;
  posterName: string;
  posterAvatar?: string;
  posterRating: number;
  workerId?: string;
  workerName?: string;
  workerMarkedDone?: boolean;
  expiresAt?: string | null;
  createdAt?: string;
}

interface Application {
  id: string;
  applicantId: string;
  applicantName: string;
  applicantAvatar?: string;
  applicantRating: number;
  applicantVerified?: boolean;
  applicantDemo?: boolean;
  message: string;
  status: "pending" | "accepted" | "rejected";
}

export default function TaskDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { updateTask, deleteTask } = useTaskStore();
  const [applications, setApplications] = useState<Application[]>([]);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyMessage, setApplyMessage] = useState("");
  const [busyApplicationId, setBusyApplicationId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReposting, setIsReposting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const payment = usePaymentStore((s) =>
    task ? s.getPayment(task.id) : undefined,
  );
  const fetchPayment = usePaymentStore((s) => s.fetchPayment);
  const safeTask = task ?? null;
  // Budget plus the optional urgency tip: what the poster pays into escrow.
  const payTotal = (safeTask?.budget || 0) + (safeTask?.urgencyBonus || 0);

  const isPoster = !!user && !!safeTask && user.id === safeTask.posterId;
  const isWorker = !!user && !!safeTask && user.id === safeTask.workerId;
  const myApplication = applications.find((a) => a.applicantId === user?.id);
  const canApply =
    !!user &&
    !!safeTask &&
    !isPoster &&
    !isWorker &&
    !myApplication &&
    (user.role === "tasker" || user.role === "both") &&
    (!user.kycRequired || user.kycStatus === "verified") &&
    safeTask.status === "open";

  // Edit form state
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    category: "",
    budget: 0,
    location: "",
    time: "",
    date: "",
  });

  const openEditModal = () => {
    if (!safeTask) return;
    setEditForm({
      title: safeTask.title,
      description: safeTask.description,
      category: safeTask.category,
      budget: safeTask.budget,
      location: safeTask.location,
      time: safeTask.time,
      date: safeTask.date,
    });
    setEditError(null);
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!safeTask) return;
    setIsSavingEdit(true);
    setEditError(null);
    try {
      const updated = await updateTask(safeTask.id, {
        title: editForm.title,
        description: editForm.description,
        category: editForm.category,
        budget: editForm.budget,
        location: editForm.location,
        time: editForm.time,
        date: editForm.date,
      });
      setTask(updated);
      setEditModalOpen(false);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response: { data?: { error?: string } } }).response?.data
              ?.error
          : undefined;
      setEditError(message || "Failed to update task. Please try again.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleShare = async () => {
    if (!safeTask) return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: safeTask.title, text: `${safeTask.title} on Questly`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setInfo("Link copied to clipboard.");
        setTimeout(() => setInfo(null), 3000);
      }
    } catch {
      // The user dismissed the share sheet: nothing to do.
    }
  };

  const handleRepost = async (minutes: number) => {
    if (!id) return;
    setIsReposting(true);
    setActionError(null);
    try {
      await api.post(`/tasks/${id}/repost`, { searchMinutes: minutes });
      toast.success("Task reposted. We're looking for a tasker again");
      await loadTask();
    } catch (err: unknown) {
      setActionError(getApiError(err, "Couldn't repost this task."));
    } finally {
      setIsReposting(false);
    }
  };

  // Re-fetches the task, its applications and payment so every action leaves
  // the page showing the real server state.
  const loadTask = useCallback(async () => {
    if (!id) {
      setError("No task ID provided");
      setIsLoading(false);
      return;
    }
    try {
      const res = await api.get(`/tasks/${id}`);
      const fetchedTask = res.data?.task;
      syncServerTime(res.data?.serverNow);
      if (!fetchedTask) {
        setError("Task not found");
        return;
      }
      setTask(fetchedTask);
      setError(null);
      fetchPayment(fetchedTask.id);
      api
        .get(`/tasks/${id}/applications`)
        .then((r) => setApplications(r.data?.applications ?? []))
        .catch(() => setApplications([]));
    } catch (err) {
      setError("Task not found");
      console.error("Failed to fetch task", err);
    } finally {
      setIsLoading(false);
    }
  }, [id, fetchPayment]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  // When the countdown hits zero the server decides what happens next (expire or
  // remind). Poll briefly until the task state changes so the page follows.
  const nowMs = useServerNow();
  const timerEnded = !!task?.expiresAt && task.status === "open" && Date.parse(task.expiresAt) <= nowMs;
  useEffect(() => {
    if (!timerEnded) return;
    const poll = setInterval(loadTask, 4000);
    return () => clearInterval(poll);
  }, [timerEnded, loadTask]);

  const handleApply = async () => {
    if (!safeTask) return;
    setIsApplying(true);
    setApplyError(null);
    try {
      const res = await api.post(`/tasks/${safeTask.id}/apply`, {
        message: applyMessage.trim(),
      });
      toast.success("Application sent");
      void haptic("light");
      setApplyDialogOpen(false);
      setApplyMessage("");
      navigate(`/messages?conversationId=${res.data.conversationId}`);
    } catch (err: unknown) {
      setApplyError(getApiError(err, "Failed to apply for this task."));
      loadTask();
    } finally {
      setIsApplying(false);
    }
  };

  const handleAccept = async (application: Application) => {
    if (!safeTask) return;
    setBusyApplicationId(application.id);
    setActionError(null);
    try {
      await api.post(`/tasks/${safeTask.id}/applications/${application.id}/accept`);
      toast.success(`${application.applicantName} is now your tasker`);
      void haptic("success");
      await loadTask();
    } catch (err: unknown) {
      setActionError(getApiError(err, "Failed to accept this applicant."));
      loadTask();
    } finally {
      setBusyApplicationId(null);
    }
  };

  const handleMessageApplicant = async (application: Application) => {
    setActionError(null);
    try {
      const res = await api.post("/conversations", { userId: application.applicantId });
      navigate(`/messages?conversationId=${res.data.conversation.id}`);
    } catch (err: unknown) {
      setActionError(getApiError(err, "Couldn't open the conversation."));
    }
  };

  const handleMarkDone = async () => {
    if (!safeTask) return;
    setIsUpdatingStatus(true);
    setActionError(null);
    try {
      const res = await api.post(`/tasks/${safeTask.id}/done`);
      setTask(res.data.task);
      toast.success("Marked as done. The poster has been notified");
    } catch (err: unknown) {
      setActionError(getApiError(err, "Failed to mark the work as done."));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!safeTask) return;
    if (!window.confirm("Delete this task? This cannot be undone.")) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      await deleteTask(safeTask.id);
      navigate("/profile", { replace: true });
    } catch (err: unknown) {
      setActionError(getApiError(err, "Failed to delete this task."));
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-16 h-16 rounded-full bg-muted animate-pulse mb-4" />
        <div className="h-6 bg-muted rounded w-48 animate-pulse mb-2" />
        <div className="h-4 bg-muted rounded w-64 animate-pulse" />
      </div>
    );
  }

  if (error || !safeTask) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <MapPin size={32} className="text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          Task not found
        </h2>
        <p className="text-muted-foreground mb-4">
          This task doesn't exist or has been removed.
        </p>
        <Button asChild>
          <Link to="/tasks">Browse Tasks</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Hero Image */}
      <div className="relative h-64 md:h-80 w-full bg-muted">
        {safeTask.imageUrl ? (
          <img
            src={safeTask.imageUrl}
            alt={safeTask.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${categoryStyle(safeTask.category).gradient} flex items-center justify-center`}>
            {(() => {
              const HeroIcon = CATEGORY_ICONS[safeTask.category] ?? CATEGORY_ICONS.Other;
              return <HeroIcon size={96} className="text-white/90 drop-shadow" strokeWidth={1.4} />;
            })()}
          </div>
        )}
        <div className="absolute top-4 left-4 flex gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full shadow-md"
            asChild
          >
            <Link to="/tasks">
              <ArrowLeft size={20} />
            </Link>
          </Button>
        </div>
        <div className="absolute top-4 right-4 flex gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full shadow-md"
            aria-label="Share this task"
            onClick={handleShare}
          >
            <Share2 size={20} />
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-6 -mt-10 relative z-10">
        <div className="bg-card rounded-3xl shadow-xl shadow-primary/5 border border-border p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                  {safeTask.category || "General"}
                </Badge>
                {safeTask.status === "open" && (
                  <Badge
                    variant="outline"
                    className="text-amber-500 border-amber-500/30 bg-amber-500/5"
                  >
                    Open
                  </Badge>
                )}
                {safeTask.status === "in_progress" && (
                  <Badge
                    variant="outline"
                    className="text-blue-500 border-blue-500/30 bg-blue-500/5"
                  >
                    In Progress
                  </Badge>
                )}
                {safeTask.status === "completed" && (
                  <Badge
                    variant="outline"
                    className="text-accent border-accent/30 bg-accent/5"
                  >
                    Completed
                  </Badge>
                )}
                {safeTask.status === "expired" && (
                  <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5">
                    Expired
                  </Badge>
                )}
                {payment && <EscrowBadge status={payment.status} />}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {safeTask.title || "Untitled task"}
              </h1>
              {safeTask.workerName && (
                <p className="text-sm text-muted-foreground mt-1">
                  Assigned to: <span className="font-medium text-foreground">{safeTask.workerName}</span>
                </p>
              )}
            </div>

            <div className="flex flex-col items-start md:items-end gap-2">
              <div className="text-left md:text-right">
                <div className="text-sm text-muted-foreground mb-1">Budget</div>
                <div className="text-3xl font-bold text-primary">
                  ₹{safeTask.budget || 0}
                </div>
                {!!safeTask.urgencyBonus && (
                  <div className="mt-1 text-sm font-bold text-accent">+ ₹{safeTask.urgencyBonus} urgent tip</div>
                )}
              </div>
              {isPoster && safeTask.status === "open" && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={openEditModal}>
                    <Pencil size={14} className="mr-1" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    <Trash2 size={14} className="mr-1" />
                    {isDeleting ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {safeTask.status === "open" && safeTask.expiresAt && (
            <SearchTimer
              expiresAt={safeTask.expiresAt}
              startedAt={safeTask.createdAt}
              applicants={applications.length}
              isPoster={isPoster}
            />
          )}

          {safeTask.status === "expired" &&
            (isPoster ? (
              <ExpiredPanel onRepost={handleRepost} onDelete={handleDelete} busy={isReposting || isDeleting} />
            ) : (
              <div className="mb-6 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                This task's search window ended and it is no longer taking applications.
              </div>
            ))}

          {safeTask.status !== "expired" && (
          <div className="mb-6 rounded-2xl border border-border/70 bg-muted/40 p-4 sm:p-5">
            <TaskStepper
              status={safeTask.status}
              hasWorker={!!safeTask.workerId}
              paymentStatus={payment?.status}
              workerMarkedDone={safeTask.workerMarkedDone}
            />
          </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 border-y border-border mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0">
                <MapPin />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Location</h3>
                <p className="text-sm text-muted-foreground">
                  {safeTask.location || "Location unavailable"}
                </p>
                {safeTask.location && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(safeTask.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary font-medium mt-1 inline-flex items-center gap-1 hover:underline"
                  >
                    Open in Maps <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0">
                <Calendar />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Date & Time</h3>
                <p className="text-sm text-muted-foreground">
                  {safeTask.time || "Time TBD"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {safeTask.date || "Date TBD"}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-3">Description</h2>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {safeTask.description || "No description provided."}
              </p>
            </div>

            {/* Applicants (Poster only, while open) */}
            {isPoster && safeTask.status === "open" && (
              <div>
                <h2 className="text-xl font-bold mb-4">
                  Applicants ({applications.length})
                </h2>
                {applications.length === 0 ? (
                  <div className="p-4 rounded-2xl border border-border bg-muted/30 text-sm text-muted-foreground">
                    No one has applied yet. Taskers who apply will show up here so you can pick one.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {applications.map((app) => (
                      <div
                        key={app.id}
                        className="p-4 rounded-2xl border border-border bg-muted/30 flex flex-col gap-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            className="flex items-center gap-3 text-left min-w-0"
                            onClick={() => navigate(`/profile/${app.applicantId}`)}
                          >
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={app.applicantAvatar} />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {app.applicantName
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{app.applicantName}</p>
                              <VerifiedBadges id={app.applicantVerified} demo={app.applicantDemo} />
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Star size={12} className="fill-current text-amber-500" />
                                {(app.applicantRating || 0).toFixed(1)}
                              </p>
                            </div>
                          </button>
                          <div className="flex gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMessageApplicant(app)}
                            >
                              <MessageSquare size={14} className="mr-1" /> Message
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleAccept(app)}
                              disabled={busyApplicationId !== null}
                            >
                              <Check size={14} className="mr-1" />
                              {busyApplicationId === app.id ? "Accepting..." : "Accept"}
                            </Button>
                          </div>
                        </div>
                        {app.message && (
                          <p className="text-sm text-muted-foreground whitespace-pre-line">
                            {app.message}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Applicant's own status */}
            {!isPoster && !isWorker && myApplication && (
              <div className="p-4 rounded-2xl border border-border bg-muted/30 text-sm">
                {myApplication.status === "pending" &&
                  "You've applied for this task. The poster will review your application."}
                {myApplication.status === "accepted" && "Your application was accepted."}
                {myApplication.status === "rejected" &&
                  "The poster chose another tasker for this task."}
              </div>
            )}

            {/* Payment / Escrow Section (Poster only) */}
            {isPoster && safeTask.status !== "open" && (
              <div>
                <h2 className="mb-4 flex items-center gap-3 text-xl font-bold"><LogoMark size={48} /> Payment</h2>
                <div className="p-4 rounded-2xl border border-border bg-muted/30 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {!payment && "Pay into escrow to start the work. The tasker is paid only when you release it."}
                      {payment?.status === "pending" &&
                        "Payment is being processed."}
                      {payment?.status === "held" &&
                        (safeTask.workerMarkedDone
                          ? `${safeTask.workerName || "The tasker"} says the work is done. Release the payment to complete the task.`
                          : "Payment is held in escrow until you release it.")}
                      {payment?.status === "released" &&
                        "Payment has been released to the tasker."}
                      {payment?.status === "refunded" && "Payment was refunded."}
                      {payment?.status === "disputed" &&
                        "Payment is under dispute."}
                    </p>
                  </div>

                  {!payment && safeTask.workerId && (
                    <Button onClick={() => setPaymentModalOpen(true)}>
                      Pay & Confirm ₹{payTotal}
                    </Button>
                  )}

                  {payment?.status === "held" && (
                    <ReleasePaymentButton
                      taskId={safeTask.id}
                      onSuccess={() => {
                        toast.success("Payment released. Task complete!");
                        void celebrate();
                        loadTask();
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Worker section */}
            {isWorker && safeTask.status === "in_progress" && (
              <div>
                <h2 className="text-xl font-bold mb-4">Your Work</h2>
                <div className="p-4 rounded-2xl border border-border bg-muted/30 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <p className="text-sm text-muted-foreground">
                    {safeTask.workerMarkedDone
                      ? "You've marked the work as done. Waiting for the poster to release your payment."
                      : payment?.status === "held"
                        ? "Payment is secured in escrow. Mark the work as done when you finish."
                        : "You're assigned to this task. The poster still needs to pay into escrow."}
                  </p>
                  {!safeTask.workerMarkedDone && (
                    <Button onClick={handleMarkDone} disabled={isUpdatingStatus}>
                      <Check size={14} className="mr-1" />
                      {isUpdatingStatus ? "Updating..." : "Mark Work Done"}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {info && (
              <div className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
                {info}
              </div>
            )}

            {actionError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {actionError}
              </div>
            )}

            <div>
              <h2 className="text-xl font-bold mb-4">Posted By</h2>
              <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/30">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                    <AvatarImage src={safeTask.posterAvatar} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {(safeTask.posterName || "Task poster")
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-semibold flex items-center gap-1">
                      {safeTask.posterName || "Task poster"}
                    </h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center text-amber-500">
                        <Star size={14} className="fill-current" />
                        <span className="ml-1 font-medium text-foreground">
                          {(safeTask.posterRating || 0).toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    safeTask.posterId === user?.id
                      ? navigate("/profile")
                      : navigate(`/profile/${safeTask.posterId}`)
                  }
                >
                  View Profile
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!!user && !isPoster && !isWorker && !myApplication && safeTask.status === "open" && (user.role === "tasker" || user.role === "both") && user.kycRequired && user.kycStatus !== "verified" && (
        <div className="max-w-4xl mx-auto px-4 md:px-6 mt-4">
          <div className="rounded-lg border border-sun bg-sun/15 px-4 py-3 text-sm">
            Verify your identity to apply for tasks. <Link to="/settings#verification" className="text-primary font-semibold hover:underline">Go to verification</Link>
          </div>
        </div>
      )}

      {!!user && !isPoster && !isWorker && !myApplication && safeTask.status === "open" && user.role === "customer" && (
        <div className="max-w-4xl mx-auto px-4 md:px-6 mt-4">
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            You're signed up as a customer. <Link to="/settings#role" className="text-primary font-medium hover:underline">Switch to tasker in Settings</Link> to apply for tasks.
          </div>
        </div>
      )}

      {applyError && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 md:bottom-28 z-[60] max-w-sm w-[calc(100%-2rem)]">
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-lg">
            {applyError}
          </div>
        </div>
      )}

      {/* Floating Apply Action (mobile) */}
      {canApply && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-card/80 backdrop-blur-md border-t border-border z-50 md:hidden">
          <Button
            size="lg"
            className="w-full text-lg shadow-lg shadow-primary/25"
            onClick={() => { setApplyError(null); setApplyDialogOpen(true); }}
            disabled={isApplying}
          >
            {isApplying
              ? "Applying..."
              : `Apply for ₹${safeTask.budget || 0}`}
          </Button>
        </div>
      )}

      {/* Desktop Apply Action */}
      {canApply && (
        <div className="hidden md:block fixed bottom-8 right-8 z-50">
          <Button
            size="lg"
            className="rounded-full px-8 py-6 text-lg shadow-xl shadow-primary/30 flex items-center gap-2 hover:scale-105 transition-transform"
            onClick={() => { setApplyError(null); setApplyDialogOpen(true); }}
            disabled={isApplying}
          >
            <CheckCircle2 />
            {isApplying ? "Applying..." : "Apply for Task"}
          </Button>
        </div>
      )}

      <PaymentModal
        taskId={safeTask.id}
        amount={payTotal}
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        onSuccess={() => {
          toast.success("Payment secured in escrow");
          void haptic("success");
          loadTask();
        }}
      />

      {/* Apply Dialog */}
      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for this task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Tell {safeTask.posterName || "the poster"} why you are a good fit. They will review all applicants and pick one.
            </p>
            <textarea
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[100px]"
              placeholder="Optional message..."
              maxLength={1000}
              value={applyMessage}
              onChange={(e) => setApplyMessage(e.target.value)}
            />
            {applyError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {applyError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyDialogOpen(false)} disabled={isApplying}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={isApplying}>
              {isApplying ? "Sending..." : "Send Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Task Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Title</label>
              <Input
                value={editForm.title}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <textarea
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[100px]"
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Category</label>
              <select
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={editForm.category}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, category: e.target.value }))
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Budget (₹)</label>
              <Input
                type="number"
                value={editForm.budget}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    budget: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Location</label>
              <Input
                value={editForm.location}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, location: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Time</label>
                <Input
                  value={editForm.time}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, time: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Date</label>
                <Input
                  type="date"
                  value={/^\d{4}-\d{2}-\d{2}$/.test(editForm.date) ? editForm.date : ""}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, date: e.target.value }))
                  }
                />
              </div>
            </div>

            {editError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {editError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditModalOpen(false)}
              disabled={isSavingEdit}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
              {isSavingEdit ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}