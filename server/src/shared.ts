/**
 * Shared constants used by both gateway and server.
 * Single source of truth — do not duplicate.
 */

export const EXPECTED_SRAM_BYTES = 512;
export const EXPECTED_SRAM_HEX_LEN = EXPECTED_SRAM_BYTES * 2; // 1024
export const BLOCK_THRESHOLD_BITS = 350;
export const NEW_DEVICE_PENALTY = 50;

export const FIRMWARE_HASH_REGEX = /^[a-fA-F0-9]{64}$/;
export const PUF_HEX_MIN_LEN = 64;
