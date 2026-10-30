import type { ReactNode } from "react";

const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Line illustrations in one consistent hand: ink lines with a single coral accent. */
const art = {
  board: (
    <svg viewBox="0 0 160 120" {...common} aria-hidden="true">
      <rect x="30" y="16" width="100" height="88" rx="8" />
      <path d="M30 38h100" />
      <circle cx="52" cy="27" r="3.2" fill="hsl(var(--primary))" stroke="none" />
      <rect x="44" y="50" width="32" height="22" rx="3" />
      <rect x="86" y="50" width="30" height="14" rx="3" strokeDasharray="3 4" />
      <path d="M44 84h72M44 93h46" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 160 120" {...common} aria-hidden="true">
      <path d="M34 28h62a8 8 0 0 1 8 8v26a8 8 0 0 1-8 8H62l-14 12V70h-14a8 8 0 0 1-8-8V36a8 8 0 0 1 8-8Z" />
      <path d="M52 44h34M52 54h22" />
      <path d="M112 52h14a8 8 0 0 1 8 8v22a8 8 0 0 1-8 8h-4v10l-12-10H98a8 8 0 0 1-8-8v-4" strokeDasharray="3 4" />
      <circle cx="120" cy="71" r="3" fill="hsl(var(--primary))" stroke="none" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 160 120" {...common} aria-hidden="true">
      <path d="M80 22c-16 0-26 12-26 28v18l-8 12h68l-8-12V50c0-16-10-28-26-28Z" />
      <path d="M72 94a8 8 0 0 0 16 0" />
      <path d="M69 52l8 8 15-16" stroke="hsl(var(--primary))" />
    </svg>
  ),
  box: (
    <svg viewBox="0 0 160 120" {...common} aria-hidden="true">
      <path d="M40 54l40-20 40 20v38l-40 18-40-18V54Z" />
      <path d="M40 54l40 20 40-20M80 74v36" />
      <path d="M58 44l-8-16M80 34V16M102 44l8-16" stroke="hsl(var(--primary))" />
    </svg>
  ),
};

export type EmptyArt = keyof typeof art;

/** Friendly empty state: illustration, a specific headline, one next step. */
export function EmptyState({
  art: kind,
  title,
  children,
  action,
  compact = false,
}: {
  art: EmptyArt;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? "py-8" : "py-14"}`}>
      <div className={`${compact ? "w-32" : "w-44"} text-foreground/70`}>{art[kind]}</div>
      <h3 className="mt-3 font-display text-xl font-extrabold">{title}</h3>
      {children && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
