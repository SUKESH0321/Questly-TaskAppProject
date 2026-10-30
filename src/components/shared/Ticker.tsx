import { Link } from "react-router-dom";

export type TickerItem = { id: string; text: string; price: string };

/** Slow, pausable marquee of the newest tasks. Real data; hidden when there's nothing to show. */
export function Ticker({ items }: { items: TickerItem[] }) {
  if (items.length === 0) return null;
  // Repeat so the loop is seamless and long enough to scroll even with few tasks.
  const run = [...items, ...items, ...items].slice(0, Math.max(items.length, 8));
  const track = [...run, ...run];

  return (
    <div className="group relative overflow-hidden border-y border-border bg-card/60 py-2.5" aria-label="Newest tasks">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent" />
      <div className="flex w-max animate-marquee gap-8 whitespace-nowrap group-hover:[animation-play-state:paused] motion-reduce:animate-none">
        {track.map((it, i) => (
          <Link
            key={`${it.id}-${i}`}
            to={`/tasks/${it.id}`}
            tabIndex={i >= run.length ? -1 : 0}
            aria-hidden={i >= run.length}
            className="flex items-center gap-2 text-sm hover:text-primary"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="font-semibold">{it.text}</span>
            <span className="font-mono text-xs text-muted-foreground">{it.price}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
