import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Detect if we're running on Replit (uses Neon serverless) or local/VPS (uses standard pg)
const isReplit = !!process.env.REPL_ID || !!process.env.REPLIT_DEPLOYMENT;

let db: ReturnType<typeof drizzleNeon> | ReturnType<typeof drizzlePg>;
let pool: NeonPool | PgPool;

if (isReplit) {
  // Replit environment: Use Neon serverless driver with WebSocket
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  db = drizzleNeon({ client: pool as NeonPool, schema });
  console.log('[DB] Using Neon serverless driver (Replit environment)');
} else {
  // Local/VPS environment: Use standard pg driver
  pool = new PgPool({ connectionString: process.env.DATABASE_URL });
  db = drizzlePg({ client: pool as PgPool, schema });
  console.log('[DB] Using standard pg driver (Local/VPS environment)');
}

export { db, pool };
