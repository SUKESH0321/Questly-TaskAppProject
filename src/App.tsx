import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { Capacitor } from "@capacitor/core";
import { Toaster } from "sonner";
import { useTheme } from "./lib/theme";
import { useAuthStore } from "./stores/authStore";
import { ScreenOverlay } from "./components/shared/ScreenOverlay";

function App() {
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const logout = useAuthStore((s) => s.logout);
  const { isDark } = useTheme();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Expired/invalid token: sign out; the route guards send the user to /login.
  useEffect(() => {
    window.addEventListener("questly:unauthorized", logout);
    return () => window.removeEventListener("questly:unauthorized", logout);
  }, [logout]);

  // Android hardware/gesture back button: go back in the app, exit only from a top-level screen.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;
    import("@capacitor/app").then(({ App: CapApp }) => {
      CapApp.addListener("backButton", () => {
        const topLevel = ["/", "/login", "/home"];
        if (topLevel.includes(router.state.location.pathname)) {
          CapApp.exitApp();
        } else {
          router.navigate(-1);
        }
      }).then((handle) => {
        remove = () => handle.remove();
      });
    });
    return () => remove?.();
  }, []);

  return (
    <>
      <RouterProvider router={router} />
      <ScreenOverlay />
      <Toaster position="top-center" theme={isDark ? "dark" : "light"} closeButton toastOptions={{ className: "font-sans" }} />
    </>
  );
}

export default App;
