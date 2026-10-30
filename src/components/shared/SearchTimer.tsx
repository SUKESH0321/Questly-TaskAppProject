import { useState } from "react";
import { Radar, RefreshCw, Trash2, TimerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRemaining, useServerNow } from "@/lib/serverTime";
import { DEFAULT_SEARCH_MINUTES, SEARCH_WINDOWS } from "@/lib/searchWindow";

/** Live "looking for a tasker" countdown with a radar pulse and a progress ring. */
export function SearchTimer({
  expiresAt,
  startedAt,
  applicants,
  isPoster,
}: {
  expiresAt: string;
  startedAt?: string;
  applicants: number;
  isPoster: boolean;
}) {
  const now = useServerNow();
  const end = Date.parse(expiresAt);
  const start = startedAt ? Date.parse(startedAt) : end - 30 * 60_000;
  const remaining = Math.max(0, end - now);
  const total = Math.max(1, end - start);
  const fraction = Math.min(1, remaining / total);
  const ended = remaining <= 0;
  const urgent = !ended && remaining < 5 * 60_000;

  const R = 38;
  const C = 2 * Math.PI * R;

  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={ended ? "Search ended" : `${formatRemaining(remaining)} left to find a tasker`}
      className={`mb-6 flex items-center gap-5 rounded-2xl border p-4 sm:p-5 ${
        urgent ? "border-primary/40 bg-primary/5" : "border-border/70 bg-muted/40"
      }`}
    >
      <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
        {!ended && (
          <>
            <span className="absolute inset-3 animate-ping rounded-full bg-primary/20 [animation-duration:2.2s]" />
            <span className="absolute inset-6 animate-ping rounded-full bg-primary/20 [animation-delay:0.9s] [animation-duration:2.2s]" />
          </>
        )}
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r={R} fill="none" strokeWidth="7" className="stroke-border" />
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            className={`transition-[stroke-dashoffset] duration-1000 ease-linear ${urgent ? "stroke-primary" : "stroke-accent"}`}
            strokeDasharray={C}
            strokeDashoffset={C * (1 - fraction)}
          />
        </svg>
        <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow">
          <Radar size={22} />
        </span>
      </div>

      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {ended ? "Wrapping up" : "Finding a tasker"}
        </p>
        <p className={`font-display text-4xl font-extrabold leading-none tabular-nums ${urgent ? "text-primary" : "text-foreground"}`}>
          {ended ? "00:00" : formatRemaining(remaining)}
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {ended
            ? "The search window just ended. Updating…"
            : isPoster
              ? applicants > 0
                ? `${applicants} ${applicants === 1 ? "tasker has" : "taskers have"} applied. Pick one any time.`
                : "No applicants yet. We'll tell you if nobody picks it up."
              : "Apply before the timer runs out."}
        </p>
      </div>
    </div>
  );
}

/** Shown to the poster when nobody picked up the task in time. */
export function ExpiredPanel({
  onRepost,
  onDelete,
  busy,
}: {
  onRepost: (minutes: number) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const [minutes, setMinutes] = useState<number>(DEFAULT_SEARCH_MINUTES);

  return (
    <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <TimerOff size={20} />
        </span>
        <div>
          <p className="font-display text-lg font-extrabold">No one picked this up</p>
          <p className="text-sm text-muted-foreground">
            The search window ended with no applicants. Repost it to keep looking, or delete it.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="New search window">
        {SEARCH_WINDOWS.map((w) => (
          <button
            key={w.minutes}
            type="button"
            role="radio"
            aria-checked={minutes === w.minutes}
            onClick={() => setMinutes(w.minutes)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              minutes === w.minutes
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:border-foreground/30"
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => onRepost(minutes)} disabled={busy}>
          <RefreshCw size={16} className={busy ? "animate-spin" : ""} /> {busy ? "Reposting..." : "Repost task"}
        </Button>
        <Button variant="outline" onClick={onDelete} disabled={busy} className="text-destructive hover:text-destructive">
          <Trash2 size={16} /> Delete
        </Button>
      </div>
    </div>
  );
}
