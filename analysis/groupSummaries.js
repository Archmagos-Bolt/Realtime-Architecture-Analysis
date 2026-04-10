import fs, { mkdir, writeFile } from "fs/promises";
import path from "path";

async function readSummaryTable() {
  const inputPath = "results/aggregated/summary-table.json";
  const text = await fs.readFile(inputPath, "utf-8");
  return JSON.parse(text);
}

function roundNumber(value, decimals = 3) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return value;
  }

  return Number(value.toFixed(decimals));
}

function average(values) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main() {
  const rows = await readSummaryTable();
  const grouped = new Map();

  for (const row of rows) {
    const key = row.scenarioId;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key).push(row);
  }

  const groupedRows = [];

  for (const [scenarioId, group] of grouped.entries()) {
    const first = group[0];

    groupedRows.push({
      scenarioId,
      transport: first.transport,
      clientCount: first.clientCount,
      eventRatePerSecond: first.eventRatePerSecond,
      payloadSizeBytes: first.payloadSizeBytes,
      repetitions: group.length,

      avgCount: roundNumber(average(group.map((r) => r.count)), 3),
      avgMin: roundNumber(average(group.map((r) => r.min))),
      avgP50: roundNumber(average(group.map((r) => r.p50))),
      avgP90: roundNumber(average(group.map((r) => r.p90))),
      avgP95: roundNumber(average(group.map((r) => r.p95))),
      avgP99: roundNumber(average(group.map((r) => r.p99))),
      avgMax: roundNumber(average(group.map((r) => r.max))),
      avgMean: roundNumber(average(group.map((r) => r.mean))),

      minMean: roundNumber(Math.min(...group.map((r) => r.mean))),
      maxMean: roundNumber(Math.max(...group.map((r) => r.mean)))
    });
  }

  groupedRows.sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));

  const outputDir = "results/aggregated";
  const outputJsonPath = path.join(outputDir, "grouped-summary-table.json");
  const outputCsvPath = path.join(outputDir, "grouped-summary-table.csv");

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputJsonPath, JSON.stringify(groupedRows, null, 2));

  const headers = [
    "scenarioId",
    "transport",
    "clientCount",
    "eventRatePerSecond",
    "payloadSizeBytes",
    "repetitions",
    "avgCount",
    "avgMin",
    "avgP50",
    "avgP90",
    "avgP95",
    "avgP99",
    "avgMax",
    "avgMean",
    "minMean",
    "maxMean"
  ];

  const csvLines = [
    headers.join(","),
    ...groupedRows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ];

  await writeFile(outputCsvPath, csvLines.join("\n"));

  console.log(`Grouped ${rows.length} runs into ${groupedRows.length} scenarios.`);
  console.log(`JSON saved to ${outputJsonPath}`);
  console.log(`CSV saved to ${outputCsvPath}`);
}

main().catch((err) => {
  console.error("Failed to group summaries:", err);
  process.exit(1);
});