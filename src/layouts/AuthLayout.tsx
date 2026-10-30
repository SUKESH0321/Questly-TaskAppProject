import { Outlet, useLocation } from "react-router-dom";
import { Clock, MapPin, ShieldCheck, Star } from "lucide-react";
import { Logo, LogoMark } from "@/components/shared/Logo";
import { QuestMapBackground } from "@/components/shared/QuestMapBackground";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

// Decorative preview cards for the brand panel (illustrations, not live data).
const SAMPLES = [
  { title: "Assemble IKEA wardrobe", price: "₹850", place: "Indiranagar", time: "Today, 4 PM", cls: "left-2 top-8 rotate-[-4deg]", delay: "0s" },
  { title: "Deep clean 2BHK", price: "₹1,200", place: "Koramangala", time: "Tomorrow", cls: "right-0 top-[8.5rem] rotate-[3deg]", delay: "1.2s" },
  { title: "Maths tutor, Class 10", price: "₹600", place: "HSR Layout", time: "Weekly", cls: "left-10 top-[17rem] rotate-[-2deg]", delay: "2.1s" },
];

export default function AuthLayout() {
  const { pathname } = useLocation();
  // The onboarding wizard has six steps and needs more room than the login card.
  const isWide = pathname.startsWith("/onboarding");

  return (
    <div className="relative min-h-screen lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <QuestMapBackground />
      {/* Brand panel */}
      <aside className="relative z-10 hidden overflow-hidden border-r border-border/60 p-12 lg:flex lg:flex-col">
        <Logo />
        {/* Large hero coin */}
        <div className="pointer-events-none absolute right-14 top-24 hidden xl:block" aria-hidden="true">
          <LogoMark size={150} />
        </div>
        <div className="mt-16 max-w-md">
          <h2 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-balance">
            Get things done by people <span className="text-primary">next door.</span>
          </h2>
          <p className="mt-5 text-lg text-muted-foreground">
            Post a task, pick a trusted local tasker, and pay safely through escrow.
          </p>
          <ul className="mt-8 space-y-3 text-sm font-semibold">
            <li className="flex items-center gap-3"><ShieldCheck size={18} className="text-accent" /> Payment held until the work is done</li>
            <li className="flex items-center gap-3"><Star size={18} className="text-sun" /> Pick from applicants you can chat with first</li>
          </ul>
        </div>

        <div className="relative mt-10 flex-1" aria-hidden="true">
          {SAMPLES.map((s) => (
            <div
              key={s.title}
              style={{ animationDelay: s.delay }}
              className={`absolute w-72 animate-float rounded-2xl border border-border/70 bg-card p-4 shadow-lift ${s.cls}`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-bold leading-snug">{s.title}</p>
                <span className="font-display text-lg font-extrabold">{s.price}</span>
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin size={12} className="text-primary" />{s.place}</span>
                <span className="flex items-center gap-1"><Clock size={12} className="text-primary" />{s.time}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Form panel */}
      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 py-10 pt-safe">
        <div className="absolute right-4 top-4"><ThemeToggle /></div>
        <div className="mb-8 lg:hidden"><Logo /></div>
        <div className={`w-full ${isWide ? "max-w-2xl" : "max-w-md"}`}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
