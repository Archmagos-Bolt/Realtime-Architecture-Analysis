import express from "express";
import http from "http";
import controlRoutes from "./routes/control.js";
import { subscribe } from "./eventBus.js";
import { WebSocketServer, WebSocket } from "ws";
import { connectDb, getSyncEventsAfter } from "./db/pg.js";
import { startDbTriggeredListener } from "./db/dbTriggeredListener.js";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
const wsClients = new Set();
const eventBuffer = [];
const MAX_BUFFER_SIZE = 10000;

const sseClients = new Set();

const dbTriggeredWss = new WebSocketServer({ noServer: true });
const dbTriggeredWsClients = new Set();

const pendingLongPolls = new Set();
const LONG_POLL_TIMEOUT_MS = 25000;

export function clearEventBuffer() {
  eventBuffer.length = 0;
}

function resolveLongPolls() {
  for (const poll of [...pendingLongPolls]) {
    const events = eventBuffer.filter((event) => event.sequenceNo > poll.afterSeq);

    if (events.length > 0) {
      clearTimeout(poll.timeoutHandle);
      pendingLongPolls.delete(poll);
      poll.res.json(events);
    }
  }
}

app.use(express.json());
app.use(express.static("app/client"));
app.use("/control", controlRoutes);


app.get("/health", (_req, res) => {
  res.json({ ok: true });
});


app.get("/events/sse", async (req, res) => {
  console.log("SSE client connected");

  const afterSeq = Number(req.query.afterSeq ?? 0);
  const scenarioId = String(req.query.scenarioId ?? "");

  if (Number.isNaN(afterSeq)) {
    return res.status(400).json({ error: "afterSeq must be a number" });
  }

  if (!scenarioId) {
    return res.status(400).json({ error: "scenarioId is required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.flushHeaders?.();
  res.write(": connected\n\n");

  try {
    const initialEvents = await getSyncEventsAfter({ scenarioId, afterSeq });

    for (const event of initialEvents) {
      if (event.transport === "sse") {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    }
  } catch (err) {
    console.error("Initial SSE DB query failed:", err);
    res.write(`event: error\ndata: ${JSON.stringify({ error: "Initial SSE load failed" })}\n\n`);
  }

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 15000);

  const client = { res, scenarioId };
  sseClients.add(client);

  req.on("close", () => {
    console.log("SSE client disconnected");
    clearInterval(heartbeat);
    sseClients.delete(client);
  });
});

wss.on("connection", (socket) => {
  console.log("WebSocket client connected");
  wsClients.add(socket);

  socket.on("close", () => {
    console.log("WebSocket client disconnected");
    wsClients.delete(socket);
  });

  socket.on("error", (err) => {
    console.error("WebSocket client error:", err);
  });
});

dbTriggeredWss.on("connection", (socket) => {
  console.log("DB-triggered WebSocket client connected");
  dbTriggeredWsClients.add(socket);

  socket.on("close", () => {
    console.log("DB-triggered WebSocket client disconnected");
    dbTriggeredWsClients.delete(socket);
  });

  socket.on("error", (err) => {
    console.error("DB-triggered WebSocket client error:", err);
  });
});

server.on("upgrade", (req, socket, head) => {
  const { url } = req;

  if (url === "/events/ws") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
    return;
  }

  if (url === "/events/dbtriggered") {
    dbTriggeredWss.handleUpgrade(req, socket, head, (ws) => {
      dbTriggeredWss.emit("connection", ws, req);
    });
    return;
  }

  socket.destroy();
});

app.get("/events/polling", async (req, res) => {
  const afterSeq = Number(req.query.afterSeq ?? 0);
  const scenarioId = String(req.query.scenarioId ?? "");

  if (Number.isNaN(afterSeq)) {
    return res.status(400).json({ error: "afterSeq must be a number" });
  }

  if (!scenarioId) {
    return res.status(400).json({ error: "scenarioId is required" });
  }

  try {
    const events = await getSyncEventsAfter({ scenarioId, afterSeq });
    res.json(events);
  } catch (err) {
    console.error("Polling DB query failed:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/events/longpoll", async (req, res) => {
  const afterSeq = Number(req.query.afterSeq ?? 0);
  const scenarioId = String(req.query.scenarioId ?? "");

  if (Number.isNaN(afterSeq)) {
    return res.status(400).json({ error: "afterSeq must be a number" });
  }

  if (!scenarioId) {
    return res.status(400).json({ error: "scenarioId is required" });
  }

  const deadline = Date.now() + LONG_POLL_TIMEOUT_MS;

  async function tryRespond() {
    try {
      const events = await getSyncEventsAfter({ scenarioId, afterSeq });

      if (events.length > 0) {
        return res.json(events);
      }

      if (Date.now() >= deadline) {
        return res.json([]);
      }

      setTimeout(tryRespond, 250);
    } catch (err) {
      console.error("Long polling DB query failed:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  tryRespond();
});

subscribe((event) => {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  eventBuffer.push(event);

  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    eventBuffer.shift();
  }
    
  resolveLongPolls();

  if (event.transport === "dbtriggered") {
    const dbTriggeredWsData = JSON.stringify(event);

    for (const socket of dbTriggeredWsClients) {
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(dbTriggeredWsData);
        }
      } catch (err) {
        console.error("Failed to send DB-triggered WebSocket event:", err);
      }
    }
  }

  for (const client of sseClients) {
    if (client.scenarioId === event.scenarioId && event.transport === "sse") {
      client.res.write(data);
    }
  }

  if (event.transport !== "dbtriggered") {
    const wsData = JSON.stringify(event);

    for (const socket of wsClients) {
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(wsData);
        }
      } catch (err) {
        console.error("Failed to send WebSocket event:", err);
      }
    }
  }
});

const PORT = Number(process.env.PORT || 3000);
server.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  try {
    await connectDb();
    await startDbTriggeredListener();
  } catch (err) {
    console.error("Failed to connect to DB:", err);
  }
});