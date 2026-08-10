import express, { Application, Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { buildRouter } from './routeHandler.js';
import { getConfig } from './config.js';
import { adminAuth } from './middleware/adminAuth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTERS_DIR = path.join(__dirname, 'routers');

export async function createApp(): Promise<Application> {
  const app = express();
  const config = getConfig();

  // CORS: restrict when CORS_ORIGINS set, otherwise allow all (dev)
  if (config.corsOrigins.length > 0) {
    app.use(cors({ origin: config.corsOrigins }));
  } else {
    app.use(cors());
  }

  // Body limits prevent StaticJsonDocument OOM via large payloads
  app.use(express.json({ limit: '50kb' }));
  app.use(express.urlencoded({ extended: true, limit: '50kb' }));

  // Admin auth — applied selectively inside router mount via middleware wrapper
  // We mount adminAuth only for /admin/* by splitting routers:
  const allRouter = await buildRouter(ROUTERS_DIR);

  // Wrap /admin routes with auth — rebuild filtering: mount adminAuth before admin paths
  // Simpler: global check that only enforces on /admin
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/admin')) {
      return adminAuth(req, res, next);
    }
    next();
  });

  console.log('[server] Registering file-system routes:');
  app.use('/', allRouter);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[server] Unhandled error:', err);
    const status = (err as { status?: number }).status ?? 500;
    res.status(status).json({ error: err.message || 'Internal Server Error' });
  });

  return app;
}
