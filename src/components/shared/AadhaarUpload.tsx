import { useRef, useState, type ChangeEvent } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { readImageAsDataUrl } from "@/lib/imageUtils";
import { useAadhaarDraft } from "@/stores/aadhaarDraft";

/** Upload a photo of the Aadhaar card, give consent, or choose to do it later. Demo check only. */
export function AadhaarUpload() {
  const { image, consent, skip, setImage, setConsent, setSkip } = useAadhaarDraft();
  const inputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setError("Please choose an image (JPG or PNG) under 5 MB.");
      return;
    }
    setError(null);
    setReading(true);
    try {
      setImage(await readImageAsDataUrl(file, 900));
      setSkip(false);
    } catch {
      setError("We couldn't read that image. Try another one.");
    } finally {
      setReading(false);
    }
  };

  return (
    <div className="space-y-3">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onSelect} />

      {image ? (
        <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
          <img src={image} alt="Your Aadhaar card" className="max-h-48 w-full object-contain" />
          <button
            type="button"
            onClick={() => setImage("")}
            className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 shadow-soft hover:bg-background"
            aria-label="Remove Aadhaar photo"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={reading || skip}
          className="flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-muted/40 px-4 py-7 text-muted-foreground transition-colors enabled:hover:border-primary enabled:hover:text-primary disabled:opacity-50"
        >
          {reading ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
          <span className="text-sm font-medium">{reading ? "Reading your card…" : "Upload Aadhaar card"}</span>
          <span className="text-xs">JPG or PNG, up to 5 MB</span>
        </button>
      )}
      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}

      <p className="rounded-lg border border-dashed border-sun bg-sun/15 p-2.5 text-xs">
        <strong>Demo check:</strong> your card photo stays on this device and is not uploaded or stored. Nothing is actually verified, and Questly never keeps your Aadhaar number.
      </p>

      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>I consent to Questly verifying my identity using my Aadhaar.</span>
      </label>

      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" className="h-3.5 w-3.5" checked={skip} onChange={(e) => setSkip(e.target.checked)} />
        I'll do this later from Settings
      </label>
    </div>
  );
}
