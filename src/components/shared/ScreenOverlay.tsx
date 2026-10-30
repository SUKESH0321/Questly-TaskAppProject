import { useScreen } from "@/stores/screenStore";
import { LogoMark } from "@/components/shared/Logo";

/**
 * Blank page with a single line of text, shown while something is being set up.
 * Fades in with CSS and disappears instantly, so it can never get stuck waiting on an
 * exit animation (browsers pause those in background tabs).
 */
export function ScreenOverlay() {
  const message = useScreen((s) => s.message);
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[200] flex animate-in fade-in flex-col items-center justify-center gap-5 bg-background px-6 duration-200"
    >
      <LogoMark size={96} />
      <p className="font-display text-xl font-semibold tracking-tight text-foreground md:text-2xl">
        {message}
        <span aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="animate-pulse" style={{ animationDelay: `${i * 200}ms` }}>
              .
            </span>
          ))}
        </span>
      </p>
    </div>
  );
}
