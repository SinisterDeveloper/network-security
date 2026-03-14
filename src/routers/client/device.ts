import { Request, Response } from 'express';
import {
  deviceStore,
  generateUniqueDeviceId,
  logAction,
  normalizeDeviceId,
  secretKeys,
  setNewDeviceDetected,
} from '../../deviceStore.js';
import { Device } from '../../types.js';
import { generateKyberKeyPair } from '../../crypto/kyber.js';

/**
 * POST /client/device
 * Creates a Device object with a unique 5-digit id.
 * Body: { name: string; puf: string; mac: string }
 */
export const POST = async (req: Request, res: Response): Promise<void> => {
  const { name, puf, mac, firmwareHash } = req.body as {
    name?: string;
    puf?: string;
    mac?: string;
    firmwareHash?: string;
  };

  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: '"name" (string) is required' });
    return;
  }
  if (!puf || typeof puf !== 'string') {
    res.status(400).json({ error: '"puf" (string) is required' });
    return;
  }
  if (!mac || typeof mac !== 'string') {
    res.status(400).json({ error: '"mac" (string) is required' });
    return;
  }

  if (!firmwareHash || typeof firmwareHash !== "string") {
    res.status(400).json({ error: '"firmwareHash" (string) is required' });
    return;
  }

  setNewDeviceDetected(null);

  let id: string;
  try {
    id = generateUniqueDeviceId();
  } catch (error) {
    res.status(500).json({ error: 'Unable to allocate device id' });
    return;
  }

  const { publicKey, secretKey } = await generateKyberKeyPair();

  const device: Device = {
    id: id,
    name: name,
    puf: puf,
    mac: mac,
    publicKey: publicKey,
    messages: [],
    registeredAt: Date.now(),
    firmwareHash: firmwareHash
  };

  deviceStore.set(device.id, device);
  secretKeys.set(device.id, secretKey);
  logAction('DEVICE_CONNECT', device, device.id);

  console.log('New Device:\n', device);

  res.status(201).json(device);
};

/**
 * DELETE /client/device
 * Deletes the device by id.
 * Body: { id: string }
 */
export const DELETE = (req: Request, res: Response): void => {
  const { id } = req.body as { id?: string | number };
  const normalizedId = normalizeDeviceId(id);

  if (normalizedId === null) {
    res.status(400).json({ error: '"id" must be a 5-digit numeric value' });
    return;
  }

  if (!deviceStore.has(normalizedId)) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  deviceStore.delete(normalizedId);
  secretKeys.delete(normalizedId);
  logAction('DEVICE_DISCONNECT', { id: normalizedId }, normalizedId);
  res.status(200).json({ deleted: true, id: normalizedId });
  console.log('Device with ID: ', id, ' deleted!');
};
