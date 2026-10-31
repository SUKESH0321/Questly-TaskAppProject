import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import TaskCard from "@/components/shared/TaskCard";
import { CountUp } from "@/components/shared/CountUp";
import { StatLedger } from "@/components/shared/StatLedger";
import { Sparkline } from "@/components/shared/Sparkline";
import { Ticker } from "@/components/shared/Ticker";
import { InstallBanner } from "@/components/shared/InstallApp";
import { LogoMark } from "@/components/shared/Logo";
import { EmptyState } from "@/components/shared/EmptyState";
import { useAuthStore } from "@/stores/authStore";
import { useTaskStore, type Task } from "@/stores/taskStore";
import { usePaymentStore } from "@/stores/paymentStore";
import { payoutOf } from "@/types/payment";
import { CATEGORIES, categoryDot } from "@/lib/categories";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

type Action = { task: Task; title: string; hint: string };

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const rise = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } } };

/** Section heading: mono kicker over a display title. */
function SectionHead({ kicker, title, aside }: { kicker: string; title: string; aside?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <p className="label-mono">{kicker}</p>
        <h2 className="mt-1 text-2xl font-extrabold md:text-[1.7rem]">{title}</h2>
      </div>
      {aside}
    </div>
  );
}

export default function Home() {
  const { user, setRole } = useAuthStore();
  const { tasks, fetchTasks, isLoading, error, myPostedTasks, myWorkedTasks, fetchMyPostedTasks, fetchMyWorkedTasks } = useTaskStore();
  const { payments, fetchMyPayments } = usePaymentStore();
  const navigate = useNavigate();
  const [becomingTasker, setBecomingTasker] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchMyPostedTasks();
    fetchMyWorkedTasks();
    fetchMyPayments();
  }, [fetchTasks, fetchMyPostedTasks, fetchMyWorkedTasks, fetchMyPayments]);

  const becomeTasker = async () => {
    setBecomingTasker(true);
    try {
      await setRole("both");
      navigate("/onboarding");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update your role.");
    } finally {
      setBecomingTasker(false);
    }
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) counts[t.category] = (counts[t.category] ?? 0) + 1;
    return counts;
  }, [tasks]);

  // Real numbers from the user's own tasks and payments.
  const stats = useMemo(() => {
    const released = Object.values(payments)
      .filter((p) => p.status === "released" && p.payeeId === user?.id)
      .sort((a, b) => Date.parse(a.releasedAt ?? a.createdAt) - Date.parse(b.releasedAt ?? b.createdAt));
    let running = 0;
    const series = released.slice(-8).map((p) => (running += payoutOf(p)));
    const earned = released.reduce((sum, p) => sum + payoutOf(p), 0);
    const active =
      myPostedTasks.filter((t) => t.status !== "completed" && t.status !== "expired").length +
      myWorkedTasks.filter((t) => t.status !== "completed").length;
    const completed =
      myPostedTasks.filter((t) => t.status === "completed").length + myWorkedTasks.filter((t) => t.status === "completed").length;
    return { earned, active, completed, series };
  }, [payments, myPostedTasks, myWorkedTasks, user?.id]);

  // What needs the user right now, derived from task + payment state.
  const actions = useMemo<Action[]>(() => {
    const list: Action[] = [];
    for (const t of myPostedTasks) {
      const pay = payments[t.id];
      if (t.status === "in_progress" && !pay) {
        list.push({ task: t, title: `Pay ₹${t.budget} to start "${t.title}"`, hint: `${t.workerName || "Your tasker"} is waiting for escrow` });
      } else if (t.status === "in_progress" && pay?.status === "held" && t.workerMarkedDone) {
        list.push({ task: t, title: `Release payment for "${t.title}"`, hint: `${t.workerName || "Your tasker"} says it's done` });
      } else if (t.status === "expired") {
        list.push({ task: t, title: `Nobody picked up "${t.title}"`, hint: "Repost it to keep looking" });
      }
    }
    for (const t of myWorkedTasks) {
      const pay = payments[t.id];
      if (t.status === "in_progress" && pay?.status === "held" && !t.workerMarkedDone) {
        list.push({ task: t, title: `Finish "${t.title}"`, hint: "Payment is secured. Mark it done when you finish" });
      } else if (t.status === "in_progress" && !pay) {
        list.push({ task: t, title: `"${t.title}" is waiting for payment`, hint: "The poster hasn't paid into escrow yet" });
      }
    }
    return list.slice(0, 5);
  }, [myPostedTasks, myWorkedTasks, payments]);

  const latestTasks = tasks.slice(0, 4);
  const firstName = user?.name?.split(" ")[0] || "there";
  const isTasker = user?.role === "tasker" || user?.role === "both";
  const dateLine = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const ticker = tasks.slice(0, 10).map((t) => ({ id: t.id, text: t.title, price: `₹${t.budget}` }));

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="mx-auto max-w-6xl space-y-14 px-4 pb-8 pt-6 md:px-8 md:pt-10">
      {/* Masthead */}
      <motion.header variants={rise} className="relative md:pr-36">
        <div className="pointer-events-none absolute right-2 top-0 hidden md:block" aria-hidden="true">
          <LogoMark size={120} />
        </div>
        <p className="label-mono">
          {dateLine} · {greeting()}
        </p>
        <h1 className="mt-3 font-display text-[2.6rem] font-extrabold leading-[1.02] tracking-tight text-balance md:text-6xl">
          What are we getting done,{" "}
          <span className="relative inline-block whitespace-nowrap">
            {firstName}?
            <svg viewBox="0 0 220 14" className="absolute -bottom-2 left-0 h-3 w-full text-primary" preserveAspectRatio="none" aria-hidden="true">
              <motion.path
                d="M2 9 C 28 2, 52 13, 82 7 S 140 2, 166 8 S 204 12, 218 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.5, duration: 0.8, ease: "easeInOut" }}
              />
            </svg>
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          {actions.length > 0
            ? `${actions.length} ${actions.length === 1 ? "thing needs" : "things need"} you. Everything else is quiet.`
            : "Nothing is waiting on you. A good moment to post something or pick up work."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button size="lg" onClick={() => navigate("/tasks/create")}>
            <Plus size={18} /> Post a task
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/tasks")}>
            <Search size={18} /> {isTasker ? "Find work" : "Browse tasks"}
          </Button>
        </div>
      </motion.header>

      <motion.div variants={rise}>
        <InstallBanner />
      </motion.div>

      {/* Live ticker of the newest tasks (full bleed) */}
      {ticker.length > 0 && (
        <motion.div variants={rise} className="-mx-4 md:-mx-8">
          <Ticker items={ticker} />
        </motion.div>
      )}

      {/* Ledger */}
      <motion.section variants={rise} aria-label="Your numbers">
        <StatLedger
          items={[
            {
              label: "Earned",
              value: <CountUp value={stats.earned} prefix="₹" />,
              hint: <Sparkline data={stats.series} width={120} height={28} className="mt-1" />,
            },
            { label: "Active tasks", value: <CountUp value={stats.active} />, hint: "posted + assigned" },
            { label: "Completed", value: <CountUp value={stats.completed} />, hint: "all time" },
            { label: "Rating", value: <span>{(user?.rating ?? 5).toFixed(1)}</span>, hint: "from your jobs" },
          ]}
        />
      </motion.section>

      {/* Needs you */}
      <motion.section variants={rise}>
        <SectionHead kicker="Action queue" title="Needs you" />
        {actions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border">
            <EmptyState art="bell" title="You're all caught up" compact>
              When a task needs a payment, a reply or a decision, it shows up here first.
            </EmptyState>
          </div>
        ) : (
          <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {actions.map((a, i) => (
              <li key={a.task.id}>
                <Link to={`/tasks/${a.task.id}`} className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/60 md:px-5">
                  <span className="font-mono text-sm text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{a.title}</span>
                    <span className="block truncate text-sm text-muted-foreground">{a.hint}</span>
                  </span>
                  <ArrowUpRight size={18} className="shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </motion.section>

      {/* Category index */}
      <motion.section variants={rise}>
        <SectionHead kicker="Browse by type" title="Categories" />
        <ul className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((name, i) => (
            <li key={name}>
              <Link to={`/tasks?category=${encodeURIComponent(name)}`} className="group flex items-baseline gap-3 border-b border-border py-3.5">
                <span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                <span className={`h-2 w-2 shrink-0 translate-y-[-1px] rounded-full ${categoryDot(name)}`} aria-hidden="true" />
                <span className="text-[17px] font-bold transition-colors group-hover:text-primary">{name}</span>
                <span className="min-w-4 flex-1 translate-y-[-4px] border-b border-dotted border-border" aria-hidden="true" />
                <span className="font-mono text-sm tabular-nums text-muted-foreground">{categoryCounts[name] ?? 0}</span>
                <ArrowRight size={14} className="-ml-1 w-0 shrink-0 text-primary opacity-0 transition-all group-hover:w-3.5 group-hover:opacity-100" />
              </Link>
            </li>
          ))}
        </ul>
      </motion.section>

      {/* Fresh tasks */}
      <motion.section variants={rise}>
        <SectionHead
          kicker="Just posted"
          title="Fresh tasks"
          aside={
            <Button variant="ghost" asChild>
              <Link to="/tasks">
                View all <ArrowRight size={16} />
              </Link>
            </Button>
          }
        />
        {isLoading && tasks.length === 0 ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[24rem] rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">{error}</p>
            <Button className="mt-4" onClick={() => fetchTasks()}>
              Try again
            </Button>
          </div>
        ) : latestTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border">
            <EmptyState
              art="board"
              title="The board is empty"
              action={<Button onClick={() => navigate("/tasks/create")}>Post the first task</Button>}
            >
              Nobody has posted yet. Yours could be the first one up.
            </EmptyState>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            {latestTasks.map((task) => (
              <TaskCard
                key={task.id}
                id={task.id}
                title={task.title}
                category={task.category}
                budget={`₹${task.budget}`}
                bonus={task.urgencyBonus}
                location={task.location}
                time={task.time}
                rating={task.posterRating}
                status={task.status}
                expiresAt={task.expiresAt}
                imageUrl={task.imageUrl}
                posterName={task.posterName}
                posterId={task.posterId}
                poster={task.posterAvatar}
              />
            ))}
          </div>
        )}
      </motion.section>

      {/* Become a tasker */}
      {user?.role === "customer" && (
        <motion.section variants={rise} className="relative overflow-hidden rounded-2xl bg-foreground p-7 text-background md:p-10">
          <div className="pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 sm:block" aria-hidden="true">
            <LogoMark size={130} />
          </div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.09em] text-sun">Tasker mode</p>
          <h2 className="mt-2 max-w-xl font-display text-3xl font-extrabold leading-tight md:text-4xl">Got a free evening? Somebody nearby needs a hand.</h2>
          <p className="mt-3 max-w-lg text-background/70">Pick up tasks you're good at and get paid through escrow, so you're never chasing money.</p>
          <Button size="lg" className="mt-6" onClick={becomeTasker} disabled={becomingTasker}>
            {becomingTasker ? "Setting up..." : "Become a tasker"}
          </Button>
        </motion.section>
      )}
    </motion.div>
  );
}
