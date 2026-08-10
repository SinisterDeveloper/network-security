import { Request, Response } from 'express';
import { deviceRepository } from '../../repos/DeviceRepository.js';
import { deviceService } from '../../services/DeviceService.js';

export const POST = async (req: Request, res: Response): Promise<void> => {
  const { name, puf, mac, firmwareHash } = req.body as {
    name?: string;
    puf?: string;
    mac?: string;
    firmwareHash?: string;
  };

  if (!name || typeof name !== 'string') { res.status(400).json({ error: '"name" (string) is required' }); return; }
  if (!puf || typeof puf !== 'string') { res.status(400).json({ error: '"puf" (string) is required' }); return; }
  if (!mac || typeof mac !== 'string') { res.status(400).json({ error: '"mac" (string) is required' }); return; }
  if (!firmwareHash || typeof firmwareHash !== 'string') { res.status(400).json({ error: '"firmwareHash" (string) is required' }); return; }

  try {
    const device = await deviceService.create({ name, puf, mac, firmwareHash });
    res.status(201).json(device);
  } catch (error) {
    res.status(500).json({ error: 'Unable to allocate device id' });
  }
};

export const DELETE = (req: Request, res: Response): void => {
  const { id } = req.body as { id?: string | number };
  const normalizedId = deviceRepository.normalizeId(id);
  if (normalizedId === null) { res.status(400).json({ error: '"id" must be a 5-digit numeric value' }); return; }
  if (!deviceRepository.has(normalizedId)) { res.status(404).json({ error: 'Device not found' }); return; }
  deviceService.delete(normalizedId);
  res.status(200).json({ deleted: true, id: normalizedId });
};
