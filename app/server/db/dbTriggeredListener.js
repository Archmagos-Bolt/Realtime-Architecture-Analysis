import pg from "pg";
import { publish } from "../eventBus.js";

const { Client } = pg;

let listener = null;

export async function startDbTriggeredListener() {
  if (listener) {
    return;
  }

  listener = new Client({
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || "postgres",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "password123"
  });

  await listener.connect();
  await listener.query("LISTEN sync_events_channel");

  listener.on("notification", (msg) => {
    try {
      const data = JSON.parse(msg.payload);
      if (data.transport !== "dbtriggered") {
        return;
      }

      const event = {
        eventId: `${data.scenarioId}-${data.sequenceNo}`,
        scenarioId: data.scenarioId,
        sequenceNo: data.sequenceNo,
        transport: data.transport,
        payload: data.payload,
        payloadSizeBytes: data.payloadSizeBytes,
        serverCreatedWallMs: new Date(data.createdAt).getTime()
      };
      publish(event);
    } catch (err) {
      console.error("DB-triggered listener failed to process notification:", err);
    }
  });

  listener.on("error", (err) => {
    console.error("DB-triggered listener error:", err);
  });

}