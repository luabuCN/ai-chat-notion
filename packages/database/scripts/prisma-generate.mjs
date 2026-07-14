import { rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(root, "src/generated/prisma");

// Prisma refuses to write into a non-empty directory that doesn't look like a
// generated client (e.g. leftover empty folders after a branch switch / clean).
rmSync(outputDir, { recursive: true, force: true });

const prismaBin = resolve(root, "node_modules/prisma/build/index.js");
const result = spawnSync(process.execPath, [prismaBin, "generate"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

if (result.error || result.status !== 0) {
  // Fallback for hoisted monorepo installs where prisma lives at the workspace root.
  const fallback = spawnSync("pnpm", ["exec", "prisma", "generate"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  process.exit(fallback.status ?? 1);
}

process.exit(result.status ?? 1);
