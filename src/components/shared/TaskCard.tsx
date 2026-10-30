import { type MouseEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Clock, Star, Timer } from "lucide-react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { categoryStyle } from "@/lib/categories";
import { formatRemaining, useServerNow } from "@/lib/serverTime";

interface TaskCardProps {
  id: string;
  title: string;
  category: string;
  budget: string;
  /** Urgency tip (INR) the poster added; shown next to the price. */
  bonus?: number;
  location: string;
  time: string;
  /** The poster's rating (shown next to the poster). */
  rating?: number;
  status?: "open" | "in_progress" | "completed" | "expired";
  /** Search window end (ISO); shows a live countdown while the task is open. */
  expiresAt?: string | null;
  imageUrl?: string;
  posterName?: string;
  posterId?: string;
  poster?: string;
  /** "grid" is the die-cut ticket; "list" is a dense row for scanning. */
  layout?: "grid" | "list";
}

const initialsOf = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

/** Task card. The whole card opens the task; the poster row opens their profile. */
export default function TaskCard({
  id,
  title,
  category,
  budget,
  bonus,
  location,
  time,
  rating,
  status,
  expiresAt,
  imageUrl,
  posterName,
  posterId,
  poster,
  layout = "grid",
}: TaskCardProps) {
  const navigate = useNavigate();
  const now = useServerNow();
  const remaining = status === "open" && expiresAt ? Date.parse(expiresAt) - now : 0;
  const safeTitle = title || "Untitled task";
  const safeCategory = category || "General";
  const style = categoryStyle(safeCategory);
  const openTask = () => navigate(`/tasks/${id}`);

  const handleKey = (e: KeyboardEvent) => {
    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      openTask();
    }
  };
  const handlePosterClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (posterId) navigate(`/profile/${posterId}`);
  };

  const urgent = remaining > 0 && remaining < 5 * 60_000;
  const timerChip =
    remaining > 0 ? (
      <span
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] font-semibold tabular-nums ${
          urgent ? "bg-primary text-primary-foreground" : "bg-foreground text-background"
        }`}
      >
        <Timer size={11} /> {formatRemaining(remaining)}
      </span>
    ) : null;

  const takenChip =
    status === "in_progress" ? (
      <span className="rounded-md bg-sun px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-sun-foreground">Taken</span>
    ) : null;

  /* ---------- Dense list row ---------- */
  if (layout === "list") {
    return (
      <motion.article
        layout
        role="link"
        tabIndex={0}
        aria-label={`${safeTitle}, ${budget}`}
        onClick={openTask}
        onKeyDown={handleKey}
        className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl sm:h-20 sm:w-20">
          {imageUrl ? (
            <img src={imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className={`flex h-full w-full items-center justify-center overflow-hidden ${style.tint}`}>
              <span className="font-display text-3xl font-extrabold">{safeCategory[0]}</span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="label-mono">{safeCategory}</p>
          <h3 className="truncate text-base font-bold">{safeTitle}</h3>
          <p className="mt-0.5 flex items-center gap-3 truncate text-xs text-muted-foreground">
            <span className="flex min-w-0 items-center gap-1">
              <MapPin size={12} className="shrink-0" />
              <span className="truncate">{location || "Location not specified"}</span>
            </span>
            <span className="hidden shrink-0 items-center gap-1 sm:flex">
              <Clock size={12} /> {time || "TBD"}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="font-display text-xl font-extrabold tabular-nums">{budget}</span>
          {bonus ? <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent">+₹{bonus} tip</span> : null}
          {timerChip ?? takenChip}
        </div>
      </motion.article>
    );
  }

  /* ---------- Die-cut ticket ---------- */
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className="drop-shadow-[0_1px_1px_hsl(var(--shadow-color)/0.06)] transition-[filter] hover:drop-shadow-[0_14px_18px_hsl(var(--shadow-color)/0.16)]"
    >
      <article
        role="link"
        tabIndex={0}
        aria-label={`${safeTitle}, ${budget}`}
        onClick={openTask}
        onKeyDown={handleKey}
        className="ticket group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* Media: a photo, or type set large when there isn't one. */}
        <div className="relative h-40 shrink-0 overflow-hidden">
          {imageUrl ? (
            <img src={imageUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
          ) : (
            <div className={`relative flex h-full w-full items-end overflow-hidden bg-dots p-4 ${style.tint}`}>
              <span aria-hidden="true" className="absolute -left-2 -top-3 select-none font-display text-[6.5rem] font-extrabold uppercase leading-none opacity-25">
                {safeCategory.slice(0, 3)}
              </span>
              <span className="relative font-display text-2xl font-extrabold leading-tight">{safeCategory}</span>
            </div>
          )}
          <div className="absolute left-3 top-3 flex items-center gap-1.5">
            {imageUrl && <span className="rounded-md bg-card/95 px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide">{safeCategory}</span>}
            {takenChip}
          </div>
          {timerChip && <div className="absolute bottom-3 left-3">{timerChip}</div>}
        </div>

        {/* Details */}
        <div className="flex-1 px-4 pb-4 pt-3.5">
          <h3 className="line-clamp-2 text-[17px] font-bold leading-snug">{safeTitle}</h3>
          <div className="mt-2.5 space-y-1 text-[13px] text-muted-foreground">
            <p className="flex items-center gap-2 truncate">
              <MapPin size={13} className="shrink-0 text-primary" />
              <span className="truncate">{location || "Location not specified"}</span>
            </p>
            <p className="flex items-center gap-2">
              <Clock size={13} className="shrink-0 text-primary" />
              {time || "Time TBD"}
            </p>
          </div>
        </div>

        {/* Tear line + price stub */}
        <div className="relative h-[76px] shrink-0 px-5">
          <div className="tear absolute inset-x-[14px] top-0" aria-hidden="true" />
          <div className="flex h-full items-center justify-between gap-3">
            <div>
              <p className="label-mono !text-[10px]">Budget</p>
              <p className="font-display text-[1.65rem] font-extrabold leading-none tabular-nums">{budget}</p>
              {bonus ? <span className="mt-1 inline-block rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent">+₹{bonus} tip</span> : null}
            </div>
            {posterName && (
              <button
                type="button"
                onClick={handlePosterClick}
                className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-muted"
                title={`Posted by ${posterName}`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={poster} />
                  <AvatarFallback className="bg-primary/10 text-[11px] font-bold text-primary">{initialsOf(posterName)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block max-w-[7rem] truncate text-[13px] font-semibold leading-tight">{posterName}</span>
                  {typeof rating === "number" && rating > 0 && (
                    <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                      <Star size={10} className="fill-sun text-sun" />
                      {rating.toFixed(1)}
                    </span>
                  )}
                </span>
              </button>
            )}
          </div>
        </div>
      </article>
    </motion.div>
  );
}
