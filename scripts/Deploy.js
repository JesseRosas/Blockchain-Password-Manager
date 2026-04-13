import { network } from "hardhat";

async function main() {
  const { viem } = await network.connect("sepolia");

  const contract = await viem.deployContract("PasswordKeychain");
  console.log("PasswordKeychain deployed to:", contract.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});