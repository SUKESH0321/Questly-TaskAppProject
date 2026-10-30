import { Capacitor } from "@capacitor/core";

/**
 * Light haptic feedback on Android/iOS. A silent no-op in the browser, so it is
 * always safe to call after meaningful actions (apply, accept, pay, verify).
 */
export async function haptic(kind: "light" | "success" = "light") {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
    if (kind === "success") await Haptics.notification({ type: NotificationType.Success });
    else await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Device without a vibration motor: ignore.
  }
}
