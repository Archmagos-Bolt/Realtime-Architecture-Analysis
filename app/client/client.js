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

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) {
    return null;
  }
  const index = (sortedValues.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sortedValues[lower];
  }

  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
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
  },

  values: () => metrics.map((m) => m.e2eMs),
  summary: () => {
    const values = metrics.map((m) => m.e2eMs);
    if (values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      min: sorted[0],
      p50: percentile(sorted, 0.50),
      p90: percentile(sorted, 0.90),
      p95: percentile(sorted, 0.95),
      p99: percentile(sorted, 0.99),
      max: sorted[sorted.length - 1],
      mean: sum / values.length
    };
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

source.onerror = (err) => {
  console.warn("SSE error fired", err, "readyState:", source.readyState);

  if (source.readyState === EventSource.CONNECTING) {
    setStatus("SSE reconnecting...");
  } else if (source.readyState === EventSource.CLOSED) {
    setStatus("SSE closed");
  } else {
    setStatus("SSE error");
  }
};