import { Brush, Wrench, Truck, BookOpen, Leaf, Package, Droplets, Armchair, Sparkles } from "lucide-react";
import type { FC } from "react";
import type { LucideProps } from "lucide-react";

/** Single source of truth for task categories (posting, browsing, editing, home). */
export const CATEGORIES = [
  "Cleaning",
  "Repairs",
  "Moving",
  "Delivery",
  "Tutoring",
  "Plumbing",
  "Furniture Assembly",
  "Gardening",
  "Other",
] as const;

export const CATEGORY_ICONS: Record<string, FC<LucideProps>> = {
  Cleaning: Brush,
  Repairs: Wrench,
  Moving: Package,
  Delivery: Truck,
  Tutoring: BookOpen,
  Plumbing: Droplets,
  "Furniture Assembly": Armchair,
  Gardening: Leaf,
  Other: Sparkles,
};

/** Gradient + tint per category, used on card fallbacks and category tiles. */
export const CATEGORY_STYLES: Record<string, { gradient: string; tint: string }> = {
  Cleaning: { gradient: "from-sky-400 to-cyan-600", tint: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  Repairs: { gradient: "from-amber-400 to-orange-600", tint: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  Moving: { gradient: "from-violet-400 to-indigo-600", tint: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  Delivery: { gradient: "from-emerald-400 to-teal-600", tint: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  Tutoring: { gradient: "from-pink-400 to-rose-600", tint: "bg-pink-500/15 text-pink-700 dark:text-pink-300" },
  Plumbing: { gradient: "from-blue-400 to-blue-700", tint: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  "Furniture Assembly": { gradient: "from-orange-400 to-red-600", tint: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  Gardening: { gradient: "from-lime-400 to-green-600", tint: "bg-lime-500/15 text-lime-700 dark:text-lime-300" },
  Other: { gradient: "from-slate-400 to-slate-600", tint: "bg-slate-500/15 text-slate-700 dark:text-slate-300" },
};

export function categoryStyle(name: string) {
  return CATEGORY_STYLES[name] ?? CATEGORY_STYLES.Other;
}

/** Solid marker colour per category (small dots, filters). */
export const CATEGORY_DOTS: Record<string, string> = {
  Cleaning: "bg-sky-500",
  Repairs: "bg-amber-500",
  Moving: "bg-violet-500",
  Delivery: "bg-emerald-500",
  Tutoring: "bg-pink-500",
  Plumbing: "bg-blue-600",
  "Furniture Assembly": "bg-orange-500",
  Gardening: "bg-lime-500",
  Other: "bg-slate-400",
};

export function categoryDot(name: string) {
  return CATEGORY_DOTS[name] ?? CATEGORY_DOTS.Other;
}
