import fs, { mkdir, writeFile } from "fs/promises";
import path from "path";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const scenarioPath = process.argv[2];

  if (!scenarioPath) {
    console.error("Usage: node runner/runScenario.js <scenario.json>");
    process.exit(1);
  }

  const scenario = JSON.parse(await fs.readFile(scenarioPath, "utf-8"));
  console.log("Loaded scenario:", scenario);

  const startedAt = new Date().toISOString();
  const safeTimestamp = startedAt.replace(/[:.]/g, "-");
  const outputDir = "results/runs";
  const outputPath = path.join(outputDir, `${scenario.scenarioId}-${safeTimestamp}.json`);

  const startResponse = await fetch("http://localhost:3000/control/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      scenarioId: scenario.scenarioId,
      transport: scenario.transport,
      eventRatePerSecond: scenario.eventRatePerSecond,
      payloadSizeBytes: scenario.payloadSizeBytes
    })
  });

  if (!startResponse.ok) {
    const errorText = await startResponse.json();
    console.error("Failed to start scenario:", errorText);
    process.exit(1);
  }

  const startResult = await startResponse.json();
  console.log("Scenario started:", startResult);

  console.log(`Running scenario for ${scenario.measurementMs} ms...`);
  await sleep(scenario.measurementMs);

  const stopResponse = await fetch("http://localhost:3000/control/stop", {
    method: "POST"
  });

  if (!stopResponse.ok) {
    const errorText = await stopResponse.json();
    console.error("Failed to stop scenario:", errorText);
    process.exit(1);
  }

  const stopResult = await stopResponse.json();
  console.log("Scenario stopped:", stopResult);
  const finishedAt = new Date().toISOString();

  await mkdir(outputDir, { recursive: true });

  await writeFile(
    outputPath,
    JSON.stringify(
      {
        scenario,
        measurementMs: scenario.measurementMs,
        startedAt,
        finishedAt,
        actualDurationMs: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
        startResult,
        stopResult
      },
      null,
      2
    )
  );

  console.log(`Run metadata saved to ${outputPath}`);
}

main().catch((err) => {
  console.error("Error running scenario:", err);
  process.exit(1);
});