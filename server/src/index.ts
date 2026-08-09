import { config } from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { createApp } from "./server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env from monorepo root (works for both ts-node and compiled dist)
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

const PORT = process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT, 10) : (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);

async function bootstrap(): Promise<void> {
  const app = await createApp();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] Listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[server] Failed to start', err);
  process.exitCode = 1;
});
