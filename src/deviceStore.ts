import { Device } from './types.js';

const MIN_DEVICE_ID = 10000;
const MAX_DEVICE_ID = 99999;
const MAX_ID_ATTEMPTS = 10000;

export const deviceStore = new Map<string, Device>();

export function generateUniqueDeviceId(): string {
  if (deviceStore.size >= MAX_DEVICE_ID - MIN_DEVICE_ID + 1) {
    throw new Error('Device store is full');
  }

  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    const candidate =
      Math.floor(Math.random() * (MAX_DEVICE_ID - MIN_DEVICE_ID + 1)) +
      MIN_DEVICE_ID;
    const id = candidate.toString();
    if (!deviceStore.has(id)) {
      return id;
    }
  }

  throw new Error('Unable to generate a unique device id');
}

export function normalizeDeviceId(input: unknown): string | null {
  if (typeof input === 'number' && Number.isInteger(input)) {
    if (input < MIN_DEVICE_ID || input > MAX_DEVICE_ID) {
      return null;
    }
    return input.toString();
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!/^\d{5}$/.test(trimmed)) {
      return null;
    }
    const parsed = Number.parseInt(trimmed, 10);
    return parsed >= MIN_DEVICE_ID && parsed <= MAX_DEVICE_ID ? trimmed : null;
  }

  return null;
}
