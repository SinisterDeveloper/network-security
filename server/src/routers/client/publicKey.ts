import { Request, Response } from 'express';
import { deviceStore } from '../../deviceStore.js';

/**
 * POST /client/publicKey
 * Body: { mac: string }
 * Returns the stored public key for the matching device.
 */
export const POST = (req: Request, res: Response): void => {
  const { mac } = req.body as { mac?: string };

  if (!mac || typeof mac !== 'string') {
    res.status(400).json({ error: '"mac" (string) is required' });
    return;
  }

  const device = Array.from(deviceStore.values()).find(
    (deviceEntry) => deviceEntry.mac === mac,
  );

  if (!device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  res.status(200).json({ publicKey: device.publicKey });
};
