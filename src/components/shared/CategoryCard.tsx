import type { LucideProps } from "lucide-react";
import type { FC } from "react";
import { Link } from "react-router-dom";
import { categoryStyle } from "@/lib/categories";

interface CategoryCardProps {
  name: string;
  icon: FC<LucideProps>;
  count: number;
}

export default function CategoryCard({ name, icon: Icon, count }: CategoryCardProps) {
  const style = categoryStyle(name);
  return (
    <Link
      to={`/tasks?category=${encodeURIComponent(name)}`}
      className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.98]"
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${style.gradient} text-white shadow-soft transition-transform group-hover:scale-105 group-hover:-rotate-3`}>
        <Icon size={24} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-foreground">{name}</span>
        <span className="block text-xs text-muted-foreground">
          {count} {count === 1 ? "task" : "tasks"}
        </span>
      </span>
    </Link>
  );
}
