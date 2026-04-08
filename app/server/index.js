import express from "express";
import http from "http";
import controlRoutes from "./routes/control.js";
import { subscribe } from "./eventBus.js";
import { WebSocketServer, WebSocket } from "ws";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/events/ws" });
const wsClients = new Set();

app.use(express.json());
app.use(express.static("app/client"));
app.use("/control", controlRoutes);

const sseClients = new Set();

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/events/sse", (req, res) => {
  console.log("SSE client connected");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  res.flushHeaders?.();
  res.write(": connected\n\n");

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 15000);

  sseClients.add(res);

  req.on("close", () => {
    console.log("SSE client disconnected");
    clearInterval(heartbeat);
    sseClients.delete(res);
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

subscribe((event) => {
  const data = `data: ${JSON.stringify(event)}\n\n`;

  for (const client of sseClients) {
    client.write(data);
  }
  
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
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});