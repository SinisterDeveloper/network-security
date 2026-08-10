export interface Device {
  id: string;
  name: string;
  macAddress: string;
  status: 'online' | 'offline';
  addedAt: Date;
}
