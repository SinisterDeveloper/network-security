import hre from "hardhat";

async function main() {
  const { ethers } = await hre.network.connect();
  const Contract = await ethers.getContractFactory("HashStorage");
  const contract = await Contract.deploy();

  await contract.waitForDeployment();

  console.log("Contract deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
