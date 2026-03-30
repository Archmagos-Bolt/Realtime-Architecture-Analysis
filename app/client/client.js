import { connectSSE } from "./transports/sseClient.js";
import { connectWebSocket } from "./transports/websocketClient.js";
import { connectPolling } from "./transports/pollingClient.js";
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
  },
  download: () => {
  const blob = new Blob(
        [JSON.stringify(metrics, null, 2)],
        { type: "application/json" }
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "metrics.json";
      a.click();
      URL.revokeObjectURL(url);
  }
};

function getTransportFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("transport") || "sse";
}

function connectTransport(transport) {
  const handlers = {
    onOpen: () => {
      console.log(`${transport} open`);
      setStatus(`${transport} connected. Waiting for events...`);
    },
    onEvent: (event) => {
      const metric = recordEvent(event);

      console.log("Received event:", event);
      console.log("Recorded metric:", metric);

      setStatus(
        `Transport=${transport} | event #${event.sequenceNo} | e2e=${metric.e2eMs.toFixed(3)} ms`
      );
    },
    onError: (err, readyState) => {
      console.warn(`${transport} error`, err, "readyState:", readyState);
      if (transport === "sse" && readyState === EventSource.CONNECTING) {
        setStatus("SSE reconnecting...");
      } else if (transport === "sse" && readyState === EventSource.CLOSED) {
        setStatus("SSE closed");
      } else {
        setStatus(`${transport} error`);
      }
    }
  };

  switch (transport) {
    case "sse":
      return connectSSE(handlers);
    case "websocket":
      return connectWebSocket(handlers);
    case "polling":
      return connectPolling(handlers);
    default:
      throw new Error(`Unsupported transport: ${transport}`);
  }
}

const transport = getTransportFromQuery();

setStatus(`Connecting using ${transport}...`);
console.log(`Connecting using transport: ${transport}`);

const connection = connectTransport(transport);

window.testConnection = connection;