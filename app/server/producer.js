import { publish } from "./eventBus.js";
import { insertSyncEvent } from "./db/pg.js";

let sequenceNo = 0;
let intervalHandle = null;
let currentScenario = null;

let startedWallMs = null;
let attemptedTicks = 0;
let successfulInserts = 0;
let failedInserts = 0;

function makePayload(sizeBytes) {
  return "x".repeat(sizeBytes);
}

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

export function getProducerState() {
  return {
    running: intervalHandle !== null,
    scenario: currentScenario
  };
}