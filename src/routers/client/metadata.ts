import { Request, Response } from 'express';
import { deviceStore } from '../../deviceStore.js';

/**
 * GET /client/metadata
 * Returns all registered devices.
 */
export const GET = (_req: Request, res: Response): void => {
  const devices = Array.from(deviceStore.values());
  res.status(200).json(devices);
};

