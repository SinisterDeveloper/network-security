import { Request, Response } from 'express';

/**
 * GET /client/status
 * Returns the current server status for the client API.
 */
export const GET = (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
};
