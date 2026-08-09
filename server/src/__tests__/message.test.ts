import { describe, it, expect, beforeEach, vi } from 'vitest';
const mockStoreHash = vi.fn(async () => '0xmockhash');
vi.mock('../contract.js', () => ({
  default: mockStoreHash,
  pendingHashes: [],
  __setMockContract: vi.fn(),
  __clearPendingHashes: vi.fn(),
  storeHashWithRetry: vi.fn(async () => '0xmockhash'),
  retryPendingHashes: vi.fn(async () => 0),
}));

import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../server.js';
import { deviceStore, secretKeys, Logs } from '../deviceStore.js';
import { encryptKyberAesGcmToBase64 } from '../crypto/kyber.js';

describe('POST /client/message decrypt + hash', () => {
  let app: any;
  let deviceId: string;
  let publicKey: string;

  beforeEach(async () => {
    deviceStore.clear();
    secretKeys.clear();
    Logs.length = 0;
    mockStoreHash.mockClear();
    app = await createApp();
    const res = await request(app)
      .post('/client/device')
      .send({ name: 'sensor-01', puf: 'puf-xyz', mac: 'AA:BB:CC:DD:EE:FF', firmwareHash: 'abc' });
    deviceId = res.body.id;
    publicKey = res.body.publicKey;
  });

  it('decrypts, hashes plaintext, stores message, and tolerates alias payloadCiphertextBase64', async () => {
    const plaintext = 'hello from sensor';
    const { kyberCiphertextBase64, ivBase64, payloadCiphertextBase64 } = await encryptKyberAesGcmToBase64({
      plaintext,
      publicKeyBase64: publicKey,
    });

    const res = await request(app)
      .post('/client/message')
      .send({ id: deviceId, data: payloadCiphertextBase64, kyberCiphertextBase64, ivBase64 });

    expect(res.status).toBe(201);
    expect(res.body.data).toBe(plaintext);
    expect(res.body.sender).toBe(deviceId);
    expect(typeof res.body.hash).toBe('string');
    expect(mockStoreHash).toHaveBeenCalledTimes(1);
    const storedHash = (mockStoreHash.mock.calls[0] as unknown[])[0] as string;
    expect(storedHash).toBe(res.body.hash);
    // Verify hash is of plaintext, not ciphertext
    const recomputed = crypto.createHash('sha256').update(JSON.stringify({ data: plaintext, timestamp: res.body.timestamp, deviceId })).digest('hex');
    expect(res.body.hash).toBe(recomputed);

    // GET returns plaintext
    const getRes = await request(app).get(`/client/message?id=${deviceId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body[0].data).toBe(plaintext);
  });

  it('400 on bad iv', async () => {
    const { kyberCiphertextBase64, payloadCiphertextBase64 } = await encryptKyberAesGcmToBase64({ plaintext: 'x', publicKeyBase64: publicKey });
    const res = await request(app)
      .post('/client/message')
      .send({ id: deviceId, data: payloadCiphertextBase64, kyberCiphertextBase64, ivBase64: 'aGVsbG8=' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Decryption failed/);
  });

  it('still stores message when blockchain fails (graceful)', async () => {
    mockStoreHash.mockRejectedValueOnce(new Error('RPC down'));
    const { kyberCiphertextBase64, ivBase64, payloadCiphertextBase64 } = await encryptKyberAesGcmToBase64({ plaintext: 'persist', publicKeyBase64: publicKey });
    const res = await request(app)
      .post('/client/message')
      .send({ id: deviceId, data: payloadCiphertextBase64, kyberCiphertextBase64, ivBase64 });
    expect(res.status).toBe(201);
    expect(res.body.data).toBe('persist');
  });

  it('POST /client/encrypt then /client/message roundtrip via mac', async () => {
    const encRes = await request(app).post('/client/encrypt').send({ mac: 'AA:BB:CC:DD:EE:FF', plaintext: 'via-mac' });
    expect(encRes.status).toBe(200);
    const { kyberCiphertextBase64, ivBase64, payloadCiphertextBase64 } = encRes.body;
    const msgRes = await request(app).post('/client/message').send({ id: deviceId, data: payloadCiphertextBase64, kyberCiphertextBase64, ivBase64 });
    expect(msgRes.status).toBe(201);
    expect(msgRes.body.data).toBe('via-mac');
  });
});
