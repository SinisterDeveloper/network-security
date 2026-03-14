import { Request, Response } from 'express';
import { Device } from '../../types.js';
import { deviceStore } from '../../deviceStore.js';

/**
 * GET /admin/logs
 * Returns every registered Device in the store.
 */
export const GET = (_req: Request, res: Response): void => {
  const devices: Device[] = Array.from(deviceStore.values());
  res.status(200).json(devices);
};
