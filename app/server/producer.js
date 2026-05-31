// Testa notikumu producenta modulis.
// Ģenerē scenārija notikumus un ievieto tos sync_events tabulā ar noteiktu intensitāti un ziņas izmēru.
import { publish } from "./eventBus.js";
import { insertSyncEvent } from "./db/pg.js";

// Producenta stāvoklis tiek glabāts moduļa līmenī, jo vienlaikus tiek
// izpildīts viens aktīvs testa scenārijs.
let sequenceNo = 0;
let intervalHandle = null;
let currentScenario = null;

// Šie skaitītāji tiek izmantoti, lai pēc scenārija izpildes saglabātu
// producenta darbības statistiku.
let startedWallMs = null;
let attemptedTicks = 0;
let successfulInserts = 0;
let failedInserts = 0;

// Izveido noteikta izmēra testa ziņas saturu, lai scenārijos varētu
// salīdzināt dažādu payload izmēru ietekmi.
function makePayload(sizeBytes) {
  return "x".repeat(sizeBytes);
}

// Apkopo producenta izpildes statistiku, tostarp veiksmīgo ievietošanas
// gadījumu skaitu un faktiski sasniegto notikumu intensitāti.
function getProducerStats() {
  if (!startedWallMs) {
    return null;
  }

  const elapsedMs = Date.now() - startedWallMs;

  return {
    attemptedTicks,
    successfulInserts,
    failedInserts,
    elapsedMs,
    achievedEps: successfulInserts / (elapsedMs / 1000)
  };
}

// Sāk jauna scenārija notikumu ģenerēšanu, atiestatot iepriekšējo stāvokli
// un regulāri ievietojot notikumus datubāzē.
export function startProducer({ scenarioId, transport, eventRatePerSecond, payloadSizeBytes }) {
  stopProducer();

  attemptedTicks = 0;
  successfulInserts = 0;
  failedInserts = 0;
  startedWallMs = Date.now();

  sequenceNo = 0;
  currentScenario = {
    scenarioId,
    transport,
    eventRatePerSecond,
    payloadSizeBytes
  };

  const intervalMs = 1000 / eventRatePerSecond;

  // Katrs tick izveido nākamo scenārija notikumu un ievieto to datubāzē.
  const tick = async () => {
    attemptedTicks += 1;

    try {
      sequenceNo += 1;

      const payload = makePayload(payloadSizeBytes);

      await insertSyncEvent({
        scenarioId,
        sequenceNo,
        transport,
        payload,
        payloadSizeBytes
      });

      successfulInserts += 1;
    } catch (err) {
      failedInserts += 1;
      console.error("Producer insert failed:", err);
    }
  };

  tick();
  intervalHandle = setInterval(tick, intervalMs);

  return {
    running: true,
    scenario: currentScenario
  };
}

// Aptur aktīvo producentu un atgriež scenārija izpildes statistiku.
export function stopProducer() {
  const wasRunning = intervalHandle !== null;

  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }

  const stoppedScenario = currentScenario;
  const producerStats = wasRunning ? getProducerStats() : null;

  currentScenario = null;

  if (producerStats) {
    console.log("Producer stats:", producerStats);
  }

  return {
    running: false,
    previousScenario: stoppedScenario,
    producerStats
  };
}

// Atgriež producenta pašreizējo stāvokli kontroles galapunktu vajadzībām.
export function getProducerState() {
  return {
    running: intervalHandle !== null,
    scenario: currentScenario
  };
}