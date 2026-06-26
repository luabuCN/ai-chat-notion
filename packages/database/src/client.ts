import { PrismaClient } from "@prisma/client";

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

  const url = postgresUrl.includes("connection_limit")
    ? postgresUrl
    : `${postgresUrl}${postgresUrl.includes("?") ? "&" : "?"}connection_limit=15&pool_timeout=20`;

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url,
      },
    },
  });
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton> | undefined;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

export { prisma };
export default prisma;
