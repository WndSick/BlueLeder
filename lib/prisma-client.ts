import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import pg from "pg";

/**
 * A mock connection pool wrapper around standard pg.Client.
 * Prototype is explicitly set to Pool.prototype so that 'instanceof Pool' checks succeed.
 * Methods are defined directly on the instance to take precedence over the prototype's methods.
 * This completely avoids the background timers and persistent TCP connections of a real Pool,
 * solving the workerd request hangs.
 */
class ServerlessPgPool {
  public Promise: any;
  public connect: () => Promise<any>;
  public query: (sql: any, params: any) => Promise<any>;

  constructor(connectionString: string) {
    // Make instanceof Pool check return true
    Object.setPrototypeOf(this, Pool.prototype);
    this.Promise = Promise;

    this.connect = async () => {
      const client = new pg.Client({ connectionString });
      await client.connect();
      return {
        query: async (sql: any, params: any) => {
          return await client.query(sql, params);
        },
        release: () => {
          client.end().catch(() => {});
        },
      };
    };

    this.query = async (sql: any, params: any) => {
      const client = new pg.Client({ connectionString });
      await client.connect();
      try {
        return await client.query(sql, params);
      } finally {
        client.end().catch(() => {});
      }
    };
  }

  async end(): Promise<void> {
    // No-op
  }

  on(): this {
    return this;
  }

  removeListener(): this {
    return this;
  }
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set.");
  }

  // Use our serverless-friendly connection manager
  const pool = new ServerlessPgPool(connectionString) as any;
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

// Singleton — reuse the same client across hot-reloads in development
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? (globalForPrisma.prisma = createPrismaClient());
