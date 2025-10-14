import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

// Auto-seed essential data on first deployment
async function seedEssentialData() {
  try {
    // 1. Seed default admin if none exists
    const users = await storage.getUsers();
    const adminExists = users.some(u => u.role === 'admin');
    
    if (!adminExists) {
      log('Seeding default admin user...');
      await storage.createUser({
        username: 'admin',
        name: 'System Admin',
        email: 'en@findandstudy.com',
        password: 'admin123',
        role: 'admin'
      });
      log('✓ Admin created: en@findandstudy.com / admin123');
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
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
