import { Request, Response } from 'express';
import { deviceStore, logAction } from '../../deviceStore.js';

/**
 * GET /client/metadata
 * Returns all registered devices.
 */
export const GET = (_req: Request, res: Response): void => {
  const devices = Array.from(deviceStore.values());
  logAction('METADATA_LIST', devices, null);
  res.status(200).json(devices);
};
