import type { ReactNode } from "react";

export type LedgerItem = { label: string; value: ReactNode; hint?: ReactNode };

/**
 * Editorial row of big numerals separated by hairlines. Deliberately has no icons or
 * tinted tiles: the numbers carry the design.
 */
export function StatLedger({ items }: { items: LedgerItem[] }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="border-border p-4 md:border-l md:p-5 md:first:border-l-0 max-md:[&:nth-child(odd)]:border-r max-md:[&:nth-child(-n+2)]:border-b"
        >
          <dt className="label-mono">{it.label}</dt>
          <dd className="mt-2 font-display text-[2rem] font-extrabold leading-none tabular-nums md:text-4xl">{it.value}</dd>
          {it.hint && <p className="mt-2 text-xs text-muted-foreground">{it.hint}</p>}
        </div>
      ))}
    </dl>
  );
}
