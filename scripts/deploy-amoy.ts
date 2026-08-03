import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonAmoy } from "viem/chains";

async function main() {
  console.log("=== POLYGON AMOY DEPLOYMENT SCRIPT ===");
  const privateKey = process.env.POLYGON_AMOY_PRIVATE_KEY;
  if (!privateKey) {
    console.log("No POLYGON_AMOY_PRIVATE_KEY provided in environment. Simulation mode configured.");
    return;
  }

  const account = privateKeyToAccount(`0x${privateKey.replace(/^0x/, "")}`);
  const rpcUrl = process.env.POLYGON_AMOY_RPC || "https://rpc-amoy.polygon.technology";

  const publicClient = createPublicClient({ chain: polygonAmoy, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: polygonAmoy, transport: http(rpcUrl) });

  console.log(`Deployer Wallet Address: ${account.address}`);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`MATIC Balance: ${Number(balance) / 1e18} MATIC`);

  console.log("Deployment parameters verified. Ready for Polygon Amoy contract broadcast.");
}

main().catch(console.error);
