import { Request, Response } from 'express';
import crypto from 'crypto';
import storeHash from '../../contract.js';
import { deviceStore, logAction, normalizeDeviceId, secretKeys } from '../../deviceStore.js';
import { Message } from '../../types.js';
import { decryptKyberAesGcmToString } from '../../crypto/kyber.js';

/**
 * POST /client/message
 * Creates a message for a device and stores its hash on-chain.
 * Body: {
 *   id: string;
 *   data: string; // base64(ciphertext || tag)
 *   kyberCiphertextBase64: string;
 *   ivBase64: string;
 * }
 */
export const POST = async (req: Request, res: Response): Promise<void> => {
  const { id, kyberCiphertextBase64, ivBase64 } = req.body as {
    id?: string | number;
    kyberCiphertextBase64?: unknown;
    ivBase64?: unknown;
  };
  // Accept both `data` (spec) and `payloadCiphertextBase64` (gateway/ESP alias)
  const rawData = (req.body as Record<string, unknown>).data ??
    (req.body as Record<string, unknown>).payloadCiphertextBase64;
  const data = rawData as unknown;

  const normalizedId = normalizeDeviceId(id);


  if (normalizedId === null) {
    res.status(400).json({ error: '"id" must be a 5-digit numeric value' });
    return;
  }
  if (typeof data !== 'string') {
    res.status(400).json({ error: '"data" must be a base64 string (alias: payloadCiphertextBase64)' });
    return;
  }
  if (typeof kyberCiphertextBase64 !== 'string') {
    res.status(400).json({ error: '"kyberCiphertextBase64" (string) is required' });
    return;
  }
  if (typeof ivBase64 !== 'string') {
    res.status(400).json({ error: '"ivBase64" (string) is required' });
    return;
  }


  const device = deviceStore.get(normalizedId);
  if (!device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  const secretKey = secretKeys.get(device.id);
  if (!secretKey) {
    res.status(500).json({ error: 'Device secret key not found' });
    return;
  }

  let plaintext: string;
  try {
    plaintext = await decryptKyberAesGcmToString({
      kyberCiphertextBase64,
      payloadCiphertextBase64: data,
      ivBase64,
      secretKey,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Decryption failed';
    res.status(400).json({ error: `Decryption failed: ${message}` });
    return;
  }

  const timestamp = Date.now();
  const payload = JSON.stringify({
    data: plaintext,
    timestamp,
    deviceId: device.id,
  });
  const hash = crypto.createHash('sha256').update(payload).digest('hex');

  const metadata = device.id;

  try {
    await storeHash(hash, metadata);
  } catch (err) {
    // Blockchain failure should not lose the message; store anyway and report hash pending.
    // Client can verify hash on-chain later; we log the failure.
    logAction('ENCRYPTION' as unknown as never, { deviceId: device.id, hashError: err instanceof Error ? err.message : String(err) }, device.id);
  }

  const message: Message = {
    data: plaintext,
    timestamp,
    hash,
    sender: device.id,
  };

  device.messages.push(message);
  logAction('DECRYPTION', { deviceId: device.id, message }, device.id);

  res.status(201).json(message);
};

/**
 * GET /client/message?id={id}
 * Returns messages for a device.
 */
export const GET = (req: Request, res: Response): void => {
  const { id } = req.query as { id?: string | string[] };
  const normalizedId = normalizeDeviceId(Array.isArray(id) ? id[0] : id);

  if (normalizedId === null) {
    res.status(400).json({ error: '"id" query param must be a 5-digit numeric value' });
    return;
  }

  const device = deviceStore.get(normalizedId);
  if (!device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  logAction(
    'MESSAGE_RETRIEVAL',
    {
      deviceId: device.id,
      messageCount: device.messages.length,
    },
    device.id
  );

  res.status(200).json(device.messages);
};
