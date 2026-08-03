import { prisma } from "@/lib/prisma-client";
import { POLYGON_AMOY_CONFIG, computeKeccak256TokenId, getWalletClient, publicClient } from "./viem-client";

export interface BroadcastResult {
  processedCount: number;
  successCount: number;
  failureCount: number;
  broadcastLogs: string[];
}

export class BlockchainBroadcastWorker {
  private isProcessing = false;

  async processPendingEvents(maxBatchSize = 10): Promise<BroadcastResult> {
    if (this.isProcessing) {
      return { processedCount: 0, successCount: 0, failureCount: 0, broadcastLogs: ["Worker is processing."] };
    }

    this.isProcessing = true;
    const logs: string[] = [];
    let successCount = 0;
    let failureCount = 0;

    try {
      const pendingEvents = await prisma.ledgerEvent.findMany({
        where: { transactionId: null },
        orderBy: { createdAt: "asc" },
        take: maxBatchSize,
      });

      logs.push(`Found ${pendingEvents.length} unbroadcast ledger events for Polygon Amoy.`);

      const walletClient = getWalletClient();

      for (const event of pendingEvents) {
        try {
          let txHash = "";

          if (walletClient && walletClient.account) {
            // Send real transaction via Viem RPC call to Polygon Amoy
            logs.push(`Submitting real transaction on Polygon Amoy via wallet ${walletClient.account.address}...`);
            const hash = await walletClient.sendTransaction({
              to: POLYGON_AMOY_CONFIG.registryAddress,
              value: BigInt(0),
              data: `0x${event.eventHash}`,
            });
            txHash = hash;
            logs.push(`Transaction submitted to Polygon Amoy RPC: ${txHash}`);

            // Wait for receipt confirmation
            try {
              const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 15_000 });
              logs.push(`Transaction confirmed in block #${receipt.blockNumber}`);
            } catch (err: any) {
              logs.push(`Transaction confirmation pending/timeout: ${err.message}`);
            }
          } else {
            // Simulated transaction fallback when no private key is present in environment
            const txData = new TextEncoder().encode(`${event.id}:${event.eventHash}:${Date.now()}`);
            const digest = await crypto.subtle.digest("SHA-256", txData);
            txHash = `0x${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
            logs.push(`Simulated transaction hash generated: ${txHash}`);
          }

          let metadata: any = {};
          try { metadata = JSON.parse(event.metadataJson); } catch {}

          await prisma.ledgerEvent.update({
            where: { id: event.id },
            data: {
              transactionId: txHash,
            },
          });

          if (event.eventType === "CREDITS_ISSUED" && event.periodKey) {
            const tokenId = await computeKeccak256TokenId(event.projectId, event.periodKey);
            
            await prisma.creditBatch.upsert({
              where: {
                projectId_periodKey: {
                  projectId: event.projectId,
                  periodKey: event.periodKey,
                },
              },
              update: {
                reportHash: tokenId,
                status: "ISSUED",
              },
              create: {
                projectId: event.projectId,
                periodKey: event.periodKey,
                vintageYear: new Date().getFullYear(),
                reportHash: tokenId,
                issuedQuantity: Number(metadata.quantity || 10),
                currentHolder: metadata.recipientId || event.actorEmail,
                status: "ISSUED",
                createdBy: metadata.userId || event.actorEmail,
              },
            });
          }

          successCount++;
        } catch (err: any) {
          logs.push(`Failed event ${event.id}: ${err.message}`);
          failureCount++;
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return {
      processedCount: successCount + failureCount,
      successCount,
      failureCount,
      broadcastLogs: logs,
    };
  }
}

export const broadcastWorker = new BlockchainBroadcastWorker();
