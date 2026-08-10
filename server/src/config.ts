export interface AppConfig {
  port: number;
  forwardBase: string;
  amoyRpcUrl: string;
  privateKey: string | undefined;
  contractAddress: string | undefined;
  adminKey: string | undefined;
  corsOrigins: string[];
  blockThresholdBits: number;
  newDevicePenalty: number;
  gatewayFetchTimeoutMs: number;
}

function parseOrigins(value: string | undefined): string[] {
  if (!value || value.trim() === "") return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

export function loadConfig(): AppConfig {
  const port = process.env.SERVER_PORT
    ? Number.parseInt(process.env.SERVER_PORT, 10)
    : process.env.PORT
      ? Number.parseInt(process.env.PORT, 10)
      : 3000;

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid SERVER_PORT: ${process.env.SERVER_PORT}`);
  }

  return {
    port,
    forwardBase: process.env.FORWARD_BASE || "http://localhost:3000",
    amoyRpcUrl: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
    privateKey: process.env.AMOY_PRIVATE_KEY ?? process.env.PRIVATE_KEY ?? undefined,
    contractAddress: process.env.CONTRACT_ADDRESS ?? undefined,
    adminKey: process.env.ADMIN_KEY ?? undefined,
    corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
    blockThresholdBits: process.env.BLOCK_THRESHOLD_BITS
      ? Number.parseInt(process.env.BLOCK_THRESHOLD_BITS, 10)
      : 350,
    newDevicePenalty: process.env.NEW_DEVICE_PENALTY
      ? Number.parseInt(process.env.NEW_DEVICE_PENALTY, 10)
      : 50,
    gatewayFetchTimeoutMs: process.env.GATEWAY_FETCH_TIMEOUT_MS
      ? Number.parseInt(process.env.GATEWAY_FETCH_TIMEOUT_MS, 10)
      : 5000,
  };
}

let cached: AppConfig | null = null;
export function getConfig(): AppConfig {
  if (!cached) cached = loadConfig();
  return cached;
}

/** For tests: clear cached config */
export function __clearConfigCache(): void {
  cached = null;
}
