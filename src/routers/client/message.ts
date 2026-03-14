import { Request, Response } from 'express';
import crypto from 'crypto';
import storeHash from '../../contract.js';
import { deviceStore, normalizeDeviceId } from '../../deviceStore.js';
import { Message } from '../../types.js';

/**
 * POST /client/message
 * Creates a message for a device and stores its hash on-chain.
 * Body: { id: string; data: any }
 */
export const POST = async (req: Request, res: Response): Promise<void> => {
  const { id, data } = req.body as { id?: string | number; data?: unknown };
  const normalizedId = normalizeDeviceId(id);

  if (normalizedId === null) {
    res.status(400).json({ error: '"id" must be a 5-digit numeric value' });
    return;
  }
  if (typeof data === 'undefined') {
    res.status(400).json({ error: '"data" is required' });
    return;
  }

  const device = deviceStore.get(normalizedId);
  if (!device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  const timestamp = Date.now();
  const payload = JSON.stringify({ data, timestamp, deviceId: device.id });
  const hash = crypto.createHash('sha256').update(payload).digest('hex');

  const metadata = device.id;

  await storeHash(hash, metadata);

  const message: Message = {
    data,
    timestamp,
    hash,
    sender: device.id,
  };

  device.messages.push(message);

  res.status(201).json(message);
};

/**
 * GET /client/message?id={id}
 * Returns messages for a device.
 */
export const GET = (req: Request, res: Response): void => {
  const { id } = req.query as { id?: string | string[] };
  const normalizedId = normalizeDeviceId(Array.isArray(id) ? id[0] : id);

  if (normalizedId === null) {
    res.status(400).json({ error: '"id" query param must be a 5-digit numeric value' });
    return;
  }

  const device = deviceStore.get(normalizedId);
  if (!device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  res.status(200).json(device.messages);
};
