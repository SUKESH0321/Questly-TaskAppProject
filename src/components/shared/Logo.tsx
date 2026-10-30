import { cn } from "@/lib/utils";

const SLICES = 11;

/**
 * Questly's gold coin. It is drawn as a stack of thin slices so it has real thickness: it
 * looks solid while it spins, and you see its edge mid-flip. Flips every few seconds, and
 * faster on hover. `size` is in px.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  const src = `${import.meta.env.BASE_URL}icon-q.png`;
  const thickness = size * 0.2;
  return (
    <span
      className={cn("coin-wrap relative inline-block shrink-0", className)}
      style={{ width: size, height: size, perspective: size * 14 }}
      aria-hidden="true"
    >
      <span className="coin-3d absolute inset-0 block">
        {Array.from({ length: SLICES }, (_, i) => {
          const t = i / (SLICES - 1) - 0.5; // -0.5 (back face) .. 0.5 (front face)
          const isFace = i === 0 || i === SLICES - 1;
          return (
            <img
              key={i}
              src={src}
              alt=""
              draggable={false}
              className="absolute inset-0 block h-full w-full"
              style={{
                transform: `translateZ(${(t * thickness).toFixed(2)}px)`,
                // The rim is a darker gold than the two faces.
                filter: isFace ? undefined : "brightness(0.72) saturate(1.1)",
              }}
            />
          );
        })}
      </span>
    </span>
  );
}

export function Logo({ className, showWord = true }: { className?: string; showWord?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {showWord && (
        <span className="font-display text-[1.35rem] font-extrabold tracking-tight text-foreground">
          Questly
        </span>
      )}
    </span>
  );
}
