// Grupē atsevišķo testa izpilžu kopsavilkumus pēc scenārija identifikatora.
// Skripts apvieno atkārtojumus un izveido tabulas, kas izmantotas salīdzinošajai rezultātu analīzei.
import fs, { mkdir, writeFile } from "fs/promises";
import path from "path";

// Nolasa iepriekš sagatavoto kopsavilkuma tabulu, kur katra rinda atbilst
// vienai scenārija izpildes reizei.
async function readSummaryTable() {
  const inputPath = "results/aggregated/summary-table.json";
  const text = await fs.readFile(inputPath, "utf-8");
  return JSON.parse(text);
}

// Noapaļo skaitliskās vērtības, lai rezultātu tabulas būtu pārskatāmākas.
function roundNumber(value, decimals = 3) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return value;
  }

  return Number(value.toFixed(decimals));
}

// Aprēķina vidējo vērtību vienam rādītājam starp viena scenārija atkārtojumiem.
function average(values) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// Sagatavo vērtību drošai ierakstīšanai CSV formātā.
function csvEscape(value) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main() {
  const rows = await readSummaryTable();
  // Scenāriju izpildes tiek grupētas pēc scenarioId, lai apvienotu viena un
  // tā paša scenārija atkārtojumus.
  const grouped = new Map();

  for (const row of rows) {
    const key = row.scenarioId;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key).push(row);
  }

  // Katram scenārijam tiek aprēķinātas atkārtojumu vidējās statistiskās vērtības.
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

  // Sakārto rezultātus pēc scenārija identifikatora, lai izvades tabulas būtu
  // konsekventas un vieglāk salīdzināmas.
  groupedRows.sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));

  // Grupētie rezultāti tiek saglabāti gan JSON formātā turpmākai apstrādei,
  // gan CSV formātā ērtai ievietošanai izklājlapās.
  const outputDir = "results/aggregated";
  const outputJsonPath = path.join(outputDir, "grouped-summary-table.json");
  const outputCsvPath = path.join(outputDir, "grouped-summary-table.csv");

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputJsonPath, JSON.stringify(groupedRows, null, 2));

  // CSV kolonnu secība atbilst grupētās kopsavilkuma tabulas struktūrai.
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