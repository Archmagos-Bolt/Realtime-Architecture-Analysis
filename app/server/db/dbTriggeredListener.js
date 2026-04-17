import pg from "pg";
import { publish } from "../eventBus.js";
import { getSyncEventByScenarioAndSeq } from "./pg.js";

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

  listener.on("notification", async (msg) => {
    try {
      const data = JSON.parse(msg.payload);

      const event = await getSyncEventByScenarioAndSeq({
        scenarioId: data.scenarioId,
        sequenceNo: data.sequenceNo
      });

      if (!event) {
        console.warn("DB-triggered event not found in sync_events:", data);
        return;
      }

      publish(event);
    } catch (err) {
      console.error("DB-triggered listener failed to process notification:", err);
    }
  });

  listener.on("error", (err) => {
    console.error("DB-triggered listener error:", err);
  });

}