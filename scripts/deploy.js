import "dotenv/config";
import hre from "hardhat";

const CONTRACT_NAME = process.env.CONTRACT_NAME || "HashStorage";

async function main() {
  const connection = await hre.network.connect();
  const { ethers } = connection;
  const Contract = await ethers.getContractFactory(CONTRACT_NAME);
  const contract = await Contract.deploy();

  await contract.waitForDeployment();

  console.log("Contract deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
