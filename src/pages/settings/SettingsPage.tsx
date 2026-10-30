import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Briefcase, Check, LogOut, Settings, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore, type UserRole } from "@/stores/authStore";
import api from "@/lib/api";
import { getApiError } from "@/lib/errors";
import { VerificationSection } from "./VerificationSection";
import { InstallSection } from "@/components/shared/InstallApp";
import { LocationField } from "@/components/shared/LocationField";

const SKILLS = [
  "Cleaning", "Tutoring", "Repair", "Photography", "Delivery",
  "Pet Care", "Gardening", "Cooking", "Moving", "Plumbing",
];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const ROLES: { role: Exclude<UserRole, null>; title: string; description: string; icon: typeof UserIcon }[] = [
  { role: "customer", title: "Customer", description: "Post tasks and hire local people.", icon: UserIcon },
  { role: "tasker", title: "Tasker", description: "Find local tasks and get paid.", icon: Briefcase },
  { role: "both", title: "Both", description: "Post tasks and complete them.", icon: Settings },
];

type Notice = { kind: "success" | "error"; text: string } | null;

function NoticeBanner({ notice }: { notice: Notice }) {
  if (!notice) return null;
  const styles =
    notice.kind === "success"
      ? "border-accent/30 bg-accent/10 text-accent"
      : "border-destructive/30 bg-destructive/10 text-destructive";
  return (
    <div role="status" className={`rounded-md border px-3 py-2 text-sm ${styles}`}>
      {notice.text}
    </div>
  );
}

function Section({ id, title, description, children }: { id?: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} className="bg-card border border-border rounded-2xl p-5 md:p-6 space-y-4 scroll-mt-20">
      <div>
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {children}
    </section>
  );
}

const textareaClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[100px]";

function AccountSection() {
  const { user, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [location, setLocation] = useState(user?.location ?? "");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      await updateUser({ name, phone, location });
      setNotice({ kind: "success", text: "Account details saved." });
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Couldn't save." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Account" description="Your basic details. Your email can't be changed.">
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-1 block">Email</label>
          <Input value={user?.email ?? ""} readOnly disabled />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Full name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Phone</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" maxLength={30} />
          <p className="text-xs text-muted-foreground mt-1">Only you can see your phone number.</p>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Location</label>
          <LocationField value={location} onChange={setLocation} placeholder="Search or type your address" />
        </div>
        <NoticeBanner notice={notice} />
        <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
      </form>
    </Section>
  );
}

function RoleSection() {
  const { user, setRole } = useAuthStore();
  const [pending, setPending] = useState<UserRole>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const navigate = useNavigate();

  const choose = async (role: Exclude<UserRole, null>) => {
    if (role === user?.role) return;
    setPending(role);
    setNotice(null);
    try {
      await setRole(role);
      const needsProfile = role !== "customer" && !user?.about && !(user?.skills?.length);
      setNotice({
        kind: "success",
        text: needsProfile
          ? "Role updated. Complete your tasker profile below so customers can trust you."
          : "Role updated.",
      });
      if (needsProfile) {
        document.getElementById("tasker-profile")?.scrollIntoView({ behavior: "smooth" });
      }
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Couldn't change your role." });
    } finally {
      setPending(null);
    }
  };

  return (
    <Section id="role" title="How you use Questly" description="Switch any time. Taskers can apply for tasks; customers can post them.">
      <div className="grid gap-3">
        {ROLES.map(({ role, title, description, icon: Icon }) => {
          const active = user?.role === role;
          return (
            <button
              key={role}
              type="button"
              onClick={() => choose(role)}
              disabled={pending !== null}
              aria-pressed={active}
              className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 text-left transition-colors disabled:opacity-60 ${
                active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon size={20} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">{pending === role ? "Saving..." : description}</p>
              </div>
              {active && <Check size={18} className="text-primary shrink-0" />}
            </button>
          );
        })}
      </div>
      <NoticeBanner notice={notice} />
      {user?.role && user.role !== "customer" && (
        <Button variant="outline" size="sm" onClick={() => navigate("/onboarding")}>
          Run tasker setup wizard
        </Button>
      )}
    </Section>
  );
}

function TaskerProfileSection() {
  const { user, updateUser } = useAuthStore();
  const [about, setAbout] = useState(user?.about ?? "");
  const [skills, setSkills] = useState<string[]>(user?.skills ?? []);
  const [education, setEducation] = useState(user?.education ?? "");
  const [certificates, setCertificates] = useState(user?.certificates ?? "");
  const [portfolioLink, setPortfolioLink] = useState(user?.portfolioLink ?? "");
  const [days, setDays] = useState<string[]>(user?.workingDays ?? []);
  const [startTime, setStartTime] = useState(user?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(user?.endTime ?? "17:00");
  const [radius, setRadius] = useState(user?.travelRadius ?? 10);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const toggle = (list: string[], value: string, set: (v: string[]) => void) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      await updateUser({
        about, skills, education, certificates, portfolioLink,
        workingDays: days, startTime, endTime, travelRadius: radius,
      });
      setNotice({ kind: "success", text: "Tasker profile saved." });
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Couldn't save." });
    } finally {
      setSaving(false);
    }
  };

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
      active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary hover:text-primary"
    }`;

  return (
    <Section id="tasker-profile" title="Tasker profile" description="Shown on your public profile so customers can choose you.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-1 block">About me</label>
          <textarea className={textareaClass} value={about} maxLength={1000} onChange={(e) => setAbout(e.target.value)} placeholder="Tell customers why they should hire you..." />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Skills</label>
          <div className="flex flex-wrap gap-2">
            {SKILLS.map((s) => (
              <button type="button" key={s} aria-pressed={skills.includes(s)} className={chip(skills.includes(s))} onClick={() => toggle(skills, s, setSkills)}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Education</label>
            <Input value={education} maxLength={200} onChange={(e) => setEducation(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Certificates / licenses</label>
            <Input value={certificates} maxLength={300} onChange={(e) => setCertificates(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Portfolio link</label>
          <Input value={portfolioLink} type="url" placeholder="https://..." maxLength={300} onChange={(e) => setPortfolioLink(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Working days</label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <button type="button" key={d} aria-pressed={days.includes(d)} className={chip(days.includes(d))} onClick={() => toggle(days, d, setDays)}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Start time</label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">End time</label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Travel radius: {radius} mi</label>
          <input type="range" min={1} max={50} value={radius} className="w-full primary-primary" onChange={(e) => setRadius(parseInt(e.target.value))} />
        </div>
        <NoticeBanner notice={notice} />
        <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save tasker profile"}</Button>
      </form>
    </Section>
  );
}

function SecuritySection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setNotice(null);
    if (next !== confirm) {
      setNotice({ kind: "error", text: "The new passwords don't match." });
      return;
    }
    setSaving(true);
    try {
      await api.patch("/auth/password", { currentPassword: current, newPassword: next });
      setCurrent("");
      setNext("");
      setConfirm("");
      setNotice({ kind: "success", text: "Password changed." });
    } catch (err) {
      setNotice({ kind: "error", text: getApiError(err, "Couldn't change your password.") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section id="security" title="Privacy & security" description="Change your password.">
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="text-sm font-medium mb-1 block">Current password</label>
          <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">New password</label>
          <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={6} maxLength={128} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Confirm new password</label>
          <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} maxLength={128} />
        </div>
        <NoticeBanner notice={notice} />
        <Button type="submit" disabled={saving}>{saving ? "Updating..." : "Change password"}</Button>
      </form>
    </Section>
  );
}

export default function SettingsPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const isTasker = user?.role === "tasker" || user?.role === "both";

  // Deep links such as /settings#security scroll to their section.
  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account, role and security.</p>
      </div>

      {/* key forces the form state to reset if the user object is replaced (e.g. after login switch) */}
      <AccountSection key={`account-${user?.id}`} />
      <RoleSection />
      {isTasker && <TaskerProfileSection key={`tasker-${user?.id}`} />}
      <InstallSection />
      <VerificationSection />
      <SecuritySection />

      <Button variant="outline" className="w-full text-destructive hover:text-destructive" onClick={handleLogout}>
        <LogOut size={16} className="mr-2" /> Sign out
      </Button>
    </div>
  );
}
