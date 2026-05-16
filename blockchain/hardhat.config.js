import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import { defineConfig } from "hardhat/config";
import dotenv from "dotenv";

dotenv.config();

const privateKey = process.env.AMOY_PRIVATE_KEY || process.env.PRIVATE_KEY;

export default defineConfig({
  plugins: [hardhatEthers],
  solidity: "0.8.20",
  networks: {
    amoy: {
      type: "http",
      chainType: "l1",
      url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      accounts: privateKey ? [privateKey] : [],
    },
  },
});
