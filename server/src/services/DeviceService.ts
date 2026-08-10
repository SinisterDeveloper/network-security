import { Device } from '../types.js';
import { deviceRepository } from '../repos/DeviceRepository.js';
import { keyVault } from '../repos/KeyVault.js';
import { logRepository } from '../repos/LogRepository.js';
import { newDeviceStore } from '../repos/NewDeviceStore.js';
import { generateKyberKeyPair } from '../crypto/kyber.js';

export interface CreateDeviceInput {
  name: string;
  puf: string;
  mac: string;
  firmwareHash: string;
}

export const deviceService = {
  async create(input: CreateDeviceInput): Promise<Device> {
    const id = deviceRepository.generateUniqueId();
    const { publicKey, secretKey } = await generateKyberKeyPair();
    const device: Device = {
      id,
      name: input.name,
      puf: input.puf,
      mac: input.mac,
      publicKey,
      messages: [],
      registeredAt: Date.now(),
      firmwareHash: input.firmwareHash,
    };
    deviceRepository.save(device);
    keyVault.set(device.id, secretKey);
    logRepository.push('DEVICE_CONNECT', device, device.id);
    newDeviceStore.set(null);
    return device;
  },

  delete(id: string): boolean {
    const normalized = deviceRepository.normalizeId(id);
    if (normalized === null || !deviceRepository.has(normalized)) return false;
    deviceRepository.delete(normalized);
    keyVault.delete(normalized);
    logRepository.push('DEVICE_DISCONNECT', { id: normalized }, normalized);
    return true;
  },

  findByMac(mac: string): Device | undefined {
    return deviceRepository.findByMac(mac);
  },

  getPublicKeyByMac(mac: string): string | null {
    const d = deviceRepository.findByMac(mac);
    return d ? d.publicKey : null;
  },

  list(): Device[] {
    return deviceRepository.getAll();
  },
};
