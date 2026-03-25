import { publish } from "./eventBus.js";

let sequenceNo = 0;
let intervalHandle = null;

function makePayload(sizeBytes) {
  return "x".repeat(sizeBytes);
}

export function startProducer({ scenarioId, transport, eventRatePerSecond, payloadSizeBytes }) {
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
}

export function stopProducer() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}