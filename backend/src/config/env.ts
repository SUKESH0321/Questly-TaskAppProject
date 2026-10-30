import "dotenv/config";

const isProduction = process.env.NODE_ENV === "production";

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (isProduction) {
    throw new Error("JWT_SECRET must be set (16+ characters) when NODE_ENV=production.");
  }
  console.warn(
    "[config] JWT_SECRET is missing or too short. Using an insecure development secret. " +
      "Set a long random JWT_SECRET in backend/.env.",
  );
  return "dev-only-insecure-secret-change-me";
}

/**
 * Origins allowed to call the API. Includes the origins a Capacitor Android/iOS
 * WebView uses, so the same backend works for the web app and the mobile app.
 * Override with CORS_ORIGIN (comma separated); use "*" to allow everything.
 */
const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  // Vite falls back to the next port when 5173 is busy.
  "http://localhost:5174",
  "http://localhost",
  "https://localhost",
  "capacitor://localhost",
  "ionic://localhost",
];

function resolveCorsOrigins(): string[] | "*" {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw) return defaultOrigins;
  if (raw === "*") return "*";
  return raw.split(",").map((o) => o.trim()).filter(Boolean);
}

type SmsProvider = "console" | "twilio" | "msg91";
type KycProviderName = "none" | "sandbox";

function resolveSms() {
  const provider = (process.env.SMS_PROVIDER || "console") as SmsProvider;
  if (!["console", "twilio", "msg91"].includes(provider)) {
    throw new Error("SMS_PROVIDER must be console, twilio or msg91.");
  }
  // The console provider shows the code on screen instead of texting it, so anyone could
  // "verify" any number. In production it is allowed ONLY as an explicit, labelled demo.
  if (isProduction && provider === "console" && process.env.ALLOW_DEMO_SMS !== "true") {
    throw new Error(
      "SMS_PROVIDER=console shows codes on screen instead of texting them. Use twilio or msg91 in production, or set ALLOW_DEMO_SMS=true to run it as a demo.",
    );
  }
  const twilio = {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    from: process.env.TWILIO_FROM || "",
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || "",
  };
  const msg91 = { authKey: process.env.MSG91_AUTH_KEY || "", templateId: process.env.MSG91_TEMPLATE_ID || "" };
  if (provider === "twilio" && (!twilio.accountSid || !twilio.authToken || !(twilio.from || twilio.messagingServiceSid))) {
    throw new Error("Twilio needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (or TWILIO_MESSAGING_SERVICE_SID).");
  }
  if (provider === "msg91" && (!msg91.authKey || !msg91.templateId)) {
    throw new Error("MSG91 needs MSG91_AUTH_KEY and MSG91_TEMPLATE_ID.");
  }
  return { provider, twilio, msg91 };
}

function resolveKyc() {
  const provider = (process.env.KYC_PROVIDER || "none") as KycProviderName;
  if (!["none", "sandbox"].includes(provider)) {
    throw new Error("KYC_PROVIDER must be none or sandbox until a real provider is added.");
  }
  // The sandbox only simulates a check. In production it is allowed ONLY as an explicit,
  // clearly-labelled demo (the app shows "Demo ID check" instead of "ID verified").
  if (isProduction && provider === "sandbox" && process.env.ALLOW_DEMO_KYC !== "true") {
    throw new Error("KYC_PROVIDER=sandbox only simulates verification. To run it in production as a labelled demo, also set ALLOW_DEMO_KYC=true.");
  }
  // Taskers must be verified only when a provider can actually verify them.
  const required = process.env.KYC_REQUIRED ? process.env.KYC_REQUIRED === "true" : provider !== "none";
  return { provider, required: required && provider !== "none", demo: provider === "sandbox" };
}

/**
 * Single-deploy mode: the API also serves the built website (the repo's /dist folder),
 * so one service hosts everything. On by default in production; set SERVE_FRONTEND=true
 * to try it locally after `npm run build`.
 */
const serveFrontend = process.env.SERVE_FRONTEND ? process.env.SERVE_FRONTEND === "true" : isProduction;

export const env = {
  isProduction,
  port: Number(process.env.PORT) || 3001,
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/questly",
  jwtSecret: resolveJwtSecret(),
  corsOrigins: resolveCorsOrigins(),
  // Demo data is seeded only outside production unless explicitly enabled.
  seedDemoData: process.env.SEED_DEMO_DATA
    ? process.env.SEED_DEMO_DATA === "true"
    : !isProduction,
  serveFrontend,
  sms: resolveSms(),
  kyc: resolveKyc(),
};
