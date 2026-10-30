import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, MessageSquareText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import { getApiError } from "@/lib/errors";
import { useAuthStore } from "@/stores/authStore";
import { haptic } from "@/lib/haptics";

type SendResult = {
  phoneMasked: string;
  retryAfterSeconds: number;
  devCode?: string;
};

/** Step after sign-up: confirm the mobile number with a 6-digit SMS code. */
export default function VerifyPhone() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [code, setCode] = useState("");
  const [masked, setMasked] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const autoSent = useRef(false);

  // Accounts without a number (older accounts) are asked for one straight away.
  const hasPhone = !!user?.phone;
  useEffect(() => {
    if (user && !user.phone) setEditing(true);
  }, [user]);

  // Already verified (or came back here by mistake): continue into the app.
  useEffect(() => {
    if (user?.phoneVerified) navigate(user.role ? "/home" : "/role-selection", { replace: true });
  }, [user?.phoneVerified, user?.role, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = useCallback(async (phone?: string) => {
    autoSent.current = true; // never auto-send a second code once one was requested
    setSending(true);
    setError(null);
    try {
      const res = await api.post<SendResult>("/auth/phone/send-otp", phone ? { phone } : {});
      setMasked(res.data.phoneMasked);
      setCooldown(res.data.retryAfterSeconds);
      setDevCode(res.data.devCode ?? null);
      setCode("");
      if (phone) {
        // The number changed: refresh the user so the screen reflects it.
        // Update the user quietly (fetchUser would flip the global loading state and reset this screen).
        const me = await api.get("/auth/me");
        useAuthStore.setState({ user: me.data.user });
      }
    } catch (err) {
      const data = (err as { response?: { data?: { retryAfterSeconds?: number } } })?.response?.data;
      if (data?.retryAfterSeconds) setCooldown(data.retryAfterSeconds);
      else setError(getApiError(err, "Couldn't send the code."));
    } finally {
      setSending(false);
    }
  }, []);

  // Send the first code automatically when the screen opens.
  useEffect(() => {
    if (autoSent.current || user?.phoneVerified || !user?.phone) return;
    autoSent.current = true;
    void sendCode();
  }, [user?.phone, user?.phoneVerified, sendCode]);

  const verify = useCallback(
    async (value: string) => {
      setVerifying(true);
      setError(null);
      try {
        const res = await api.post("/auth/phone/verify", { code: value });
        useAuthStore.setState({ user: res.data.user });
        toast.success("Phone number verified");
        void haptic("success");
        navigate(res.data.user.role ? "/home" : "/role-selection", { replace: true });
      } catch (err) {
        setError(getApiError(err, "Couldn't verify the code."));
        setCode("");
      } finally {
        setVerifying(false);
      }
    },
    [navigate],
  );

  const onCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (digits.length === 6 && !verifying) void verify(digits);
  };

  const submitNewPhone = async () => {
    if (!newPhone.trim()) return;
    await sendCode(newPhone.trim());
    setEditing(false);
    setNewPhone("");
  };

  // No number on the account yet: ask for it first, then show the code screen.
  if (!hasPhone && !masked) {
    return (
      <div className="w-full">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MessageSquareText size={28} />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight">Add your mobile number</h2>
        <p className="mt-2 text-muted-foreground">
          We need a mobile number to keep Questly safe. We'll text you a code to confirm it.
        </p>
        <label htmlFor="new-phone" className="mb-2 mt-6 block text-sm font-semibold">
          Mobile number
        </label>
        <Input
          id="new-phone"
          value={newPhone}
          onChange={(e) => setNewPhone(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitNewPhone()}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="98765 43210"
          autoFocus
        />
        {error && (
          <p role="alert" className="mt-2 text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <Button className="mt-5 w-full" size="lg" onClick={submitNewPhone} disabled={sending || !newPhone.trim()}>
          {sending ? "Sending..." : "Send code"}
        </Button>
        <button
          type="button"
          className="mt-8 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <MessageSquareText size={28} />
      </div>
      <h2 className="text-3xl font-extrabold tracking-tight">{hasPhone ? "Verify your number" : "Add your mobile number"}</h2>
      <p className="mt-2 text-muted-foreground">
        {masked ? (
          <>
            We sent a 6-digit code to <span className="font-semibold text-foreground">{masked}</span>.
          </>
        ) : (
          hasPhone ? "We'll text you a 6-digit code to confirm it's really you." : "We need a mobile number to keep Questly safe. We'll text you a code to confirm it."
        )}
      </p>

      {devCode && (
        <div className="mt-5 rounded-xl border border-dashed border-sun bg-sun/15 p-3 text-sm">
          <p className="font-bold">Development mode</p>
          <p className="text-muted-foreground">
            No SMS provider is connected, so no text was sent. Your code is{" "}
            <button type="button" className="font-mono text-base font-extrabold text-foreground underline" onClick={() => onCodeChange(devCode)}>
              {devCode}
            </button>{" "}
            (tap to fill it in).
          </p>
        </div>
      )}

      <div className="mt-6">
        <label htmlFor="otp" className="mb-2 block text-sm font-semibold">
          Verification code
        </label>
        <Input
          id="otp"
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="••••••"
          disabled={verifying}
          autoFocus
          className="h-14 text-center font-mono text-2xl font-bold tracking-[0.5em]"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>

      <Button className="mt-5 w-full" size="lg" disabled={code.length !== 6 || verifying} onClick={() => verify(code)}>
        {verifying ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Verifying...
          </>
        ) : (
          "Verify and continue"
        )}
      </Button>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <button
          type="button"
          className="font-semibold text-primary disabled:text-muted-foreground"
          disabled={cooldown > 0 || sending}
          onClick={() => sendCode()}
        >
          {sending ? "Sending..." : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
        <button type="button" className="flex items-center gap-1.5 font-semibold text-muted-foreground hover:text-foreground" onClick={() => setEditing((e) => !e)}>
          <Pencil size={14} /> Wrong number?
        </button>
      </div>

      {editing && (
        <div className="mt-4 flex gap-2">
          <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} type="tel" placeholder="New mobile number" autoComplete="tel" />
          <Button variant="outline" onClick={submitNewPhone} disabled={sending || !newPhone.trim()}>
            Send code
          </Button>
        </div>
      )}

      <button
        type="button"
        className="mt-8 text-sm text-muted-foreground hover:text-foreground"
        onClick={() => {
          logout();
          navigate("/login", { replace: true });
        }}
      >
        Sign out
      </button>
    </div>
  );
}
