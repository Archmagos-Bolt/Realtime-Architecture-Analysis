import pg from "pg";

const { Client } = pg;

export const db = new Client({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "postgres",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "password123"
});

export async function connectDb() {
  await db.connect();
  console.log("DB connected.");
}

export async function insertSyncEvent({
  scenarioId,
  sequenceNo,
  payload,
  payloadSizeBytes
}) {
  const result = await db.query(
    `
    INSERT INTO sync_events (scenario_id, sequence_no, payload, payload_size_bytes)
    VALUES ($1, $2, $3, $4)
    RETURNING id, scenario_id, sequence_no, payload, payload_size_bytes, created_at
    `,
    [scenarioId, sequenceNo, payload, payloadSizeBytes]
  );

  return result.rows[0];
}

export async function clearSyncEvents() {
  await db.query("TRUNCATE TABLE sync_events RESTART IDENTITY");
}