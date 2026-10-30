import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type TabItem = { id: string; label: string; count?: number };

/** Underlined tabs whose indicator slides between options. `group` keeps indicators of different tab sets apart. */
export function SlidingTabs({
  tabs,
  value,
  onChange,
  group,
  className,
}: {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  group: string;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex gap-1 overflow-x-auto border-b border-border scrollbar-hide", className)}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span className={cn("rounded-full px-1.5 py-0.5 font-mono text-[11px] tabular-nums", active ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {t.count}
              </span>
            )}
            {active && (
              <motion.span
                layoutId={`tabs-${group}`}
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
