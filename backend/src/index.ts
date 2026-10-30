import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { seedDatabase } from "./config/seed.js";
import authRoutes from "./routes/auth.js";
import taskRoutes from "./routes/tasks.js";
import paymentRoutes from "./routes/payments.js";
import messageRoutes from "./routes/messages.js";
import notificationRoutes from "./routes/notifications.js";
import userRoutes from "./routes/users.js";
import kycRoutes from "./routes/kyc.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { expireDueTasks } from "./utils/expiry.js";

const app = express();

// Behind a proxy (Render, Railway, Nginx...) so rate limiting sees real IPs.
app.set("trust proxy", 1);
app.disable("x-powered-by");

// ---------- Middleware ----------
// When this server also hosts the website, give browsers a strict but working policy:
// our own scripts/styles/fonts, https or data: images (task photos), and the one external
// service the app calls (OpenStreetMap, to turn GPS into an address).
app.use(
  helmet(
    env.serveFrontend
      ? {
          contentSecurityPolicy: {
            useDefaults: false,
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", "data:", "blob:", "https:"],
              fontSrc: ["'self'", "data:"],
              connectSrc: ["'self'", "https://nominatim.openstreetmap.org"],
              workerSrc: ["'self'"],
              manifestSrc: ["'self'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              frameAncestors: ["'self'"],
              ...(env.isProduction ? { upgradeInsecureRequests: [] } : {}),
            },
          },
        }
      : undefined,
  ),
);
// CORS: the site's OWN origin is always allowed (browsers send an Origin header even for the
// site's own scripts and styles because Vite marks them crossorigin); other origins only if
// listed in CORS_ORIGIN (or the Capacitor/dev defaults). A disallowed origin simply gets no
// CORS headers, so the browser blocks it, rather than the server answering with an error.
app.use(
  cors((req, cb) => {
    const origin = req.header("Origin");
    const sameOrigin = !!origin && origin === `${req.protocol}://${req.get("host")}`;
    const allowed = !origin || sameOrigin || env.corsOrigins === "*" || env.corsOrigins.includes(origin);
    cb(null, { origin: allowed });
  }),
);
// Allow larger JSON bodies so uploaded photos (Base64 data URLs) can be stored.
app.use(express.json({ limit: "10mb" }));

// Brute-force protection on credentials endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in a few minutes." },
});
// General abuse protection.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  // Generous: many users can share one IP (campus/office Wi-Fi, mobile carrier NAT).
  limit: 1000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Slow down." },
});

app.use("/api", apiLimiter);

// ---------- Routes ----------
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/password", authLimiter);
app.use("/api/auth/phone", authLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/conversations", messageRoutes);
app.use("/api/notifications", notificationRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ---------- Website (single-deploy) ----------
if (env.serveFrontend) {
  // This file lives at backend/src or backend/dist; the built site is at <repo>/dist.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const siteDir = path.resolve(here, "../../dist");
  const indexFile = path.join(siteDir, "index.html");

  if (!fs.existsSync(indexFile)) {
    console.warn(`SERVE_FRONTEND is on but ${indexFile} does not exist. Run "npm run build" in the project root first.`);
  } else {
    // The site lives under /QuestlyTaskApp (must match Vite's `base`); the API stays at /api.
    const base = "/QuestlyTaskApp";
    app.use(
      base,
      express.static(siteDir, {
        index: false,
        setHeaders(res, filePath) {
          const name = path.basename(filePath);
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            // Content-hashed build files never change.
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          } else if (name === "sw.js" || name === "manifest.webmanifest" || name === "theme-init.js") {
            res.setHeader("Cache-Control", "no-cache");
          } else {
            res.setHeader("Cache-Control", "public, max-age=3600");
          }
        },
      }),
    );
    // Any other path without a file extension is a client-side route: serve the app.
    app.get(/^\/QuestlyTaskApp(\/[^.]*)?$/, (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(indexFile);
    });
    // Old or bare addresses (/, /home, ...) go to the same page under the app's base path.
    app.get(/^\/(?!api(\/|$))[^.]*$/, (req, res) => {
      res.redirect(302, `${base}${req.path === "/" ? "/" : req.path}`);
    });
    console.log(`Serving the website from ${siteDir}`);
  }
}

app.use(notFoundHandler);
app.use(errorHandler);

// Never let a stray rejection take the whole API down.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

// ---------- Start ----------
async function start() {
  await connectDB();
  if (env.seedDemoData) {
    await seedDatabase();
  }

  // Ends task search windows that ran out and notifies the poster.
  const sweep = () =>
    expireDueTasks().catch((err) => console.error("Task expiry sweep failed:", err));
  void sweep();
  setInterval(sweep, 15_000).unref();

  app.listen(env.port, () => {
    console.log(`Questly API server running at http://localhost:${env.port}`);
    console.log(`Health check: http://localhost:${env.port}/api/health`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
