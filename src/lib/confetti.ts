import { haptic } from "@/lib/haptics";

/**
 * A short, restrained burst for genuine milestones (payment released, identity
 * verified). Skipped entirely for people who prefer reduced motion.
 */
export async function celebrate() {
  void haptic("success");
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const { default: confetti } = await import("canvas-confetti");
  const colors = ["#e8401c", "#f5b82e", "#1f9d63", "#faf7f2"];
  const shot = (originX: number, angle: number) =>
    confetti({ particleCount: 38, spread: 62, angle, startVelocity: 42, origin: { x: originX, y: 0.75 }, colors, ticks: 140, scalar: 0.9, disableForReducedMotion: true });
  shot(0.15, 60);
  shot(0.85, 120);
}
