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

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 15000);

  const client = { res, scenarioId };
  sseClients.add(client);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(client);
  });
});

wss.on("connection", (socket) => {
  wsClients.add(socket);

  socket.on("close", () => {
    wsClients.delete(socket);
  });

  socket.on("error", (err) => {
    console.error("WebSocket client error:", err);
  });
});

dbTriggeredWss.on("connection", (socket) => {
  dbTriggeredWsClients.add(socket);

  socket.on("close", () => {
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

  try {
    const events = await getSyncEventsAfter({ scenarioId, afterSeq });

    if (events.length > 0) {
      return res.json(events);
    }

    const poll = {
      scenarioId,
      afterSeq,
      res,
      timeoutHandle: setTimeout(() => {
        pendingLongPolls.delete(poll);
        res.json([]);
      }, LONG_POLL_TIMEOUT_MS)
    };

    pendingLongPolls.add(poll);

    req.on("close", () => {
      clearTimeout(poll.timeoutHandle);
      pendingLongPolls.delete(poll);
    });
  } catch (err) {
    console.error("Long polling DB query failed:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

async function resolveLongPollsForEvent(event) {
  const polls = [...pendingLongPolls].filter(
    (poll) =>
      poll.scenarioId === event.scenarioId &&
      event.sequenceNo > poll.afterSeq
  );

  for (const poll of polls) {
    try {
      const events = await getSyncEventsAfter({
        scenarioId: poll.scenarioId,
        afterSeq: poll.afterSeq
      });

      clearTimeout(poll.timeoutHandle);
      pendingLongPolls.delete(poll);
      poll.res.json(events);
    } catch (err) {
      console.error("Failed to resolve long poll:", err);
      clearTimeout(poll.timeoutHandle);
      pendingLongPolls.delete(poll);
      poll.res.status(500).json({ error: "Internal server error" });
    }
  }
}

subscribe((event) => {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  eventBuffer.push(event);

  if (eventBuffer.length > MAX_BUFFER_SIZE) {
    eventBuffer.shift();
  }
    
  resolveLongPolls();
  resolveLongPollsForEvent(event).catch((err) => {
  console.error("Long poll resolution error:", err);
  });

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
    if (event.transport === "sse" && client.scenarioId === event.scenarioId) {
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