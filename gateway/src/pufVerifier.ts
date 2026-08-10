import { EXPECTED_SRAM_HEX_LEN } from './shared.js';

export function parseSramHex(hexString: unknown): Buffer | null {
  if (!hexString || typeof hexString !== 'string') return null;
  const cleaned = hexString.replace(/[^0-9A-Fa-f]/g, '');
  if (cleaned.length !== EXPECTED_SRAM_HEX_LEN) return null;
  if (cleaned.length % 2 !== 0) return null;
  return Buffer.from(cleaned, 'hex');
}

export function verifySram(storedBytes: Buffer, newBytes: Buffer, thresholdBits: number) {
  if (!storedBytes || !newBytes) return { isSame: false, flippedBits: Infinity, totalBits: 0, message: 'Invalid SRAM' };
  if (storedBytes.length !== newBytes.length) {
    return {
      isSame: false,
      flippedBits: Infinity,
      totalBits: Math.max(storedBytes.length, newBytes.length) * 8,
      message: `Length mismatch (${storedBytes.length} vs ${newBytes.length} bytes)`,
    };
  }
  let flippedBits = 0;
  for (let i = 0; i < storedBytes.length; i += 1) {
    let xor = storedBytes[i] ^ newBytes[i];
    while (xor) {
      flippedBits += xor & 1;
      xor >>= 1;
    }
  }
  const totalBits = storedBytes.length * 8;
  const isSame = flippedBits < thresholdBits;
  const message = isSame
    ? `Same ESP (noise: ${flippedBits} bits out of ${totalBits})`
    : `Different ESP (difference: ${flippedBits} bits out of ${totalBits})`;
  return { isSame, flippedBits, totalBits, message };
}
