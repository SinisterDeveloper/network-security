import { Request, Response } from 'express';
import { newDeviceStore } from '../../repos/NewDeviceStore.js';
import { logRepository } from '../../repos/LogRepository.js';
import { FIRMWARE_HASH_REGEX } from '../../shared.js';
import { NewDeviceRecord } from '../../deviceStore.js';

function isNewDevicePayload(value: unknown): value is NewDeviceRecord {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  if (typeof c.mac !== 'string' || typeof c.puf !== 'string' || typeof c.firmwareHash !== 'string') return false;
  if (!FIRMWARE_HASH_REGEX.test(c.firmwareHash)) return false;
  return true;
}

export const POST = (req: Request, res: Response): void => {
  if (!isNewDevicePayload(req.body)) {
    res.status(400).json({ error: 'Payload must include mac, puf, and firmwareHash (64-char hex sha256) string properties' });
    return;
  }
  const newDevice = req.body as NewDeviceRecord;
  newDeviceStore.set(newDevice);
  logRepository.push('NEW_DEVICE_DETECTED', newDevice, null);
  res.status(200).json({ newDeviceDetected: newDevice });
};

export const GET = (_req: Request, res: Response): void => {
  res.status(200).json(newDeviceStore.get());
};
