import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('../contract.js', () => ({
  default: vi.fn(async () => '0xmockhash'),
  __setMockContract: vi.fn(),
}));

import request from 'supertest';
import { createApp } from '../server.js';
import { deviceStore, secretKeys, Logs } from '../deviceStore.js';

describe('POST /client/device & DELETE', () => {
  let app: any;
  beforeEach(async () => {
    deviceStore.clear();
    secretKeys.clear();
    Logs.length = 0;
    app = await createApp();
  });

  it('creates device with 768 publicKey', async () => {
    const res = await request(app)
      .post('/client/device')
      .send({ name: 'sensor-01', puf: 'puf-xyz', mac: 'AA:BB:CC:DD:EE:FF', firmwareHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^\d{5}$/);
    expect(res.body.publicKey).toBeDefined();
    const pkBytes = Buffer.from(res.body.publicKey, 'base64');
    expect(pkBytes.length).toBe(1184);
    expect(deviceStore.has(res.body.id)).toBe(true);
    expect(secretKeys.has(res.body.id)).toBe(true);
  });

  it('400 on missing firmwareHash', async () => {
    const res = await request(app)
      .post('/client/device')
      .send({ name: 'x', puf: 'p', mac: 'm' });
    expect(res.status).toBe(400);
  });

  it('DELETE removes device', async () => {
    const created = await request(app)
      .post('/client/device')
      .send({ name: 's', puf: 'p', mac: 'm1', firmwareHash: 'h' });
    const id = created.body.id;
    const del = await request(app).delete('/client/device').send({ id });
    expect(del.status).toBe(200);
    expect(del.body.deleted).toBe(true);
    expect(deviceStore.has(id)).toBe(false);
  });
});
