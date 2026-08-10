import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from monorepo root (dist -> ../../.. , src -> ../..)
const candidates = [
  path.join(__dirname, '../../.env'),
  path.join(__dirname, '../../../.env'),
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '../.env'),
];
for (const p of candidates) {
  if (fs.existsSync(p)) { dotenv.config({ path: p }); break; }
}

import { loadConfig } from './config.js';
import { createGatewayApp, getLocalIPs, initGateway } from './app.js';
import { getBlockedDevices } from './blockedStore.js';

const config = loadConfig();
initGateway();

const app = createGatewayApp();

app.listen(config.port, '0.0.0.0', () => {
  const ips = getLocalIPs();
  console.log(`Gateway running on port ${config.port}`);
  console.log('Local Network Access:');
  ips.forEach((ip) => console.log(`  http://${ip}:${config.port}`));
  console.log(`Forwarding Target Base: ${config.forwardBase}`);
  console.log(`BLOCK_THRESHOLD_BITS: ${config.blockThresholdBits} (expected SRAM 512B)`);
  console.log(`Blocked Devices: ${getBlockedDevices().length}`);
  if (!config.adminKey) console.log('ADMIN_KEY not set — gateway will call /admin/new without auth (dev mode)');
  console.log('');
});

export { app };
export * from './pufVerifier.js';
export { getBlockedDevices } from './blockedStore.js';
