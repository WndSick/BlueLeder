import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonAmoy } from "viem/chains";

export const POLYGON_AMOY_CONFIG = {
  chainId: 80002,
  name: "Polygon Amoy Testnet",
  rpcUrl: process.env.POLYGON_AMOY_RPC || "https://rpc-amoy.polygon.technology",
  explorerUrl: "https://amoy.polygonscan.com",
  registryAddress: (process.env.BLUELEDGER_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000008002") as `0x${string}`,
  tokenAddress: (process.env.BLUECARBON_TOKEN_ADDRESS || "0x0000000000000000000000000000000000008003") as `0x${string}`,
  marketplaceAddress: (process.env.BLUECARBON_MARKETPLACE_ADDRESS || "0x0000000000000000000000000000000000008004") as `0x${string}`,
};

export const publicClient = createPublicClient({
  chain: polygonAmoy,
  transport: http(POLYGON_AMOY_CONFIG.rpcUrl),
});

export function getWalletClient() {
  const privateKey = process.env.POLYGON_AMOY_PRIVATE_KEY;
  if (!privateKey) return null;
  const formattedKey = privateKey.startsWith("0x") ? (privateKey as `0x${string}`) : (`0x${privateKey}` as `0x${string}`);
  const account = privateKeyToAccount(formattedKey);
  return createWalletClient({
    account,
    chain: polygonAmoy,
    transport: http(POLYGON_AMOY_CONFIG.rpcUrl),
  });
}

export async function computeKeccak256TokenId(projectId: string, periodKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${projectId}:${periodKey}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hashHex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hashHex}`;
}
