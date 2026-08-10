import crypto from 'crypto';
import { Message } from '../types.js';
import { deviceRepository } from '../repos/DeviceRepository.js';
import { keyVault } from '../repos/KeyVault.js';
import { logRepository } from '../repos/LogRepository.js';
import { decryptKyberAesGcmToString } from '../crypto/kyber.js';
import { blockchainService } from './BlockchainService.js';

export interface CreateMessageInput {
  id: string | number;
  data: string; // base64(ciphertext||tag) — alias payloadCiphertextBase64
  kyberCiphertextBase64: string;
  ivBase64: string;
}

export interface CreateMessageResult {
  message: Message & { hashStored: boolean };
}

export const messageService = {
  async create(input: CreateMessageInput): Promise<CreateMessageResult> {
    const normalizedId = deviceRepository.normalizeId(input.id);
    if (normalizedId === null) throw Object.assign(new Error('"id" must be a 5-digit numeric value'), { status: 400 });

    const device = deviceRepository.get(normalizedId);
    if (!device) throw Object.assign(new Error('Device not found'), { status: 404 });

    const secretKey = keyVault.get(device.id);
    if (!secretKey) throw Object.assign(new Error('Device secret key not found'), { status: 500 });

    let plaintext: string;
    try {
      plaintext = await decryptKyberAesGcmToString({
        kyberCiphertextBase64: input.kyberCiphertextBase64,
        payloadCiphertextBase64: input.data,
        ivBase64: input.ivBase64,
        secretKey,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Decryption failed';
      throw Object.assign(new Error(`Decryption failed: ${msg}`), { status: 400 });
    }

    const timestamp = Date.now();
    const payload = JSON.stringify({ data: plaintext, timestamp, deviceId: device.id });
    const hash = crypto.createHash('sha256').update(payload).digest('hex');
    const metadata = device.id;

    // Fire-and-forget — never blocks response on Polygon latency
    const hashStored = await blockchainService.anchorHash(hash, metadata);

    const message: Message & { hashStored: boolean } = {
      data: plaintext,
      timestamp,
      hash,
      sender: device.id,
      hashStored,
    };

    device.messages.push(message);
    logRepository.push('DECRYPTION', { deviceId: device.id, message }, device.id);

    return { message };
  },

  list(deviceId: string | number): Message[] {
    const normalizedId = deviceRepository.normalizeId(deviceId);
    if (normalizedId === null) throw Object.assign(new Error('"id" query param must be a 5-digit numeric value'), { status: 400 });
    const device = deviceRepository.get(normalizedId);
    if (!device) throw Object.assign(new Error('Device not found'), { status: 404 });
    logRepository.push('MESSAGE_RETRIEVAL', { deviceId: device.id, messageCount: device.messages.length }, device.id);
    return device.messages;
  },
};
