import { createApp } from './server.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const app = createApp();

app.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT}`);
});
