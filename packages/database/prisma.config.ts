import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig, env } from "prisma/config";

config({ path: resolve(import.meta.dirname, "../../.env.local") });
config({ path: resolve(import.meta.dirname, "../../.env") });

// `env()` throws if missing; generate/postinstall may run without a real DB URL.
if (!process.env.POSTGRES_URL) {
  process.env.POSTGRES_URL =
    "postgresql://postgres:postgres@localhost:5432/postgres";
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("POSTGRES_URL"),
  },
});
