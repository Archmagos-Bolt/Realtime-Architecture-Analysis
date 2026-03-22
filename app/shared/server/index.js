import express from "express";
import http from "http";

const app = express();
const server = http.createServer(app);

app.use(express.static("app/client"));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});