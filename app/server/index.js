import express from "express";
import http from "http";
import { subscribe } from "./eventBus.js";
import { startProducer } from "./producer.js";

const app = express();
const server = http.createServer(app);

app.use(express.static("app/client"));

const sseClients = new Set();

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/events/sse", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.flushHeaders?.();

  sseClients.add(res);

  req.on("close", () => {
    sseClients.delete(res);
  });
});

subscribe((event) => {
  const data = `data: ${JSON.stringify(event)}\n\n`;

  for (const client of sseClients) {
    client.write(data);
  }
});

startProducer({
  scenarioId: "manual-sse-test",
  transport: "sse",
  eventRatePerSecond: 1,
  payloadSizeBytes: 32
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});