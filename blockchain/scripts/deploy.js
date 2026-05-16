import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();

  const contract = await ethers.deployContract("HashStorage");

  await contract.waitForDeployment();

  console.log("Contract deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
