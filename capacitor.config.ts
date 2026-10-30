import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.questly.app",
  appName: "Questly",
  webDir: "dist",
  server: {
    // The WebView origin becomes https://localhost (already allowed by the backend CORS list).
    androidScheme: "https",
  },
  android: {
    // Only for local development against an http:// backend. Use an https:// API in production.
    allowMixedContent: true,
  },
};

export default config;
