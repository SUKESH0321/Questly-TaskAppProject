import { useState } from "react";
import { Download, Plus, Share, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { promptInstall, useInstallState } from "@/lib/pwa";

const DISMISS_KEY = "questly_install_dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** The three iPhone steps, shown where there is no install button. */
function IosSteps() {
  return (
    <ol className="mt-3 space-y-2 text-sm">
      <li className="flex items-start gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">1</span>
        <span>
          Open this page in <strong>Safari</strong> and tap the <Share size={14} className="mx-0.5 inline -translate-y-px" /> <strong>Share</strong> button.
        </span>
      </li>
      <li className="flex items-start gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">2</span>
        <span>
          Scroll down and tap <Plus size={14} className="mx-0.5 inline -translate-y-px" /> <strong>Add to Home Screen</strong>.
        </span>
      </li>
      <li className="flex items-start gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">3</span>
        <span>
          Tap <strong>Add</strong>. Questly now opens from your home screen like any app.
        </span>
      </li>
    </ol>
  );
}

/** Settings card: install button on Android, steps on iPhone, a note when already installed. */
export function InstallSection() {
  const { standalone, canPrompt, ios } = useInstallState();

  const install = async () => {
    const ok = await promptInstall();
    if (ok) toast.success("Questly is installing…");
  };

  return (
    <section id="install" className="scroll-mt-20 space-y-3 rounded-2xl border border-border bg-card p-5 shadow-soft md:p-6">
      <div>
        <h2 className="text-lg font-bold">Install on your phone</h2>
        <p className="mt-1 text-sm text-muted-foreground">Add Questly to your home screen for one-tap access and a full-screen app feel. No app store needed.</p>
      </div>

      {standalone ? (
        <p className="rounded-xl bg-accent/12 px-3 py-2 text-sm font-semibold text-accent">Questly is installed on this device.</p>
      ) : canPrompt ? (
        <Button onClick={install}>
          <Download size={16} /> Install app
        </Button>
      ) : ios ? (
        <IosSteps />
      ) : (
        <p className="text-sm text-muted-foreground">
          Open this site in <strong>Chrome on Android</strong> (menu, then "Install app") or <strong>Safari on iPhone</strong> (Share, then "Add to Home Screen").
        </p>
      )}
    </section>
  );
}

/** Small dismissible banner on Home for phones that haven't installed the app yet. */
export function InstallBanner() {
  const { standalone, canPrompt, ios } = useInstallState();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [showSteps, setShowSteps] = useState(false);

  if (standalone || dismissed || (!canPrompt && !ios)) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // storage unavailable: it will just show again next visit
    }
  };

  return (
    <div className="relative rounded-2xl border border-border bg-card p-4 shadow-soft md:hidden">
      <button onClick={dismiss} aria-label="Dismiss" className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground hover:text-foreground">
        <X size={16} />
      </button>
      <p className="pr-6 font-bold">Get the Questly app</p>
      <p className="mt-0.5 text-sm text-muted-foreground">Add it to your home screen. Free, no store.</p>
      {canPrompt ? (
        <Button size="sm" className="mt-3" onClick={async () => (await promptInstall()) && dismiss()}>
          <Download size={15} /> Install
        </Button>
      ) : (
        <>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowSteps((s) => !s)}>
            {showSteps ? "Hide steps" : "Show me how"}
          </Button>
          {showSteps && <IosSteps />}
        </>
      )}
    </div>
  );
}
