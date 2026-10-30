import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, Loader2, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { getApiError } from "@/lib/errors";
import { celebrate } from "@/lib/confetti";
import { useAuthStore } from "@/stores/authStore";

function Row({ icon, title, status, children }: { icon: React.ReactNode; title: string; status: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold">{title}</p>
            {status}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

const pill = (tone: "ok" | "warn" | "muted", text: string) => (
  <span
    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
      tone === "ok" ? "bg-accent/15 text-accent" : tone === "warn" ? "bg-sun/30 text-foreground" : "bg-muted text-muted-foreground"
    }`}
  >
    {text}
  </span>
);

/** Settings card: phone verification status and tasker identity (Aadhaar) verification. */
export function VerificationSection() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [consent, setConsent] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTasker = user?.role === "tasker" || user?.role === "both";
  const kyc = user?.kycStatus ?? "none";

  // While a verification is pending, ask the server for the result every 3 seconds.
  useEffect(() => {
    if (kyc !== "pending") return;
    const poll = setInterval(async () => {
      try {
        const res = await api.get("/kyc/status");
        useAuthStore.setState({ user: res.data.user });
        if (res.data.status === "verified") {
          toast.success("Identity verified");
          void celebrate();
        }
      } catch {
        // transient: try again next tick
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [kyc]);

  const startKyc = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await api.post("/kyc/start", { consent: true });
      useAuthStore.setState({ user: res.data.user });
      // A real provider sends the user to its own hosted page to complete Aadhaar/DigiLocker.
      if (res.data.redirectUrl) window.location.href = res.data.redirectUrl;
    } catch (err) {
      setError(getApiError(err, "Couldn't start verification."));
    } finally {
      setStarting(false);
    }
  };

  return (
    <section id="verification" className="scroll-mt-20 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft md:p-6">
      <div>
        <h2 className="text-lg font-bold">Verification</h2>
        <p className="mt-1 text-sm text-muted-foreground">Verified accounts build trust and unlock more of Questly.</p>
      </div>

      <Row
        icon={<Smartphone size={18} />}
        title="Mobile number"
        status={user?.phoneVerified ? pill("ok", "Verified") : pill("warn", "Not verified")}
      >
        <p className="mt-1 text-sm text-muted-foreground">{user?.phone || "No number added yet"}</p>
        {!user?.phoneVerified && (
          <Button size="sm" className="mt-3" onClick={() => navigate("/verify-phone")}>
            Verify now
          </Button>
        )}
      </Row>

      {isTasker && (
        <Row
          icon={kyc === "verified" ? <ShieldCheck size={18} /> : <BadgeCheck size={18} />}
          title="Identity (Aadhaar)"
          status={
            user?.kycMode === "none"
              ? pill("muted", "Not available yet")
              : kyc === "verified"
                ? pill("ok", "Verified")
                : kyc === "pending"
                  ? pill("warn", "Checking")
                  : kyc === "rejected"
                    ? pill("warn", "Not verified")
                    : pill("muted", "Not started")
          }
        >
          {user?.kycMode === "sandbox" && (
            <p className="mt-2 rounded-lg border border-dashed border-sun bg-sun/15 p-2 text-xs">
              <strong>Sandbox mode:</strong> this simulates verification so the flow can be tested. Nothing is actually checked.
            </p>
          )}

          {user?.kycMode === "none" ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Identity verification isn't available yet. We'll let you know when it opens. Until then, you can still use Questly.
            </p>
          ) : kyc === "verified" ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Verified{user?.kycAadhaarMasked ? ` · Aadhaar ${user.kycAadhaarMasked}` : ""}. Customers see an "{user?.kycMode === "sandbox" ? "ID verified (demo)" : "ID verified"}" badge on your profile.
            </p>
          ) : kyc === "pending" ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={15} className="animate-spin" /> Checking with our verification partner…
            </p>
          ) : !user?.phoneVerified ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldAlert size={15} /> Verify your mobile number first.
            </p>
          ) : (
            <div className="mt-2 space-y-3">
              {kyc === "rejected" && (
                <p className="text-sm font-medium text-destructive">{user?.kycRejectionReason || "We couldn't verify your identity. You can try again."}</p>
              )}
              <p className="text-sm text-muted-foreground">
                You'll confirm your Aadhaar on our verification partner's secure page. Questly never sees or stores your full Aadhaar number, only the last 4 digits.
              </p>
              <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>I consent to Questly verifying my identity using Aadhaar through its verification partner.</span>
              </label>
              {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
              <Button size="sm" disabled={!consent || starting} onClick={startKyc}>
                {starting ? "Starting..." : "Verify with Aadhaar"}
              </Button>
            </div>
          )}
        </Row>
      )}
    </section>
  );
}
