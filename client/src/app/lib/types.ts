export interface Device {
  id: string;
  name: string;
  mac: string;
  /** @deprecated alias for mac kept for DeviceCard compat */
  macAddress: string;
  puf: string;
  firmwareHash: string;
  registeredAt: number;
  addedAt: Date;
  status: 'online' | 'offline';
}

export interface DeviceListItem {
  id: string;
  name: string;
  mac: string;
  puf: string;
  publicKey: string;
  messages: unknown[];
  registeredAt: number;
  firmwareHash: string;
}

export interface PendingDevicePayload {
  mac: string;
  puf: string;
  firmwareHash: string;
}
