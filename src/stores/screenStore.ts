import { create } from "zustand";

interface ScreenState {
  /** Text shown on the full-screen "please wait" overlay; null = hidden. */
  message: string | null;
  show: (message: string) => void;
  hide: () => void;
}

export const useScreen = create<ScreenState>((set) => ({
  message: null,
  show: (message) => set({ message }),
  hide: () => set({ message: null }),
}));

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs `work` behind a blank full-screen overlay that shows only `message`. The overlay stays
 * for at least `minMs` so quick actions still feel deliberate, and it lives above the router,
 * so it survives the page changes that happen while it is up. Errors hide it immediately.
 */
export async function withScreen<T>(message: string, work: () => Promise<T>, minMs = 1600): Promise<T> {
  useScreen.getState().show(message);
  try {
    const [result] = await Promise.all([work(), sleep(minMs)]);
    return result;
  } finally {
    useScreen.getState().hide();
  }
}
