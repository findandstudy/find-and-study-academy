import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { db } from "./db";
import { sql as sqlExpr } from "drizzle-orm";
import { setPgTrgmAvailable } from "./storage";
import bcrypt from "bcryptjs";
import path from "path";

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// ── Security Headers ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // Allow iframe embedding for the Findy chat widget
  if (!req.path.startsWith('/embed')) {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }
  next();
});

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads')));

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

// ── pg_trgm setup (idempotent) ────────────────────────────────────────────────
// Enables fuzzy / partial-word matching for the Findy RAG search.
// All statements use IF NOT EXISTS so re-running is safe on every startup.
async function initPgTrgm() {
  try {
    await db.execute(sqlExpr`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    // Verify pg_trgm functions are actually callable — the CREATE above may
    // silently no-op when DB user lacks superuser rights to install extensions.
    // Calling word_similarity() directly confirms the function exists; if not,
    // it throws and we stay in ILIKE-only mode.
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
    log('✓ pg_trgm extension and GIN indexes ready — fuzzy search: ENABLED');
  } catch (err: unknown) {
    // Non-fatal: ILIKE path still works; fuzzy conditions are gated by
    // pgTrgmAvailable=false so no word_similarity() SQL will be emitted.
    const msg = err instanceof Error ? err.message : String(err);
    log('pg_trgm init warning — fuzzy search: ILIKE-only fallback:', msg);
  }
}

// Auto-seed essential data on first deployment
async function seedEssentialData() {
  try {
    // 1. Seed default admin if none exists
    const users = await storage.getUsers();
    const defaultAdminExists = users.some(u => u.email === 'en@findandstudy.com');
    
    if (!defaultAdminExists) {
      log('Seeding default admin user...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await storage.createUser({
        username: 'admin',
        name: 'System Admin',
        email: 'en@findandstudy.com',
        password: hashedPassword,
        role: 'admin'
      });
      log('✓ Admin created: en@findandstudy.com / admin123 (password hashed)');
    }

    // 2. Seed essential countries if empty
    const countries = await storage.getCountries();
    
    if (countries.length === 0) {
      log('Seeding default countries...');
      
      const defaultCountries = [
        { name: 'Türkiye', code: 'TR', flag: '🇹🇷', description: 'Turkey - Study opportunities in a vibrant crossroad of cultures' },
        { name: 'Germany', code: 'DE', flag: '🇩🇪', description: 'Germany - Excellence in engineering and research' },
        { name: 'U.S.A', code: 'US', flag: '🇺🇸', description: 'United States - World-class universities and research institutions' },
        { name: 'Latvia', code: 'LV', flag: '🇱🇻', description: 'Latvia - Quality education in the heart of Europe' },
        { name: 'Belarus', code: 'BY', flag: '🇧🇾', description: 'Belarus - Affordable education with strong academic programs' },
        { name: 'China', code: 'CN', flag: '🇨🇳', description: 'China - Ancient wisdom meets cutting-edge innovation' },
      ];

      for (const country of defaultCountries) {
        await storage.createCountry({
          name: country.name,
          code: country.code,
          flag: country.flag,
          status: 'active',
          description: country.description
        });
      }
      
      log(`✓ Seeded ${defaultCountries.length} countries`);
    }

    // 3. Seed default menu visibility settings if not exists
    const menuSettings = await storage.getSystemSettingByKey('menuVisibility');
    if (!menuSettings) {
      log('Seeding default menu settings...');
      await storage.createSystemSetting({
        key: 'menuVisibility',
        value: JSON.stringify({
          dashboard: true,
          courses: true,
          certificates: true,
          leaderboard: true,
          myAgency: true,
          examsOrders: true,
          subscriptions: true,
          profile: true
        }),
        description: 'Agent menu visibility settings'
      });
      log('✓ Menu settings created');
    }
    
  } catch (error: any) {
    log('Seed error:', error?.message || error);
  }
}

(async () => {
  const server = await registerRoutes(app);

  // Enable pg_trgm for fuzzy RAG search (idempotent — safe every startup)
  await initPgTrgm();

  // Seed essential data on startup (admin, countries, settings)
  await seedEssentialData();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Default to 5000 if not specified.
  const port = parseInt(process.env.PORT || '5000', 10);
  
  // Detect environment for host binding
  const isReplit = !!process.env.REPL_ID || !!process.env.REPLIT_DEPLOYMENT;
  const isWindows = process.platform === 'win32';
  
  // Use 0.0.0.0 for Replit/VPS, 127.0.0.1 for Windows localhost
  const host = isWindows ? '127.0.0.1' : '0.0.0.0';
  
  // reusePort is not supported on Windows
  const listenOptions: any = { port, host };
  if (!isWindows) {
    listenOptions.reusePort = true;
  }
  
  server.listen(listenOptions, () => {
    log(`serving on ${host}:${port} (${isReplit ? 'Replit' : isWindows ? 'Windows' : 'Linux/VPS'})`);
  });
})();
