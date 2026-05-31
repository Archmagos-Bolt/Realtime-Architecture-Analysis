// Datubāzes paziņojumu klausītājs.
// Izmanto PostgreSQL LISTEN/NOTIFY, lai saņemtu signālu par jaunu sync_events ierakstu un nodotu šo notikumu
// tālāk servera notikumu izplatīšanas plūsmai.
import pg from "pg";
import { publish } from "../eventBus.js";
import { getSyncEventByScenarioAndSeq } from "./pg.js";

const { Client } = pg;

// Klausītājs tiek glabāts moduļa līmenī, lai viena servera instance
// neveidotu vairākus LISTEN savienojumus.
let listener = null;

// Inicializē atsevišķu datubāzes klientu paziņojumu klausīšanai.
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

  // Serveris sāk klausīties datubāzes kanālu, kurā trigeris publicē
  // paziņojumus par jauniem testa notikumiem.
  await listener.connect();
  await listener.query("LISTEN sync_events_channel");

  // Saņemot paziņojumu, no datubāzes tiek iegūti pilnie notikuma dati,
  // jo NOTIFY payload tiek izmantots tikai kā signāls un identifikators.
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

      // Iegūtais notikums tiek publicēts servera notikumu izplatīšanas plūsmai,
      // lai tas tiktu nosūtīts visiem atbilstošajiem klientiem.
      publish(event);
    } catch (err) {
      console.error("DB-triggered listener failed to process notification:", err);
    }
  });

  // Klausītāja kļūdas tiek reģistrētas, lai testa laikā būtu redzamas
  // datubāzes paziņojumu apstrādes problēmas.
  listener.on("error", (err) => {
    console.error("DB-triggered listener error:", err);
  });

}