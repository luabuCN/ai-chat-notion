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

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: postgresUrl,
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
