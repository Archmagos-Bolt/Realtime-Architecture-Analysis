import { rm, mkdir } from "fs/promises";

const dirs = [
  "results/runs",
  "results/raw",
  "results/summaries"
];

async function main() {
  for (const dir of dirs) {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    console.log(`Cleaned ${dir}`);
  }
}

main().catch((err) => {
  console.error("Failed to clean results:", err);
  process.exit(1);
});