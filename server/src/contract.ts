import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let cachedContract: ethers.Contract | null = null;
let artifactAbi: ethers.InterfaceAbi | null = null;

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

// For testing: allow injecting mock
export function __setMockContract(mock: ethers.Contract | null) {
  cachedContract = mock;
}
