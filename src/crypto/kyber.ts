import { MlKem512 } from 'crystals-kyber-js';
import { createDecipheriv, createHash } from 'crypto';

const kyberInstance = new MlKem512();

function toBase64(data: Uint8Array): string {
  return Buffer.from(data).toString('base64');
}

function fromBase64(encoded: string): Uint8Array {
  return new Uint8Array(Buffer.from(encoded, 'base64'));
}

function deriveAes256Key(sharedSecret: Uint8Array): Buffer {
  // Derive a 32-byte key suitable for AES-256-GCM.
  return createHash('sha256').update(sharedSecret).digest();
}

export async function generateKyberKeyPair(): Promise<{
  publicKey: string;
  secretKey: Uint8Array;
}> {
  const [publicKey, secretKey] = await kyberInstance.generateKeyPair();
  return { publicKey: toBase64(publicKey), secretKey };
}

export async function decapKyberCiphertext(
  ciphertextBase64: string,
  secretKey: Uint8Array
): Promise<Uint8Array> {
  const ciphertext = fromBase64(ciphertextBase64);
  return kyberInstance.decap(ciphertext, secretKey);
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
  console.log("[DEBUG] secretKey length:", secretKey.length);
  console.log(
    "[DEBUG] secretKey (first 20 bytes hex):",
    Buffer.from(secretKey).slice(0, 20).toString("hex"),
  );
  const aesKey = deriveAes256Key(sharedSecret);

  console.log(
    "[DEBUG] sharedSecret (hex):",
    Buffer.from(sharedSecret).toString("hex"),
  );
  console.log(
    "[DEBUG] aesKey (hex)      :",
    Buffer.from(aesKey).toString("hex"),
  );
  console.log(
    "[DEBUG] iv (hex)          :",
    Buffer.from(ivBase64, "base64").toString("hex"),
  );

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

  console.log("[DEBUG] ciphertext (hex)  :", ciphertext.toString("hex"));
  console.log("[DEBUG] tag (hex)         :", tag.toString("hex"));

  const decipher = createDecipheriv('aes-256-gcm', aesKey, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
