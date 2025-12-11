import { type Server } from "node:http";

import express, {
  type Express,
  type Request,
  Response,
  NextFunction,
} from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";

import { registerRoutes } from "./routes";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
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

export const app = express();

// Trust proxy for Replit - needed to correctly detect https from X-Forwarded-Proto
app.set('trust proxy', 1);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: '10mb', // Increased limit for base64 image uploads
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

const PgSession = connectPgSimple(session);
const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10,
});

pool.on('error', (err) => {
  log(`Database pool error: ${err.message}`, 'database');
});

// Migration: Copy data from old favorite_team column to favorite_nfl_team if needed
async function migrateTeamColumn() {
  try {
    // Check if the old favorite_team column exists
    const columnCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'favorite_team'
    `);
    
    if (columnCheck.rows.length > 0) {
      log('Found old favorite_team column, migrating data...', 'migration');
      
      // Copy data from old column to new column where new column is empty
      const result = await pool.query(`
        UPDATE users 
        SET favorite_nfl_team = favorite_team 
        WHERE favorite_team IS NOT NULL 
          AND favorite_team != '' 
          AND (favorite_nfl_team IS NULL OR favorite_nfl_team = '')
      `);
      
      log(`Migrated ${result.rowCount} users' team data`, 'migration');
      
      // Optionally drop the old column after migration
      // await pool.query('ALTER TABLE users DROP COLUMN favorite_team');
      // log('Dropped old favorite_team column', 'migration');
    }
  } catch (err: any) {
    log(`Team column migration error (non-fatal): ${err.message}`, 'migration');
  }
}

// Run migration on startup
migrateTeamColumn();

app.use(
  session({
    store: new PgSession({
      pool: pool,
      tableName: "session",
      createTableIfMissing: true,
      errorLog: (err) => {
        log(`Session store error: ${err.message}`, 'session');
      },
    }),
    secret: process.env.SESSION_SECRET || "fallback-secret-for-dev",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: process.env.NODE_ENV === "production" ? "lax" : undefined,
    },
  })
);

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

export default async function runApp(
  setup: (app: Express, server: Server) => Promise<void>,
) {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly run the final setup after setting up all the other routes so
  // the catch-all route doesn't interfere with the other routes
  await setup(app, server);

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
}
