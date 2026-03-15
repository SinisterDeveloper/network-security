import { Request, Response } from 'express';
import {
  NewDeviceRecord,
  getNewDeviceDetected,
  logAction,
  setNewDeviceDetected,
} from '../../deviceStore.js';

function isNewDevicePayload(value: unknown): value is NewDeviceRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.mac === 'string' &&
    typeof candidate.puf === 'string' &&
    typeof candidate.firmwareHash === 'string'
  );
}

export const POST = (req: Request, res: Response): void => {
  console.log('New device req reached');
  if (!isNewDevicePayload(req.body)) {
    res.status(400).json({
      error:
        'Payload must include mac, puf, and firmwareHash string properties',
    });
    return;
  }
  console.log("New device req almost there");

  const newDevice = req.body as NewDeviceRecord;
  setNewDeviceDetected(newDevice);
  logAction('NEW_DEVICE_DETECTED', newDevice, null);
  res.status(200).json({ newDeviceDetected: newDevice });
};

export const GET = (_req: Request, res: Response): void => {
  const current = getNewDeviceDetected();
  res.status(200).json(current);
};
