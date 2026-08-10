import { secretKeys } from '../deviceStore.js';

export interface KeyVault {
  set(deviceId: string, secretKey: Uint8Array): void;
  get(deviceId: string): Uint8Array | undefined;
  delete(deviceId: string): boolean;
  clear(): void;
}

export const keyVault: KeyVault = {
  set: (id, sk) => { secretKeys.set(id, sk); },
  get: (id) => secretKeys.get(id),
  delete: (id) => secretKeys.delete(id),
  clear: () => secretKeys.clear(),
};
