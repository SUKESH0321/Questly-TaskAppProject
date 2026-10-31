import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, IndianRupee, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LogoMark } from "@/components/shared/Logo";
import api from "@/lib/api";
import { getApiError } from "@/lib/errors";
import { useAuthStore } from "@/stores/authStore";

interface AdminStats {
  tasksCompleted: number;
  companyEarnings: number;
  commissionPercent: number;
}

const REFRESH_MS = 30_000;

/** The company admin's only screen: tasks completed and what the company has earned. */
export default function AdminPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<AdminStats>("/admin/stats");
      setStats(res.data);
      setError(null);
    } catch (err) {
      setError(getApiError(err, "Couldn't load the numbers."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-5 py-4 md:px-10">
        <div className="flex items-center gap-3">
          <LogoMark size={36} />
          <span className="font-display text-xl font-extrabold tracking-tight">Questly Admin</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut size={16} className="mr-1.5" /> Log out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 md:py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="label-mono">Company overview</p>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight md:text-4xl">How the company is doing</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} aria-label="Refresh numbers">
            <RefreshCw size={15} className={loading ? "mr-1.5 animate-spin" : "mr-1.5"} /> Refresh
          </Button>
        </div>

        {error && (
          <p role="alert" className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 size={18} className="text-accent" />
              <p className="label-mono">Tasks done</p>
            </div>
            <p className="mt-4 font-display text-6xl font-extrabold tabular-nums leading-none">
              {stats ? stats.tasksCompleted.toLocaleString("en-IN") : "–"}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">Completed and paid out</p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-2 text-muted-foreground">
              <IndianRupee size={18} className="text-primary" />
              <p className="label-mono">Company earnings</p>
            </div>
            <p className="mt-4 font-display text-6xl font-extrabold tabular-nums leading-none">
              {stats ? `₹${stats.companyEarnings.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "–"}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">{stats ? stats.commissionPercent : 10}% of every completed task</p>
          </section>
        </div>
      </main>
    </div>
  );
}
