import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { db, pool } from "./db";
import { sql as sqlExpr } from "drizzle-orm";
import { setPgTrgmAvailable } from "./storage";
import bcrypt from "bcryptjs";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

// ── Augment express-session typings so req.session.userId is type-safe ───────
declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

const app = express();

// Trust the first proxy hop in production so secure cookies + req.ip work
// behind OpenLiteSpeed / nginx / Replit's edge.
app.set("trust proxy", 1);

// ── Security middleware ─────────────────────────────────────────────────────
app.use(
  helmet({
    // CSP/COEP would block our embedded chat widget, third-party iframes
    // (YouTube, Google Maps, Yandex), and inline event-handlers used by the
    // legacy index.html chat widget. Disable until we audit them.
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // We set our own X-Frame-Options below (per-route) to allow /embed iframes.
    frameguard: false,
  }),
);

// CORS: production locks down to ALLOWED_ORIGIN (the canonical deployed
// domain, e.g. https://academy.findandstudy.com). We additionally allow:
//   • same-origin requests (no Origin header — curl, native apps, server)
//   • the request's own Host (frontend + API served from same origin)
//   • Replit-hosted preview/deployment URLs (*.replit.app, *.replit.dev,
//     *.repl.co) so the autoscale deployment & workspace iframe work
// In development everything is allowed so Vite HMR + the preview pane work.
const allowedOrigin = process.env.ALLOWED_ORIGIN;
const REPLIT_HOST_RE = /\.(replit\.app|replit\.dev|repl\.co|picard\.replit\.dev)$/i;
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (process.env.NODE_ENV !== "production") return callback(null, true);
      if (allowedOrigin && origin === allowedOrigin) return callback(null, true);
      try {
        const host = new URL(origin).hostname;
        if (REPLIT_HOST_RE.test(host)) return callback(null, true);
      } catch { /* fall through */ }
      return callback(new Error("CORS: origin not allowed"), false);
    },
    credentials: true,
  }),
);

// Body parsers (must come before session if reading req.body in any session
// handler, but session itself doesn't need body — order is fine).
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// ── Server-side sessions (cookie-based auth) ────────────────────────────────
// Stored in PostgreSQL via connect-pg-simple. The "session" table is created
// on demand (createTableIfMissing). The session cookie is httpOnly so XSS
// cannot read it, sameSite=lax so it survives normal navigation, and secure
// in production so it never travels over plain HTTP.
const PgSessionStore = connectPgSimple(session);
const sessionSecret =
  process.env.SESSION_SECRET ||
  (process.env.NODE_ENV === "production"
    ? // Hard-fail in production rather than silently using a weak default.
      (() => {
        throw new Error(
          "SESSION_SECRET must be set in production (.env.production).",
        );
      })()
    : "dev-only-insecure-session-secret-change-me");

app.use(
  session({
    store: new PgSessionStore({
      // Both Neon serverless Pool and node-postgres Pool expose the same
      // .query() interface that connect-pg-simple needs.
      pool: pool as any,
      tableName: "session",
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 15, // 15 min
    }),
    secret: sessionSecret,
    name: "fas.sid",
    resave: false,
    saveUninitialized: false,
    rolling: true, // refresh maxAge on each request → "sliding" 7-day session
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }),
);

// ── Extra response headers (helmet covers most, these are project-specific) ─
app.use((req, res, next) => {
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  // Allow iframe embedding only for the Findy chat widget routes.
  if (!req.path.startsWith("/embed")) {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
  }
  next();
});

// ── /uploads — auth-gated static files ──────────────────────────────────────
// Anonymous public access removed: profile pictures, agency logos, content
// files (PDF/DOCX/MP4) and uploaded knowledge sources are all considered
// private to authenticated users. The session cookie must be present.
const uploadsRoot = path.join(process.cwd(), "public", "uploads");
app.use(
  "/uploads",
  (req, res, next) => {
    if (!req.session?.userId) {
      return res.status(401).type("text/plain").send("Authentication required");
    }
    return next();
  },
  express.static(uploadsRoot, {
    fallthrough: false,
    maxAge: "1d",
    etag: true,
  }),
);

// ── Liveness / readiness endpoint ───────────────────────────────────────────
// Used by PM2, the deploy script, and uptime monitors. Confirms the process
// is up AND the database is reachable. Always cheap (single SELECT 1).
app.get("/api/health", async (_req, res) => {
  try {
    await db.execute(sqlExpr`SELECT 1`);
    res.json({
      status: "ok",
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || "development",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(503).json({ status: "error", db: false, message: msg });
  }
});

// ── Request logger (existing behaviour) ─────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });

  next();
});

// ── pg_trgm setup (idempotent) ──────────────────────────────────────────────
async function initPgTrgm() {
  try {
    await db.execute(sqlExpr`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await db.execute(sqlExpr`SELECT word_similarity('test', 'test') AS ws`);
    await db.execute(sqlExpr`
      CREATE INDEX IF NOT EXISTS knowledge_chunks_content_trgm_idx
        ON knowledge_chunks USING GIN (content gin_trgm_ops)
    `);
    await db.execute(sqlExpr`
      CREATE INDEX IF NOT EXISTS knowledge_chunks_keywords_trgm_idx
        ON knowledge_chunks USING GIN (keywords gin_trgm_ops)
    `);
    setPgTrgmAvailable(true);
    log("✓ pg_trgm extension and GIN indexes ready — fuzzy search: ENABLED");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log("pg_trgm init warning — fuzzy search: ILIKE-only fallback:", msg);
  }
}

// ── Auto-seed essential data on first deployment ────────────────────────────
// Admin seeding is OPT-IN: requires ADMIN_INITIAL_PASSWORD env var. Without
// it, no admin is created and no insecure default password ever ends up in
// the database. Production deploys must set this in .env.production.
async function seedEssentialData() {
  try {
    const adminEmail =
      process.env.ADMIN_INITIAL_EMAIL || "en@findandstudy.com";
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;

    const users = await storage.getUsers();
    const adminExists = users.some((u) => u.email === adminEmail);

    if (!adminExists) {
      if (!adminPassword) {
        log(
          `⚠ No admin user found and ADMIN_INITIAL_PASSWORD is not set — ` +
            `skipping admin seed. Set the env var and restart to bootstrap.`,
        );
      } else if (adminPassword.length < 8) {
        log(
          `⚠ ADMIN_INITIAL_PASSWORD is too short (<8 chars) — refusing to seed.`,
        );
      } else {
        log("Seeding initial admin user from environment variables…");
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        await storage.createUser({
          username: "admin",
          name: "System Admin",
          email: adminEmail,
          password: hashedPassword,
          role: "admin",
        });
        log(`✓ Admin created: ${adminEmail} (password from env, hashed)`);
      }
    }

    // 2. Seed essential countries if empty
    const countries = await storage.getCountries();
    if (countries.length === 0) {
      log("Seeding default countries...");
      const defaultCountries = [
        { name: "Türkiye", code: "TR", flag: "🇹🇷", description: "Turkey - Study opportunities in a vibrant crossroad of cultures" },
        { name: "Germany", code: "DE", flag: "🇩🇪", description: "Germany - Excellence in engineering and research" },
        { name: "U.S.A", code: "US", flag: "🇺🇸", description: "United States - World-class universities and research institutions" },
        { name: "Latvia", code: "LV", flag: "🇱🇻", description: "Latvia - Quality education in the heart of Europe" },
        { name: "Belarus", code: "BY", flag: "🇧🇾", description: "Belarus - Affordable education with strong academic programs" },
        { name: "China", code: "CN", flag: "🇨🇳", description: "China - Ancient wisdom meets cutting-edge innovation" },
      ];
      for (const country of defaultCountries) {
        await storage.createCountry({
          name: country.name,
          code: country.code,
          flag: country.flag,
          status: "active",
          description: country.description,
        });
      }
      log(`✓ Seeded ${defaultCountries.length} countries`);
    }

    // 3. Seed default menu visibility settings if not exists
    const menuSettings = await storage.getSystemSettingByKey("menuVisibility");
    if (!menuSettings) {
      log("Seeding default menu settings...");
      await storage.createSystemSetting({
        key: "menuVisibility",
        value: JSON.stringify({
          dashboard: true,
          courses: true,
          certificates: true,
          leaderboard: true,
          myAgency: true,
          examsOrders: true,
          subscriptions: true,
          profile: true,
        }),
        description: "Agent menu visibility settings",
      });
      log("✓ Menu settings created");
    }
  } catch (error: any) {
    log("Seed error:", error?.message || error);
  }
}

(async () => {
  const server = await registerRoutes(app);

  await initPgTrgm();
  await seedEssentialData();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  const isWindows = process.platform === "win32";
  const host = isWindows ? "127.0.0.1" : "0.0.0.0";

  server.listen(port, host, () => {
    log(`serving on http://${host}:${port}`);
  });
})();
