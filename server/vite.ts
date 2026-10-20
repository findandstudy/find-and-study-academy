import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";
import { defaultGoogleMeasurementConfig, renderGoogleMeasurementHead, type GoogleMeasurementConfig } from './google-measurement';

const viteLogger = createLogger();
type ReadMeasurementConfig = () => Promise<GoogleMeasurementConfig>;

async function withMeasurementHead(template: string, url: string, readConfig: ReadMeasurementConfig) {
  let config = defaultGoogleMeasurementConfig();
  try { config = await readConfig(); }
  catch { /* Keep serving the Academy if configuration storage is unavailable. */ }
  return renderGoogleMeasurementHead(template, url, config);
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server, readConfig: ReadMeasurementConfig) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, await withMeasurementHead(template, url, readConfig));
      res.status(200).set({ "Content-Type": "text/html", "Cache-Control": "no-store" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express, readConfig: ReadMeasurementConfig, distPath = path.resolve(import.meta.dirname, "public")) {

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const template = fs.readFileSync(path.resolve(distPath, 'index.html'), 'utf-8');
  const sendHtml: express.RequestHandler = async (req, res, next) => {
    try {
      res.status(200).set({ 'Content-Type': 'text/html', 'Cache-Control': 'no-store' })
        .send(await withMeasurementHead(template, req.originalUrl, readConfig));
    } catch (error) { next(error); }
  };
  // The direct index file must use the same renderer as SPA fallback requests.
  app.get('/index.html', sendHtml);
  app.use(express.static(distPath, { index: false }));

  // fall through to index.html if the file doesn't exist
  app.use("*", sendHtml);
}
