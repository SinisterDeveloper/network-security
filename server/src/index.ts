import { config } from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { createApp } from "./server.js";
import { getConfig } from "./config.js";
import { blockchainService } from "./services/BlockchainService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const candidates = [
  join(__dirname, "../../../.env"),
  join(__dirname, "../../.env"),
  join(process.cwd(), ".env"),
];
for (const p of candidates) {
  if (fs.existsSync(p)) {
    config({ path: p });
    break;
  }
}

async function bootstrap(): Promise<void> {
  const cfg = getConfig();
  if (!cfg.adminKey) {
    console.warn("[server] ADMIN_KEY not set — /admin/* open (dev mode). Set ADMIN_KEY in .env for MVP security.");
  }
  if (!cfg.privateKey || !cfg.contractAddress) {
    console.warn("[server] PRIVATE_KEY/CONTRACT_ADDRESS missing — blockchain anchoring will queue pending hashes.");
  }

  const app = await createApp();

  // Fire-and-forget retry interval — previously never started
  blockchainService.startRetryInterval(30_000);

  app.listen(cfg.port, '0.0.0.0', () => {
    console.log(`[server] Listening on http://localhost:${cfg.port}`);
    if (cfg.corsOrigins.length > 0) console.log(`[server] CORS origins: ${cfg.corsOrigins.join(', ')}`);
  });
}

bootstrap().catch((err) => {
  console.error('[server] Failed to start', err);
  process.exitCode = 1;
});
