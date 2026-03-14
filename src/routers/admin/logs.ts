import { Request, Response } from 'express';
import { Device } from '../../types.js';
import { deviceStore, Logs, logAction } from '../../deviceStore.js';

/**
 * GET /admin/logs
 * Returns every registered Device in the store.
 */
export const GET = (_req: Request, res: Response): void => {
  const devices: Device[] = Array.from(deviceStore.values());
  logAction('ADMIN_LOGS_VIEW', {
    deviceCount: devices.length,
    logCount: Logs.length + 1,
  });
  res.status(200).json({ devices, logs: Logs });
};
