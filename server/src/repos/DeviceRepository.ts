import { Device } from '../types.js';
import { deviceStore, generateUniqueDeviceId, normalizeDeviceId } from '../deviceStore.js';

export interface DeviceRepository {
  get(id: string): Device | undefined;
  getAll(): Device[];
  findByMac(mac: string): Device | undefined;
  findByPuf(puf: string): Device | undefined;
  save(device: Device): void;
  delete(id: string): boolean;
  has(id: string): boolean;
  size(): number;
  generateUniqueId(): string;
  normalizeId(input: unknown): string | null;
  clear(): void;
}

export const deviceRepository: DeviceRepository = {
  get: (id) => deviceStore.get(id),
  getAll: () => Array.from(deviceStore.values()),
  findByMac: (mac) => Array.from(deviceStore.values()).find((d) => d.mac === mac),
  findByPuf: (puf) => Array.from(deviceStore.values()).find((d) => d.puf === puf),
  save: (device) => { deviceStore.set(device.id, device); },
  delete: (id) => deviceStore.delete(id),
  has: (id) => deviceStore.has(id),
  size: () => deviceStore.size,
  generateUniqueId: () => generateUniqueDeviceId(),
  normalizeId: (input) => normalizeDeviceId(input),
  clear: () => deviceStore.clear(),
};
