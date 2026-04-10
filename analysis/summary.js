import fs, { mkdir, writeFile } from "fs/promises";
import path from "path";

async function getSummaryFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(dirPath, entry.name))
    .sort();
}
function roundNumber(value, decimals = 3) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return value;
  }

  return Number(value.toFixed(decimals));
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main() {
  const summariesDir = "results/summaries";
  const outputDir = "results/aggregated";
  const outputJsonPath = path.join(outputDir, "summary-table.json");
  const outputCsvPath = path.join(outputDir, "summary-table.csv");

  const files = await getSummaryFiles(summariesDir);
  const rows = [];

  for (const file of files) {
    const data = JSON.parse(await fs.readFile(file, "utf-8"));
    const scenario = data.scenario ?? {};
    const overall = data.overallSummary ?? {};

    rows.push({
      file: path.basename(file),
      scenarioId: scenario.scenarioId,
      transport: scenario.transport,
      clientCount: scenario.clientCount,
      eventRatePerSecond: scenario.eventRatePerSecond,
      payloadSizeBytes: scenario.payloadSizeBytes,
      warmupMs: scenario.warmupMs,
      measurementMs: scenario.measurementMs,
      repetitions: scenario.repetitions,
      startedAt: data.startedAt,
      finishedAt: data.finishedAt,
      count: overall.count,
      min: roundNumber(overall.min),
      p50: roundNumber(overall.p50),
      p90: roundNumber(overall.p90),
      p95: roundNumber(overall.p95),
      p99: roundNumber(overall.p99),
      max: roundNumber(overall.max),
      mean: roundNumber(overall.mean)
    });
  }

  await mkdir(outputDir, { recursive: true });

  await writeFile(outputJsonPath, JSON.stringify(rows, null, 2));

  const headers = [
    "file",
    "scenarioId",
    "transport",
    "clientCount",
    "eventRatePerSecond",
    "payloadSizeBytes",
    "warmupMs",
    "measurementMs",
    "repetitions",
    "startedAt",
    "finishedAt",
    "count",
    "min",
    "p50",
    "p90",
    "p95",
    "p99",
    "max",
    "mean"
  ];

  const csvLines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ];

  await writeFile(outputCsvPath, csvLines.join("\n"));

  console.log(`Aggregated ${rows.length} summary files.`);
  console.log(`JSON saved to ${outputJsonPath}`);
  console.log(`CSV saved to ${outputCsvPath}`);
}

main().catch((err) => {
  console.error("Failed to aggregate summaries:", err);
  process.exit(1);
});