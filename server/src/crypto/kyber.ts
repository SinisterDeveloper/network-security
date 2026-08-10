import { MlKem768 } from 'crystals-kyber-js';
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'crypto';

const kyberInstance = new MlKem768();

function toBase64(data: Uint8Array): string {
  return Buffer.from(data).toString('base64');
}

function fromBase64(encoded: string): Uint8Array {
  return new Uint8Array(Buffer.from(encoded, 'base64'));
}

function deriveAes256Key(sharedSecret: Uint8Array): Buffer {
  // HKDF-SHA256 is the correct KDF for KEM shared secrets (not raw SHA256)
  return Buffer.from(hkdfSync('sha256', Buffer.from(sharedSecret), Buffer.alloc(0), Buffer.from('EmbSec-AES256GCM'), 32));
}

export async function generateKyberKeyPair(): Promise<{
  publicKey: string;
  secretKey: Uint8Array;
}> {
  const [publicKey, secretKey] = await kyberInstance.generateKeyPair();
  return { publicKey: toBase64(publicKey), secretKey };
}

export async function encapsulateKyber(
  publicKeyBase64: string
): Promise<{ ciphertextBase64: string; sharedSecret: Uint8Array }> {
  const publicKey = fromBase64(publicKeyBase64);
  const [ciphertext, sharedSecret] = await kyberInstance.encap(publicKey);
  return { ciphertextBase64: toBase64(ciphertext), sharedSecret };
}

export async function decapKyberCiphertext(
  ciphertextBase64: string,
  secretKey: Uint8Array
): Promise<Uint8Array> {
  const ciphertext = fromBase64(ciphertextBase64);
  return kyberInstance.decap(ciphertext, secretKey);
}

export async function encryptKyberAesGcmToBase64(options: {
  plaintext: string;
  publicKeyBase64: string;
}): Promise<{
  kyberCiphertextBase64: string;
  ivBase64: string;
  payloadCiphertextBase64: string;
}> {
  const { plaintext, publicKeyBase64 } = options;
  const { ciphertextBase64, sharedSecret } = await encapsulateKyber(publicKeyBase64);
  const aesKey = deriveAes256Key(sharedSecret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([ciphertext, tag]);
  return {
    kyberCiphertextBase64: ciphertextBase64,
    ivBase64: iv.toString('base64'),
    payloadCiphertextBase64: payload.toString('base64'),
  };
}

export async function decryptKyberAesGcmToString(options: {
  kyberCiphertextBase64: string;
  payloadCiphertextBase64: string;
  ivBase64: string;
  secretKey: Uint8Array;
}): Promise<string> {
  const { kyberCiphertextBase64, payloadCiphertextBase64, ivBase64, secretKey } =
    options;

  const sharedSecret = await decapKyberCiphertext(kyberCiphertextBase64, secretKey);
  const aesKey = deriveAes256Key(sharedSecret);

  const iv = Buffer.from(ivBase64, 'base64');
  if (iv.length !== 12) {
    throw new Error('AES-GCM IV must be 12 bytes');
  }

  const payload = Buffer.from(payloadCiphertextBase64, 'base64');
  if (payload.length < 16) {
    throw new Error('Payload ciphertext is too short to include auth tag');
  }

  const tag = payload.subarray(payload.length - 16);
  const ciphertext = payload.subarray(0, payload.length - 16);

  const decipher = createDecipheriv('aes-256-gcm', aesKey, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
