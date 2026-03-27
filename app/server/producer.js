import { publish } from "./eventBus.js";

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

  intervalHandle = setInterval(() => {
    sequenceNo += 1;

    const event = {
      eventId: `${scenarioId}-${sequenceNo}`,
      scenarioId,
      sequenceNo,
      transport,
      payload: makePayload(payloadSizeBytes),
      payloadSizeBytes,
      serverCreatedWallMs: Date.now()
    };

    publish(event);
  }, intervalMs);

  return {
    running: true,
    scenario: currentScenario
  };
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