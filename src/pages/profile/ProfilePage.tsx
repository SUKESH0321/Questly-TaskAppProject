import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Camera, Check, Loader2, LogOut, MapPin, Pencil, Phone, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SlidingTabs } from "@/components/ui/SlidingTabs";
import TaskCard from "@/components/shared/TaskCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatLedger } from "@/components/shared/StatLedger";
import { Sparkline } from "@/components/shared/Sparkline";
import { CountUp } from "@/components/shared/CountUp";
import { VerifiedBadges } from "@/components/shared/VerifiedBadges";
import { useAuthStore } from "@/stores/authStore";
import { useTaskStore, type Task } from "@/stores/taskStore";
import { usePaymentStore } from "@/stores/paymentStore";
import { payoutOf } from "@/types/payment";
import { readImageAsDataUrl } from "@/lib/imageUtils";

type TabId = "posted" | "working" | "finished";

/** Circular completeness meter. */
function Ring({ percent }: { percent: number }) {
  const R = 30;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative h-[76px] w-[76px] shrink-0">
      <svg viewBox="0 0 72 72" className="-rotate-90" aria-hidden="true">
        <circle cx="36" cy="36" r={R} fill="none" strokeWidth="6" className="stroke-border" />
        <motion.circle
          cx="36"
          cy="36"
          r={R}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className={percent === 100 ? "stroke-accent" : "stroke-primary"}
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - percent / 100) }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-extrabold tabular-nums">{percent}%</span>
    </div>
  );
}

function TaskRows({ tasks }: { tasks: Task[] }) {
  return (
    <div className="flex flex-col gap-3">
      {tasks.map((t) => (
        <TaskCard
          key={t.id}
          layout="list"
          id={t.id}
          title={t.title}
          category={t.category}
          budget={`₹${t.budget}`}
                bonus={t.urgencyBonus}
          location={t.location}
          time={t.time}
          status={t.status}
          expiresAt={t.expiresAt}
          imageUrl={t.imageUrl}
        />
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuthStore();
  const { myPostedTasks, myWorkedTasks, fetchMyPostedTasks, fetchMyWorkedTasks } = useTaskStore();
  const { payments, fetchMyPayments } = usePaymentStore();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || "");
  const [editPhone, setEditPhone] = useState(user?.phone || "");
  const [editLocation, setEditLocation] = useState(user?.location || "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [tab, setTab] = useState<TabId>("posted");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const isTasker = user?.role === "tasker" || user?.role === "both";

  useEffect(() => {
    fetchMyPostedTasks();
    fetchMyWorkedTasks();
    fetchMyPayments();
  }, [fetchMyPostedTasks, fetchMyWorkedTasks, fetchMyPayments]);

  const posted = myPostedTasks.filter((t) => t.status !== "completed");
  const working = myWorkedTasks.filter((t) => t.status !== "completed");
  const finished = [...myPostedTasks.filter((t) => t.status === "completed"), ...myWorkedTasks.filter((t) => t.status === "completed")];

  const stats = useMemo(() => {
    const released = Object.values(payments)
      .filter((p) => p.status === "released" && p.payeeId === user?.id)
      .sort((a, b) => Date.parse(a.releasedAt ?? a.createdAt) - Date.parse(b.releasedAt ?? b.createdAt));
    let running = 0;
    return {
      earned: released.reduce((s, p) => s + payoutOf(p), 0),
      series: released.slice(-8).map((p) => (running += payoutOf(p))),
    };
  }, [payments, user?.id]);

  // What would make this profile more trustworthy, in priority order.
  const checklist = useMemo(() => {
    const items: { done: boolean; label: string; action: () => void }[] = [
      { done: !!user?.avatar, label: "Add a profile photo", action: () => avatarInputRef.current?.click() },
      { done: !!user?.phoneVerified, label: "Verify your mobile number", action: () => navigate("/verify-phone") },
      { done: !!user?.location, label: "Add your location", action: () => setIsEditing(true) },
    ];
    if (isTasker) {
      items.push(
        { done: !!user?.about, label: "Write a short About", action: () => navigate("/settings#tasker-profile") },
        { done: (user?.skills?.length ?? 0) > 0, label: "Pick your skills", action: () => navigate("/settings#tasker-profile") },
      );
      if (user?.kycMode && user.kycMode !== "none") {
        items.push({ done: user.kycStatus === "verified", label: "Verify your identity", action: () => navigate("/settings#verification") });
      }
    }
    return items;
  }, [user, isTasker, navigate]);
  const percent = Math.round((checklist.filter((c) => c.done).length / checklist.length) * 100);
  const todo = checklist.filter((c) => !c.done);

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await updateUser({ name: editName, phone: editPhone, location: editLocation });
      setIsEditing(false);
      toast.success("Profile updated");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return void toast.error("Please choose an image file (PNG or JPG).");
    if (file.size > 5 * 1024 * 1024) return void toast.error("Image must be smaller than 5MB.");
    setIsUploadingAvatar(true);
    try {
      await updateUser({ avatar: await readImageAsDataUrl(file, 512) });
      toast.success("Photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "We couldn't upload that image.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  const roleLabel = user?.role === "both" ? "Customer & Tasker" : user?.role === "tasker" ? "Tasker" : user?.role === "customer" ? "Customer" : "New member";

  const tabs = [
    { id: "posted", label: "Posted", count: posted.length },
    ...(isTasker ? [{ id: "working", label: "Working on", count: working.length }] : []),
    { id: "finished", label: "Finished", count: finished.length },
  ];
  const activeTab: TabId = tabs.some((t) => t.id === tab) ? tab : "posted";
  const shown = activeTab === "posted" ? posted : activeTab === "working" ? working : finished;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 pb-10 pt-6 md:px-8 md:pt-10">
      {/* Identity */}
      <header className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="bg-hero h-20 md:h-28" />
        <div className="px-5 pb-6 md:px-8">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-4 md:-mt-14">
            <div className="relative">
              <Avatar className="h-24 w-24 border-4 border-card md:h-28 md:w-28">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback className="bg-primary/10 text-3xl font-extrabold text-primary">{initials}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                aria-label="Change profile photo"
                className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/60 text-background opacity-0 transition-opacity hover:opacity-100 focus:opacity-100 disabled:opacity-100"
              >
                {isUploadingAvatar ? <Loader2 size={22} className="animate-spin" /> : <Camera size={22} />}
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div className="flex gap-2">
              {!isEditing && (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Pencil size={14} /> Edit
                </Button>
              )}
              <Button variant="outline" size="sm" asChild>
                <Link to="/settings">
                  <SettingsIcon size={14} /> Settings
                </Link>
              </Button>
            </div>
          </div>

          {isEditing ? (
            <div className="mt-5 max-w-md space-y-3">
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Full name" aria-label="Full name" />
              <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Mobile number" aria-label="Mobile number" type="tel" />
              <p className="text-xs text-muted-foreground">Changing your number means you'll verify the new one by SMS.</p>
              <Input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} placeholder="Location" aria-label="Location" />
              {saveError && <p className="text-sm font-medium text-destructive">{saveError}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveProfile} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <h1 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">{user?.name || "You"}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="label-mono">{roleLabel}</span>
                <VerifiedBadges phone={user?.phoneVerified} id={user?.kycStatus === "verified"} demo={user?.kycMode === "sandbox"} />
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
                {user?.phone && (
                  <span className="flex items-center gap-1.5 font-mono">
                    <Phone size={13} /> {user.phone}
                  </span>
                )}
                {user?.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={13} /> {user.location}
                  </span>
                )}
                <span className="font-mono">{user?.email}</span>
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Completeness */}
      {todo.length > 0 && (
        <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center">
          <Ring percent={percent} />
          <div className="min-w-0 flex-1">
            <p className="label-mono">Profile strength</p>
            <h2 className="mt-1 text-lg font-extrabold">Finish your profile to earn more trust</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {checklist.map((c) => (
                <li key={c.label}>
                  <button
                    type="button"
                    onClick={c.done ? undefined : c.action}
                    disabled={c.done}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                      c.done ? "border-transparent bg-accent/12 text-accent" : "border-border bg-background hover:border-primary hover:text-primary"
                    }`}
                  >
                    {c.done && <Check size={13} strokeWidth={3} />}
                    {c.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Numbers */}
      <StatLedger
        items={[
          { label: "Completed", value: <CountUp value={finished.length} />, hint: "tasks done" },
          { label: "Active", value: <CountUp value={posted.filter((t) => t.status !== "expired").length + working.length} />, hint: "in motion" },
          { label: "Earned", value: <CountUp value={stats.earned} prefix="₹" />, hint: <Sparkline data={stats.series} width={110} height={26} className="mt-1" /> },
          { label: "Rating", value: <span>{(user?.rating ?? 5).toFixed(1)}</span>, hint: "out of 5" },
        ]}
      />

      {/* Tasks */}
      <section>
        <SlidingTabs group="profile" tabs={tabs} value={activeTab} onChange={(id) => setTab(id as TabId)} />
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="pt-5">
          {shown.length > 0 ? (
            <TaskRows tasks={shown} />
          ) : activeTab === "posted" ? (
            <EmptyState art="board" title="Nothing posted right now" action={<Button onClick={() => navigate("/tasks/create")}>Post a task</Button>}>
              Tasks you post and are still running will show up here.
            </EmptyState>
          ) : activeTab === "working" ? (
            <EmptyState art="box" title="No work in progress" action={<Button onClick={() => navigate("/tasks")}>Find work</Button>}>
              When a customer picks you, the task lands here.
            </EmptyState>
          ) : (
            <EmptyState art="bell" title="No finished tasks yet">
              Completed tasks, posted or worked, are kept here as your track record.
            </EmptyState>
          )}
        </motion.div>
      </section>

      <div className="flex justify-center pt-2">
        <Button
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          <LogOut size={16} /> Sign out
        </Button>
      </div>
    </div>
  );
}
