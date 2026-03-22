import fs from "fs";

const scenarioPath = process.argv[2];

if (!scenarioPath) {
  console.error("Usage: node runner/runScenario.js <scenario.json>");
  process.exit(1);
}

const scenario = JSON.parse(fs.readFileSync(scenarioPath, "utf-8"));
console.log("Loaded scenario:", scenario);