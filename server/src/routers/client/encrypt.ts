import { Request, Response } from 'express';
import { deviceStore } from '../../deviceStore.js';
import { encryptKyberAesGcmToBase64 } from '../../crypto/kyber.js';

/**
 * POST /client/encrypt
 * Encrypts plaintext with the device's ML-KEM-768 public key using hybrid Kyber+AES-GCM.
 * Body: { id?: string, mac?: string, publicKey?: string, plaintext: string }
 *  - Provide exactly one of id/mac/publicKey to resolve the encryption key.
 */
export const POST = async (req: Request, res: Response): Promise<void> => {
  const { id, mac, publicKey, plaintext } = req.body as {
    id?: string | number;
    mac?: string;
    publicKey?: string;
    plaintext?: string;
  };

  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    res.status(400).json({ error: '"plaintext" (string) is required' });
    return;
  }

  let resolvedPublicKey: string | null = null;

  if (publicKey && typeof publicKey === 'string') {
    resolvedPublicKey = publicKey;
  } else if (mac && typeof mac === 'string') {
    const device = Array.from(deviceStore.values()).find((d) => d.mac === mac);
    if (!device) {
      res.status(404).json({ error: 'Device not found for given mac' });
      return;
    }
    resolvedPublicKey = device.publicKey;
  } else if (id !== undefined) {
    const normalizedId = String(id).trim();
    const device = deviceStore.get(normalizedId);
    if (!device) {
      res.status(404).json({ error: 'Device not found for given id' });
      return;
    }
    resolvedPublicKey = device.publicKey;
  }

  if (!resolvedPublicKey) {
    res.status(400).json({ error: 'Provide one of "publicKey", "mac", or "id" to resolve encryption key' });
    return;
  }

  try {
    const result = await encryptKyberAesGcmToBase64({
      plaintext,
      publicKeyBase64: resolvedPublicKey,
    });
    res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Encryption failed';
    res.status(400).json({ error: message });
  }
};
