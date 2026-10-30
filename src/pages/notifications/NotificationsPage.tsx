import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Hourglass, IndianRupee, MessageSquare, Sparkles, Star, UserPlus, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SlidingTabs } from "@/components/ui/SlidingTabs";
import { EmptyState } from "@/components/shared/EmptyState";
import api from "@/lib/api";
import { formatRelativeTime } from "@/lib/time";

interface Notification {
  id: string;
  type: "application" | "message" | "payment" | "review" | "status" | "system";
  title: string;
  description: string;
  time: string;
  createdAt?: string;
  link?: string;
  read: boolean;
}

const TYPE_META: Record<Notification["type"], { icon: LucideIcon; tone: string }> = {
  application: { icon: UserPlus, tone: "text-primary bg-primary/10" },
  message: { icon: MessageSquare, tone: "text-sky-600 bg-sky-500/10 dark:text-sky-300" },
  payment: { icon: IndianRupee, tone: "text-accent bg-accent/12" },
  review: { icon: Star, tone: "text-amber-600 bg-amber-500/12 dark:text-amber-300" },
  status: { icon: BadgeCheck, tone: "text-violet-600 bg-violet-500/10 dark:text-violet-300" },
  system: { icon: Sparkles, tone: "text-muted-foreground bg-muted" },
};

/** Buckets by calendar day so the feed reads like a timeline. */
function dayBucket(iso?: string): string {
  if (!iso) return "Earlier";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Earlier";
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(new Date()) - startOf(d)) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This week";
  return "Earlier";
}

const BUCKET_ORDER = ["Today", "Yesterday", "This week", "Earlier"];

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      const res = await api.get("/notifications");
      setNotifications(res.data.notifications);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
      setError("We couldn't load your notifications right now.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const visible = filter === "all" ? notifications : notifications.filter((n) => !n.read);

  const groups = useMemo(() => {
    const map = new Map<string, Notification[]>();
    for (const n of visible) {
      const key = dayBucket(n.createdAt);
      map.set(key, [...(map.get(key) ?? []), n]);
    }
    return BUCKET_ORDER.filter((b) => map.has(b)).map((b) => ({ label: b, items: map.get(b)! }));
  }, [visible]);

  const notifyChanged = () => window.dispatchEvent(new Event("questly:notifications-changed"));

  // Optimistic: flip locally first, roll back if the server refuses.
  const markAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await api.patch(`/notifications/${id}/read`);
      notifyChanged();
    } catch {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
      toast.error("Couldn't update that notification.");
    }
  };

  const markAllAsRead = async () => {
    const before = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api.patch("/notifications/read-all");
      notifyChanged();
      toast.success("All caught up");
    } catch {
      setNotifications(before);
      toast.error("Couldn't mark all as read.");
    }
  };

  const open = (n: Notification) => {
    if (!n.read) void markAsRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 pt-6 md:px-8 md:pt-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="label-mono">Inbox</p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight md:text-5xl">Notifications</h1>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            Mark all read
          </Button>
        )}
      </div>

      <SlidingTabs
        group="notifs"
        className="mt-6"
        value={filter}
        onChange={(v) => setFilter(v as "all" | "unread")}
        tabs={[
          { id: "all", label: "All", count: notifications.length },
          { id: "unread", label: "Unread", count: unreadCount },
        ]}
      />

      <div className="pt-6">
        {error && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}{" "}
            <button className="font-semibold underline" onClick={load}>
              Retry
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState art="bell" title={filter === "unread" ? "Nothing unread" : "No notifications yet"}>
            {filter === "unread"
              ? "You've read everything. Nice and tidy."
              : "Applications, payments, messages and task updates will land here."}
          </EmptyState>
        ) : (
          <div className="space-y-8">
            {groups.map((g) => (
              <section key={g.label}>
                <h2 className="label-mono mb-2">{g.label}</h2>
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                  <AnimatePresence initial={false}>
                    {g.items.map((n) => {
                      const meta = TYPE_META[n.type] ?? TYPE_META.system;
                      const Icon = n.type === "status" && /No one picked/i.test(n.title) ? Hourglass : meta.icon;
                      return (
                        <motion.li key={n.id} layout exit={{ opacity: 0, height: 0 }}>
                          <button
                            onClick={() => open(n)}
                            className={`group relative flex w-full items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/60 md:px-5 ${n.read ? "" : "bg-primary/[0.04]"}`}
                          >
                            {!n.read && <span className="absolute inset-y-0 left-0 w-[3px] bg-primary" aria-hidden="true" />}
                            <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
                              <Icon size={17} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={`block text-[15px] leading-snug ${n.read ? "font-semibold" : "font-extrabold"}`}>{n.title}</span>
                              <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{n.description}</span>
                            </span>
                            <span className="shrink-0 pt-0.5 font-mono text-[11px] text-muted-foreground">{formatRelativeTime(n.createdAt) || n.time}</span>
                          </button>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
