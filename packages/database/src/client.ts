import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

const prismaClientSingleton = () => {
  const postgresUrl = process.env.POSTGRES_URL;

  if (!postgresUrl) {
    const errorMessage =
      "POSTGRES_URL environment variable is not set. " +
      "Please set it in your .env file. " +
      "Format: postgresql://user:password@host:port/database";

    if (process.env.NODE_ENV === "development") {
      console.error(errorMessage);
    }

    throw new Error(errorMessage);
  }

  const adapter = new PrismaPg({
    connectionString: postgresUrl,
    // Preserve previous Prisma v6 URL pool settings (connection_limit=15, pool_timeout=20).
    max: 15,
    connectionTimeoutMillis: 20_000,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

declare const globalThis: {
  prismaGlobal: PrismaClientSingleton | undefined;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

export { prisma };
export default prisma;
