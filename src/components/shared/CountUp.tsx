import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";

/** Animates a number from 0 to `value` when it appears or changes. */
export function CountUp({ value, prefix = "", className }: { value: number; prefix?: string; className?: string }) {
  const motionValue = useMotionValue(0);
  const text = useTransform(motionValue, (v) => `${prefix}${Math.round(v).toLocaleString("en-IN")}`);

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.9, ease: "easeOut" });
    return () => controls.stop();
  }, [value, motionValue]);

  return <motion.span className={className}>{text}</motion.span>;
}
