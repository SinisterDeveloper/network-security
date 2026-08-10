import { Request, Response, NextFunction } from 'express';
import { getConfig } from '../config.js';

/**
 * Protects /admin/* when ADMIN_KEY is configured.
 * MVP: single shared key via X-Admin-Key header.
 * If ADMIN_KEY not set, routes remain open (dev mode) — warn on boot.
 */
export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const { adminKey } = getConfig();
  if (!adminKey) {
    next();
    return;
  }
  const provided = req.headers['x-admin-key'] as string | undefined;
  if (provided !== adminKey) {
    res.status(401).json({ error: 'Unauthorized: invalid or missing X-Admin-Key' });
    return;
  }
  next();
}
