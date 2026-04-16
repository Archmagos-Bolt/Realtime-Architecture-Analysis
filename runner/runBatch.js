import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runNodeCommand(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", args, {
      stdio: "inherit",
      shell: true
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on("error", reject);
  });
}

async function getScenarioFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(dirPath, entry.name))
    .sort();
}

async function main() {
  const targetPath = process.argv[2];

  if (!targetPath) {
    console.error("Usage: node runner/runBatch.js <scenario-file-or-directory>");
    process.exit(1);
  }

  const stat = await fs.stat(targetPath);
  const scenarioFiles = stat.isDirectory()
    ? await getScenarioFiles(targetPath)
    : [targetPath];
    console.log("Scenarios to run:");
  for (const file of scenarioFiles) {
    console.log(`- ${file}`);
  }

  for (const scenarioFile of scenarioFiles) {
    console.log(`\n=== Running ${scenarioFile} ===\n`);
    await runNodeCommand(["runner/runScenario.js", scenarioFile]);
  }

  console.log("\nBatch complete.");
  for (const scenarioFile of scenarioFiles) {
    console.log(`\n=== Running ${scenarioFile} ===\n`);
    await runNodeCommand(["runner/runScenario.js", scenarioFile]);
    await sleep(1500);
  }
}

main().catch((err) => {
  console.error("Batch run failed:", err);
  process.exit(1);
});
