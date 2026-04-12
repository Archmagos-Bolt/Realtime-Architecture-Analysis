import { publish } from "./eventBus.js";
import { performance } from "perf_hooks";
import { insertSyncEvent } from "./db/pg.js";

let sequenceNo = 0;
let intervalHandle = null;
let currentScenario = null;

function makePayload(sizeBytes) {
  return "x".repeat(sizeBytes);
}

export function startProducer({ scenarioId, transport, eventRatePerSecond, payloadSizeBytes }) {
  stopProducer();
  sequenceNo = 0;
  currentScenario = {
    scenarioId,
    transport,
    eventRatePerSecond,
    payloadSizeBytes
  };

  const intervalMs = 1000 / eventRatePerSecond;

  if (intervalHandle) {
    clearInterval(intervalHandle);
  }

  intervalHandle = setInterval(async () => {
    try {
      sequenceNo += 1;

      const payload = makePayload(payloadSizeBytes);

      const inserted = await insertSyncEvent({
        scenarioId,
        sequenceNo,
        payload,
        payloadSizeBytes
      });

      const event = {
        eventId: `${inserted.scenario_id}-${inserted.sequence_no}`,
        scenarioId: inserted.scenario_id,
        sequenceNo: inserted.sequence_no,
        transport,
        payload: inserted.payload,
        payloadSizeBytes: inserted.payload_size_bytes,
        serverCreatedWallMs: new Date(inserted.created_at).getTime()
      };

      publish(event);
    } catch (err) {
      console.error("Producer insert/publish failed:", err);
    }
  }, intervalMs);
}

export function stopProducer() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }

  const stoppedScenario = currentScenario;
  currentScenario = null;

  return {
    running: false,
    previousScenario: stoppedScenario
  };
}

export function getProducerState() {
  return {
    running: intervalHandle !== null,
    scenario: currentScenario
  };
}