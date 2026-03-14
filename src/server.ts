import express, { Application, Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildRouter } from './routeHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTERS_DIR = path.join(__dirname, 'routers');

/**
 * Creates and configures the Express application.
 * Dynamic routes are loaded from `src/routers/` following the
 * Next.js-style file-system routing convention.
 */
export async function createApp(): Promise<Application> {
  const app = express();

  // Parse JSON request bodies
  app.use(express.json());
  // Parse URL-encoded request bodies
  app.use(express.urlencoded({ extended: true }));

  // Mount all file-system routes discovered under src/routers/
  console.log('[server] Registering file-system routes:');
  const router = await buildRouter(ROUTERS_DIR);
  app.use('/', router);

  // 404 handler – no route matched
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // Generic error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[server] Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
}
