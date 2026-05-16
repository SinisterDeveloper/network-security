import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const provider = new ethers.JsonRpcProvider(
  process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
);

const privateKey = process.env.AMOY_PRIVATE_KEY || process.env.PRIVATE_KEY;

if (!privateKey) {
  throw new Error("Missing AMOY_PRIVATE_KEY or PRIVATE_KEY in .env");
}

const wallet = new ethers.Wallet(privateKey, provider);

console.log("Wallet address:", wallet.address);

const balance = await provider.getBalance(wallet.address);

console.log("Amoy POL balance:", ethers.formatEther(balance));
