const statusEl = document.getElementById("status");

const metrics = [];

function setStatus(text) {
  if (statusEl) {
    statusEl.textContent = text;
  }
}

function getClientReceiveWallMs() {
  return performance.timeOrigin + performance.now();
}

function recordEvent(event) {
  const clientReceivedWallMs = getClientReceiveWallMs();
  const e2eMs = clientReceivedWallMs - event.serverCreatedWallMs;

  const metric = {
    eventId: event.eventId,
    scenarioId: event.scenarioId,
    sequenceNo: event.sequenceNo,
    transport: event.transport,
    payloadSizeBytes: event.payloadSizeBytes,
    serverCreatedWallMs: event.serverCreatedWallMs,
    clientReceivedWallMs,
    e2eMs
  };

  metrics.push(metric);

  return metric;
}

window.testMetrics = {
  getAll: () => metrics,
  clear: () => {
    metrics.length = 0;
  }
};

setStatus("Connecting to SSE...");

const source = new EventSource("/events/sse");

source.onopen = () => {
  setStatus("SSE connected. Waiting for events...");
};

source.onmessage = (message) => {
  const event = JSON.parse(message.data);
  const metric = recordEvent(event);

  setStatus(
    `Received event #${event.sequenceNo} | eventId=${event.eventId} | payloadSize=${event.payloadSizeBytes}B | e2e=${metric.e2eMs.toFixed(3)} ms`
  );

  console.log("Received event:", event);
  console.log("Recorded metric:", metric);
};

source.onerror = () => {
  setStatus("SSE connection error");
};

window.testMetrics.summary = () => {
  const values = metrics.map((m) => m.e2eMs);
  if (values.length === 0) {
    return null;
  }

  const sum = values.reduce((a, b) => a + b, 0);

  return {
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    mean: sum / values.length
  };
};