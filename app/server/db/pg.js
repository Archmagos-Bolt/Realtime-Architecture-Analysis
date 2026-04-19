import pg from "pg";

const { Pool } = pg;

export const db = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "postgres",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "password123"
});

export async function connectDb() {
  const result = await db.query("SELECT NOW() AS now");
  console.log("DB connected.");
  console.log("DB test query OK:", result.rows[0].now);
}

export async function insertSyncEvent({
  scenarioId,
  sequenceNo,
  transport,
  payload,
  payloadSizeBytes
}) {
  const result = await db.query(
    `
    INSERT INTO sync_events (scenario_id, sequence_no, transport, payload, payload_size_bytes)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, scenario_id, sequence_no, transport, payload, payload_size_bytes, created_at
    `,
    [scenarioId, sequenceNo, transport, payload, payloadSizeBytes]
  );

  return result.rows[0];
}

export async function getSyncEventByScenarioAndSeq({ scenarioId, sequenceNo }) {
  const result = await db.query(
    `
    SELECT scenario_id, sequence_no, transport, payload, payload_size_bytes, created_at
    FROM sync_events
    WHERE scenario_id = $1 AND sequence_no = $2
    LIMIT 1
    `,
    [scenarioId, sequenceNo]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    eventId: `${row.scenario_id}-${row.sequence_no}`,
    scenarioId: row.scenario_id,
    sequenceNo: row.sequence_no,
    transport: row.transport,
    payload: row.payload,
    payloadSizeBytes: row.payload_size_bytes,
    serverCreatedWallMs: new Date(row.created_at).getTime()
  };
}

export async function getSyncEventsAfter({ scenarioId, afterSeq }) {
  const result = await db.query(
    `
    SELECT scenario_id, sequence_no, transport, payload, payload_size_bytes, created_at
    FROM sync_events
    WHERE scenario_id = $1 AND sequence_no > $2
    ORDER BY sequence_no ASC
    `,
    [scenarioId, afterSeq]
  );

  return result.rows.map((row) => ({
    eventId: `${row.scenario_id}-${row.sequence_no}`,
    scenarioId: row.scenario_id,
    sequenceNo: row.sequence_no,
    transport: row.transport,
    payload: row.payload,
    payloadSizeBytes: row.payload_size_bytes,
    serverCreatedWallMs: new Date(row.created_at).getTime()
  }));
}

export async function clearSyncEvents() {
  await db.query("TRUNCATE TABLE sync_events RESTART IDENTITY");
}