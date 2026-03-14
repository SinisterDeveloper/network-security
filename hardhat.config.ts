import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import { defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatEthers],
  solidity: {
    version: "0.8.28",
  },
  networks: {
    amoy: {
      type: "http",
      url: "https://rpc-amoy.polygon.technology",
      accounts: [
        "0xca67da8fcbdfbffef18e2250350dad4a09d445713738ccfa03a9fc94b43b02a9",
      ],
      chainId: 80002,
    },
  },
});
