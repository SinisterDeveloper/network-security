import { Request, Response } from 'express';
import { deviceService } from '../../services/DeviceService.js';

export const POST = (req: Request, res: Response): void => {
  const { mac } = req.body as { mac?: string };
  if (!mac || typeof mac !== 'string') { res.status(400).json({ error: '"mac" (string) is required' }); return; }
  const publicKey = deviceService.getPublicKeyByMac(mac);
  if (!publicKey) { res.status(404).json({ error: 'Device not found' }); return; }
  res.status(200).json({ publicKey });
};
