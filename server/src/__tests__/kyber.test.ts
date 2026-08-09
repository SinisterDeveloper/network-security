import { describe, it, expect } from 'vitest';
import { generateKyberKeyPair, encryptKyberAesGcmToBase64, decryptKyberAesGcmToString } from '../crypto/kyber.js';

describe('kyber 768 roundtrip', () => {
  it('encapsulates and decrypts to original plaintext', async () => {
    const { publicKey, secretKey } = await generateKyberKeyPair();
    // publicKey for 768 should be 1184 bytes => ~1579 base64 chars
    const pkBytes = Buffer.from(publicKey, 'base64');
    expect(pkBytes.length).toBe(1184);

    const plaintext = 'hello from sensor: temp=42.5';
    const { kyberCiphertextBase64, ivBase64, payloadCiphertextBase64 } =
      await encryptKyberAesGcmToBase64({ plaintext, publicKeyBase64: publicKey });

    const decrypted = await decryptKyberAesGcmToString({
      kyberCiphertextBase64,
      payloadCiphertextBase64,
      ivBase64,
      secretKey,
    });

    expect(decrypted).toBe(plaintext);
  });

  it('fails on wrong iv length', async () => {
    const { publicKey, secretKey } = await generateKyberKeyPair();
    const { kyberCiphertextBase64, payloadCiphertextBase64 } =
      await encryptKyberAesGcmToBase64({ plaintext: 'x', publicKeyBase64: publicKey });
    await expect(
      decryptKyberAesGcmToString({
        kyberCiphertextBase64,
        payloadCiphertextBase64,
        ivBase64: Buffer.from([1, 2, 3]).toString('base64'),
        secretKey,
      })
    ).rejects.toThrow(/IV must be 12 bytes/);
  });
});
