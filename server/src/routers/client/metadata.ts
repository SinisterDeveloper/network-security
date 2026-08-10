import { Request, Response } from 'express';
import { deviceRepository } from '../../repos/DeviceRepository.js';
import { logRepository } from '../../repos/LogRepository.js';

export const GET = (_req: Request, res: Response): void => {
  const devices = deviceRepository.getAll();
  logRepository.push('METADATA_LIST', devices, null);
  res.status(200).json(devices);
};
