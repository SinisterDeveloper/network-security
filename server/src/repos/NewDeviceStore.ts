import { getNewDeviceDetected, setNewDeviceDetected, NewDeviceRecord } from '../deviceStore.js';

export type { NewDeviceRecord };

export const newDeviceStore = {
  set: (d: NewDeviceRecord | null) => setNewDeviceDetected(d),
  get: () => getNewDeviceDetected(),
  clear: () => setNewDeviceDetected(null),
};
