import "dotenv/config";
import { createApp } from "./server.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function bootstrap(): Promise<void> {
  const app = await createApp();
  app.listen(PORT, () => {
    console.log(`[server] Listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[server] Failed to start', err);
  process.exitCode = 1;
});
