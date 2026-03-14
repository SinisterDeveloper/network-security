import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { HttpMethod, RouteModule, asyncHandler } from './types';

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Converts a filesystem path to an Express route path.
 *
 * Examples:
 *   /routers/admin/logs.ts  -> /admin/logs
 *   /routers/client/users.ts -> /client/users
 *   /routers/admin/index.ts  -> /admin
 */
function filePathToRoutePath(routersDir: string, filePath: string): string {
  const relative = path.relative(routersDir, filePath);
  // Remove the file extension
  const withoutExt = relative.replace(/\.[jt]s$/, '');
  // Replace 'index' segments with '' so that /admin/index -> /admin
  const normalized = withoutExt
    .split(path.sep)
    .filter((segment) => segment !== 'index')
    .join('/');
  return '/' + normalized;
}

/**
 * Recursively collects all .ts (or .js) files under a directory.
 */
function collectRouteFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectRouteFiles(fullPath));
    } else if (/\.[jt]s$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Builds and returns an Express Router by scanning all route files under
 * `routersDir`.  Each file may export any combination of HTTP method handlers
 * (GET, POST, PUT, PATCH, DELETE) as named exports.
 *
 * This mirrors the Next.js API-routes convention:
 *   src/routers/admin/logs.ts  -> GET /admin/logs, POST /admin/logs, …
 *   src/routers/client/users.ts -> GET /client/users, …
 */
export function buildRouter(routersDir: string): Router {
  const router = Router();

  const routeFiles = collectRouteFiles(routersDir);

  for (const filePath of routeFiles) {
    const routePath = filePathToRoutePath(routersDir, filePath);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod: RouteModule = require(filePath) as RouteModule;

    let registered = false;
    for (const method of HTTP_METHODS) {
      const handler = mod[method];
      if (typeof handler === 'function') {
        router[method.toLowerCase() as Lowercase<HttpMethod>](
          routePath,
          asyncHandler(handler)
        );
        registered = true;
        console.log(`  [router] ${method.padEnd(6)} ${routePath}`);
      }
    }

    if (!registered) {
      console.warn(`  [router] No HTTP method exports found in: ${filePath}`);
    }
  }

  return router;
}
