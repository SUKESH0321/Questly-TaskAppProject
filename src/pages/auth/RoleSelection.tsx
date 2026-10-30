import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { User, Briefcase, Settings } from "lucide-react";

type Role = "customer" | "tasker" | "both";

const OPTIONS: { role: Role; title: string; description: string; icon: typeof User }[] = [
  { role: "customer", title: "I need things done", description: "Post tasks and hire local people.", icon: User },
  { role: "tasker", title: "I want to earn money", description: "Find local tasks and get paid.", icon: Briefcase },
  { role: "both", title: "Both", description: "I want to post tasks and complete them.", icon: Settings },
];

export default function RoleSelection() {
  const navigate = useNavigate();
  const { setRole } = useAuthStore();
  const [pending, setPending] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (role: Role) => {
    setPending(role);
    setError(null);
    try {
      await setRole(role);
      navigate(role === "customer" ? "/home" : "/onboarding", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your choice. Try again.");
      setPending(null);
    }
  };

  return (
    <div className="w-full text-center">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight">How do you want to use Questly?</h2>
        <p className="text-muted-foreground text-sm mt-2">
          You can change this any time in Settings.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {OPTIONS.map(({ role, title, description, icon: Icon }) => (
          <button
            key={role}
            onClick={() => handleSelect(role)}
            disabled={pending !== null}
            className="w-full p-4 rounded-xl border-2 border-transparent bg-muted hover:bg-primary/5 hover:border-primary/30 transition-all flex items-center gap-4 text-left group disabled:opacity-60"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <Icon size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{title}</h3>
              <p className="text-xs text-muted-foreground">
                {pending === role ? "Saving..." : description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
