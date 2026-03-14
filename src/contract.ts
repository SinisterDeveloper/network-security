import { ethers } from "ethers";
import contractArtifact from "../artifacts/contracts/HashStorage.sol/HashStorage.json" with { type: "json" };

const provider = new ethers.JsonRpcProvider(process.env.AMOY_RPC_URL);

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY as string, provider);

const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS as string,
  contractArtifact.abi,
  wallet,
);

export default contract;
