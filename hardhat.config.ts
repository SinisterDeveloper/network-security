import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "hardhat/config";

loadEnv();

const amoyRpcUrl =
  process.env.AMOY_RPC_URL ||
  process.env.AMOY_RPC ||
  process.env.RPC_URL ||
  "https://rpc-amoy.polygon.technology";
const amoyPrivateKey = process.env.AMOY_PRIVATE_KEY || process.env.PRIVATE_KEY;

export default defineConfig({
  plugins: [hardhatEthers],
  solidity: {
    version: "0.8.28",
  },
  networks: {
    amoy: {
      type: "http",
      url: amoyRpcUrl,
      accounts: amoyPrivateKey ? [amoyPrivateKey] : [],
      chainId: 80002,
    },
  },
});
