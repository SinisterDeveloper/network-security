import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface GatewayConfig {
  port: number;
  forwardBase: string;
  blockThresholdBits: number;
  fetchTimeoutMs: number;
  stateFile: string;
  adminKey: string | undefined;
  expectedSramBytes: number;
  expectedSramHexLen: number;
}

export function loadConfig(): GatewayConfig {
  const port = Number(process.env.GATEWAY_PORT) || Number(process.env.PORT) || 8824;
  const forwardBase = process.env.FORWARD_BASE || 'http://localhost:3000';
  const blockThresholdBits = Number(process.env.BLOCK_THRESHOLD_BITS) || 350;
  const fetchTimeoutMs = Number(process.env.GATEWAY_FETCH_TIMEOUT_MS) || 5000;
  // state file now only stores blockedDevices (legacy data.json may contain devices key — we migrate)
  const stateFile = path.join(path.dirname(__dirname), 'data.json');
  return {
    port,
    forwardBase,
    blockThresholdBits,
    fetchTimeoutMs,
    stateFile,
    adminKey: process.env.ADMIN_KEY ?? undefined,
    expectedSramBytes: 512,
    expectedSramHexLen: 1024,
  };
}
