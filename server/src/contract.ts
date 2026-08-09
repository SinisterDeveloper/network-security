import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let cachedContract: ethers.Contract | null = null;
let artifactAbi: ethers.InterfaceAbi | null = null;

export interface PendingHash {
  hash: string;
  metadata: string;
  timestamp: number;
  attempts: number;
}

export const pendingHashes: PendingHash[] = [];

function getEnv(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}

function loadAbi(): ethers.InterfaceAbi {
  if (artifactAbi) return artifactAbi;
  const candidates = [
    path.join(__dirname, "../../blockchain/artifacts/contracts/HashStorage.sol/HashStorage.json"),
    path.join(__dirname, "../../../blockchain/artifacts/contracts/HashStorage.sol/HashStorage.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
      artifactAbi = raw.abi as ethers.InterfaceAbi;
      return artifactAbi;
    }
  }
  throw new Error(
    "HashStorage artifact not found. Run `npm run compile -w blockchain` to generate blockchain/artifacts."
  );
}

function getContract(): ethers.Contract {
  if (cachedContract) return cachedContract;

  const rpcUrl = getEnv("AMOY_RPC_URL", "https://rpc-amoy.polygon.technology");
  const privateKey = getEnv("AMOY_PRIVATE_KEY") ?? getEnv("PRIVATE_KEY");
  const contractAddress = getEnv("CONTRACT_ADDRESS");

  if (!rpcUrl) throw new Error("Missing AMOY_RPC_URL");
  if (!privateKey) throw new Error("Missing AMOY_PRIVATE_KEY or PRIVATE_KEY in .env");
  if (!contractAddress) throw new Error("Missing CONTRACT_ADDRESS in .env");

  const abi = loadAbi();
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  cachedContract = new ethers.Contract(contractAddress, abi, wallet);
  return cachedContract;
}

export default async function storeHash(hash: string, metadata: string) {
  const contract = getContract();
  const tx = await contract.storeHash(hash, metadata);
  await tx.wait();
  return tx.hash;
}

export async function storeHashWithRetry(hash: string, metadata: string): Promise<string> {
  try {
    return await storeHash(hash, metadata);
  } catch (err) {
    pendingHashes.push({ hash, metadata, timestamp: Date.now(), attempts: 1 });
    throw err;
  }
}

export async function retryPendingHashes(maxAttempts = 3): Promise<number> {
  let succeeded = 0;
  const remaining: PendingHash[] = [];
  for (const entry of pendingHashes) {
    try {
      await storeHash(entry.hash, entry.metadata);
      succeeded += 1;
    } catch {
      entry.attempts += 1;
      if (entry.attempts < maxAttempts) remaining.push(entry);
    }
  }
  pendingHashes.length = 0;
  pendingHashes.push(...remaining);
  return succeeded;
}

// For testing: allow injecting mock
export function __setMockContract(mock: ethers.Contract | null) {
  cachedContract = mock;
}

export function __clearPendingHashes() {
  pendingHashes.length = 0;
}
