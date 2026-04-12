import fs, { mkdir, writeFile } from "fs/promises";
import path from "path";
import { chromium } from "playwright";
import { db, connectDb, clearSyncEvents } from "../app/server/db/pg.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) {
    return null;
  }

  const index = (sortedValues.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sortedValues[lower];
  }

  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function summarizeMetrics(metrics) {
  const values = metrics.map((m) => m.e2eMs);

  if (values.length === 0) {
    return {
      count: 0
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);

  return {
    count: values.length,
    min: sorted[0],
    p50: percentile(sorted, 0.50),
    p90: percentile(sorted, 0.90),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: sorted[sorted.length - 1],
    mean: sum / values.length
  };
}

let browser;

async function main() {
  await connectDb();
  await clearSyncEvents();
  console.log("sync_events cleared.");
  const scenarioPath = process.argv[2];
  const headed = process.argv.includes("--headed");
  if (!scenarioPath) {
    console.error("Usage: node runner/runScenario.js <scenario.json>");
    process.exit(1);
  }

  const scenario = JSON.parse(await fs.readFile(scenarioPath, "utf-8"));
  console.log("Loaded scenario:", scenario);

  const startedAt = new Date().toLocaleString();
  const safeTimestamp = startedAt.toLocaleString("sv-SE").replace(/[: ]/g, "-");
  const runDir = "results/runs";
  const rawDir = "results/raw";
  const summaryDir = "results/summaries";

  await mkdir(runDir, { recursive: true });
  await mkdir(rawDir, { recursive: true });
  await mkdir(summaryDir, { recursive: true });

  browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext();

  const pages = [];
  try {
    console.log(`Launching ${scenario.clientCount} client pages.`);
    for (let i = 1; i <= scenario.clientCount; i += 1) {
      const clientId = `client-${i}`;
      const page = await context.newPage();

      await page.goto(
        `http://localhost:3000/?transport=${scenario.transport}&clientId=${clientId}`,
        { waitUntil: "domcontentloaded" }
      );

      await page.waitForFunction(() => window.testState?.connected === true);
      pages.push({ page, clientId });
      console.log(`Connected ${clientId}`);
    }
    console.log("All clients connected.");

    for (const { page } of pages) {
      await page.evaluate(() => {
        window.testMetrics.clear();
      });
    }

    if (scenario.warmupMs && scenario.warmupMs > 0) {
      console.log(`Stabilizing clients for ${scenario.warmupMs} ms.`);
      await sleep(scenario.warmupMs);
    }

    console.log("Starting measured run.");
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
      const errorText = await startResponse.text();
      console.error("Failed to start scenario:", errorText);
      process.exit(1);
    }

    const startResult = await startResponse.json();
    console.log("Scenario started:", startResult);

    await sleep(scenario.measurementMs);

    const stopResponse = await fetch("http://localhost:3000/control/stop", {
      method: "POST"
    });

    if (!stopResponse.ok) {
      const errorText = await stopResponse.text();
      console.error("Failed to stop scenario:", errorText);
      process.exit(1);
    }

    const stopResult = await stopResponse.json();
    const finishedAt = new Date().toLocaleString("sv-SE").replace(/[: ]/g, "-");

    const perClientResults = [];
    console.log("Collecting metrics from clients.");
    for (const { page, clientId } of pages) {
      const metrics = await page.evaluate(() => window.testMetrics.getAll());
      perClientResults.push({
        clientId,
        summary: summarizeMetrics(metrics),
        metrics
      });
    }

    const allMetrics = perClientResults.flatMap((c) => c.metrics);
    const overallSummary = summarizeMetrics(allMetrics);

    const runMetadataPath = path.join(runDir, `${scenario.scenarioId}-${safeTimestamp}.json`);
    const rawResultsPath = path.join(rawDir, `${scenario.scenarioId}-${safeTimestamp}.json`);
    const summaryPath = path.join(summaryDir, `${scenario.scenarioId}-${safeTimestamp}.json`);

    await writeFile(
      runMetadataPath,
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

    await writeFile(
      rawResultsPath,
      JSON.stringify(
        {
          scenario,
          startedAt,
          finishedAt,
          clients: perClientResults
        },
        null,
        2
      )
    );

    await writeFile(
      summaryPath,
      JSON.stringify(
        {
          scenario,
          startedAt,
          finishedAt,
          overallSummary,
          perClientSummary: perClientResults.map((c) => ({
            clientId: c.clientId,
            summary: c.summary
          }))
        },
        null,
        2
      )
    );

    console.log("Overall summary:", overallSummary);
    console.log(`Run metadata saved to ${runMetadataPath}`);
    console.log(`Raw results saved to ${rawResultsPath}`);
    console.log(`Summary saved to ${summaryPath}`);

  }
  finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    await db.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error("Error running scenario:", err);
  process.exit(1);
});