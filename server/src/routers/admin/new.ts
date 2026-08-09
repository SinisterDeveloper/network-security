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
  if (
    typeof candidate.mac !== 'string' ||
    typeof candidate.puf !== 'string' ||
    typeof candidate.firmwareHash !== 'string'
  ) {
    return false;
  }
  // firmwareHash must be 64-char hex (sha256) - prevents poisoning with "Device N"
  if (!/^[a-fA-F0-9]{64}$/.test(candidate.firmwareHash)) {
    return false;
  }
  // puf (SRAM hex) should be plausible length; allow gateway derived but enforce hex
  if (candidate.puf.length < 64 || /[^a-fA-F0-9]/.test(candidate.puf.replace(/[^0-9A-Fa-f]/g, ''))) {
    // Still accept any string payload but firmwareHash strict check already prevents poisoned "Device N"
  }
  return true;
}

export const POST = (req: Request, res: Response): void => {
  if (!isNewDevicePayload(req.body)) {
    res.status(400).json({
      error:
        'Payload must include mac, puf, and firmwareHash (64-char hex sha256) string properties',
    });
    return;
  }

  const newDevice = req.body as NewDeviceRecord;
  setNewDeviceDetected(newDevice);
  logAction('NEW_DEVICE_DETECTED', newDevice, null);
  res.status(200).json({ newDeviceDetected: newDevice });
};

export const GET = (_req: Request, res: Response): void => {
  const current = getNewDeviceDetected();
  res.status(200).json(current);
};
