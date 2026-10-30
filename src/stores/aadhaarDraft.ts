import { create } from "zustand";

/**
 * The Aadhaar card photo and consent collected while signing up. Kept in memory only (never
 * stored or uploaded; this is a demo check), so the sign-up page and the tasker onboarding
 * step can share it without asking twice.
 */
interface AadhaarDraft {
  image: string;
  consent: boolean;
  /** "I'll do this later from Settings". */
  skip: boolean;
  setImage: (image: string) => void;
  setConsent: (consent: boolean) => void;
  setSkip: (skip: boolean) => void;
  reset: () => void;
}

export const useAadhaarDraft = create<AadhaarDraft>((set) => ({
  image: "",
  consent: false,
  skip: false,
  setImage: (image) => set({ image }),
  setConsent: (consent) => set({ consent }),
  setSkip: (skip) => set({ skip }),
  reset: () => set({ image: "", consent: false, skip: false }),
}));

/** True when the Aadhaar step is complete: a photo plus consent, or an explicit "later". */
export const aadhaarReady = (d: Pick<AadhaarDraft, "image" | "consent" | "skip">) => d.skip || (!!d.image && d.consent);
