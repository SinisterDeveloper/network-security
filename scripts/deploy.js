const hre = require("hardhat");

async function main() {
  const Contract = await hre.ethers.getContractFactory("HashStorage");
  const contract = await Contract.deploy();

  await contract.waitForDeployment();

  console.log("Contract deployed to:", await contract.getAddress());
}

main();
