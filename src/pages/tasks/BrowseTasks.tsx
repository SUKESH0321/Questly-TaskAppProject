import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutGrid, List, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import TaskCard from "@/components/shared/TaskCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { CountUp } from "@/components/shared/CountUp";
import { useTaskStore } from "@/stores/taskStore";
import type { TaskFilters } from "@/stores/taskStore";
import { CATEGORIES, categoryDot } from "@/lib/categories";
import api from "@/lib/api";

type SortBy = NonNullable<TaskFilters["sortBy"]>;
type ViewMode = "grid" | "list";

const SORTS: { value: SortBy; label: string }[] = [
  { value: "date", label: "Newest" },
  { value: "budget_high", label: "Highest price" },
  { value: "budget_low", label: "Lowest price" },
];

const BUDGET_PRESETS = [
  { label: "Under ₹500", min: "", max: "500" },
  { label: "₹500 – 2,000", min: "500", max: "2000" },
  { label: "₹2,000+", min: "2000", max: "" },
];

const VIEW_KEY = "questly_browse_view";
function readView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

export default function BrowseTasks() {
  const [params, setParams] = useSearchParams();
  const { tasks, fetchTasks, isLoading, error, hasMore, page } = useTaskStore();
  const [view, setView] = useState<ViewMode>(readView);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [counts, setCounts] = useState<{ total: number; byCategory: Record<string, number> } | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Filters live in the URL so they can be shared and survive navigation.
  const search = params.get("search") ?? "";
  const category = params.get("category") ?? "All";
  const minBudget = params.get("min") ?? "";
  const maxBudget = params.get("max") ?? "";
  const sortBy = (params.get("sort") as SortBy | null) ?? "date";

  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => setSearchInput(search), [search]);

  const setParam = (key: string, value: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  const changeView = (v: ViewMode) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // storage unavailable: the choice just won't persist
    }
  };

  // Real per-category counts for the chips.
  useEffect(() => {
    api
      .get("/tasks/stats")
      .then((res) => setCounts(res.data))
      .catch(() => setCounts(null));
  }, []);

  // Debounce typing into the URL.
  useEffect(() => {
    if (searchInput === search) return;
    const t = setTimeout(() => setParam("search", searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildFilters = (): TaskFilters => {
    const min = parseInt(minBudget);
    const max = parseInt(maxBudget);
    return {
      search,
      category,
      minBudget: Number.isFinite(min) ? min : undefined,
      maxBudget: Number.isFinite(max) ? max : undefined,
      sortBy,
    };
  };

  // The server filters and sorts; refetch whenever a filter changes.
  useEffect(() => {
    fetchTasks(buildFilters());
  }, [search, category, minBudget, maxBudget, sortBy, fetchTasks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll: load the next page shortly before the bottom comes into view.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || isLoading || error) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) fetchTasks(buildFilters(), page + 1);
      },
      { rootMargin: "500px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, isLoading, error, page, tasks.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const budgetActive = !!(minBudget || maxBudget);
  const hasFilters = !!(search || category !== "All" || budgetActive || sortBy !== "date");

  const resetFilters = () => {
    setSearchInput("");
    setParams({}, { replace: true });
  };

  const applyPreset = (p: (typeof BUDGET_PRESETS)[number]) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (p.min) next.set("min", p.min);
        else next.delete("min");
        if (p.max) next.set("max", p.max);
        else next.delete("max");
        return next;
      },
      { replace: true },
    );
  };

  const chips = ["All", ...CATEGORIES];
  const chipCount = (c: string) => (c === "All" ? counts?.total : counts?.byCategory[c] ?? 0);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 md:px-8">
      {/* Title row */}
      <div className="flex items-end justify-between gap-4 pb-4 pt-6 md:pt-10">
        <div>
          <p className="label-mono">Open for applications</p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight md:text-5xl">Browse tasks</h1>
        </div>
        <p className="pb-1 font-mono text-sm tabular-nums text-muted-foreground">
          <CountUp value={tasks.length} />
          {hasMore ? "+" : ""} {tasks.length === 1 ? "task" : "tasks"}
        </p>
      </div>

      {/* Sticky toolbar */}
      <div className="sticky top-[64px] z-20 -mx-4 space-y-3 border-b border-border bg-background/90 px-4 pb-3 pt-3 backdrop-blur-xl md:-mx-8 md:px-8">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search tasks"
              placeholder="Search tasks, keywords..."
              className="pl-10 pr-10"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchInput("")}
              >
                <X size={15} />
              </button>
            )}
          </div>

          <Button
            variant={budgetActive || budgetOpen ? "secondary" : "outline"}
            className={budgetActive ? "border-primary text-primary" : ""}
            onClick={() => setBudgetOpen((o) => !o)}
            aria-expanded={budgetOpen}
          >
            <SlidersHorizontal size={16} />
            <span className="hidden sm:inline">Budget</span>
            {budgetActive && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
          </Button>

          <select
            aria-label="Sort tasks"
            value={sortBy}
            onChange={(e) => setParam("sort", e.target.value === "date" ? "" : e.target.value)}
            className="hidden h-11 rounded-xl border border-input bg-card px-3 text-sm font-semibold sm:block"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <div className="hidden rounded-xl border border-input bg-card p-1 sm:flex" role="group" aria-label="Layout">
            {([["grid", LayoutGrid, "Grid view"], ["list", List, "List view"]] as const).map(([v, Icon, label]) => (
              <button
                key={v}
                type="button"
                aria-label={label}
                aria-pressed={view === v}
                onClick={() => changeView(v)}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors aria-pressed:text-foreground"
              >
                {view === v && <motion.span layoutId="view-pill" className="absolute inset-0 rounded-lg bg-muted" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                <Icon size={17} className="relative" />
              </button>
            ))}
          </div>
        </div>

        {/* Category pills with live counts */}
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 scrollbar-hide" role="tablist" aria-label="Category">
          {chips.map((c) => {
            const active = category === c;
            const n = chipCount(c);
            return (
              <button
                key={c}
                role="tab"
                aria-selected={active}
                onClick={() => setParam("category", c === "All" ? "" : c)}
                className={`relative flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  active ? "border-transparent text-primary-foreground" : "border-border bg-card text-foreground hover:border-foreground/30"
                }`}
              >
                {active && <motion.span layoutId="cat-pill" className="absolute inset-0 rounded-full bg-foreground" transition={{ type: "spring", stiffness: 480, damping: 36 }} />}
                {c !== "All" && <span className={`relative h-2 w-2 rounded-full ${categoryDot(c)}`} />}
                <span className={`relative ${active ? "text-background" : ""}`}>{c}</span>
                {typeof n === "number" && <span className={`relative font-mono text-[11px] tabular-nums ${active ? "text-background/70" : "text-muted-foreground"}`}>{n}</span>}
              </button>
            );
          })}
        </div>

        {/* Budget presets */}
        <AnimatePresence initial={false}>
          {budgetOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-2 pb-1 pt-1">
                {BUDGET_PRESETS.map((p) => {
                  const on = minBudget === p.min && maxBudget === p.max;
                  return (
                    <button
                      key={p.label}
                      onClick={() => (on ? applyPreset({ label: "", min: "", max: "" }) : applyPreset(p))}
                      className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                        on ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:border-foreground/30"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
                <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
                <Input type="number" inputMode="numeric" min={0} placeholder="Min ₹" className="h-9 w-24 text-sm" value={minBudget} onChange={(e) => setParam("min", e.target.value)} />
                <span className="text-muted-foreground">to</span>
                <Input type="number" inputMode="numeric" min={0} placeholder="Max ₹" className="h-9 w-24 text-sm" value={maxBudget} onChange={(e) => setParam("max", e.target.value)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {hasFilters && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Filters applied</span>
            <button className="font-semibold text-primary hover:underline" onClick={resetFilters}>
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="pt-6">
        {isLoading && tasks.length === 0 ? (
          <div className={view === "grid" ? "grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3" : "space-y-3"}>
            {Array.from({ length: view === "grid" ? 6 : 5 }).map((_, i) => (
              <Skeleton key={i} className={view === "grid" ? "h-[24rem] rounded-2xl" : "h-24 rounded-2xl"} />
            ))}
          </div>
        ) : error ? (
          <EmptyState art="box" title="Couldn't load tasks" action={<Button onClick={() => fetchTasks(buildFilters())}>Try again</Button>}>
            {error}
          </EmptyState>
        ) : tasks.length === 0 ? (
          <EmptyState
            art="board"
            title="Nothing matches"
            action={hasFilters ? <Button variant="outline" onClick={resetFilters}>Clear filters</Button> : undefined}
          >
            {hasFilters ? "Try a different word or widen the budget." : "No open tasks right now. Check back soon, or post one yourself."}
          </EmptyState>
        ) : (
          <div className={`${view === "grid" ? "grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-3"} transition-opacity ${isLoading ? "opacity-60" : ""}`}>
            <AnimatePresence mode="popLayout" initial={false}>
              {tasks.map((task, i) => (
                <motion.div
                  key={`${view}-${task.id}`}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 8) * 0.035 } }}
                  exit={{ opacity: 0, scale: 0.96 }}
                >
                  <TaskCard
                    layout={view}
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
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Infinite-scroll sentinel, with a manual fallback */}
        <div ref={sentinelRef} className="flex h-20 items-center justify-center">
          {hasMore && !error && (
            <Button variant="ghost" disabled={isLoading} onClick={() => fetchTasks(buildFilters(), page + 1)}>
              {isLoading ? "Loading more..." : "Load more"}
            </Button>
          )}
          {!hasMore && tasks.length > 0 && <p className="label-mono">You've seen everything</p>}
        </div>
      </div>
    </div>
  );
}
