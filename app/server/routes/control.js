import express from "express";
import { startProducer, stopProducer, getProducerState } from "../producer.js";

const router = express.Router();

router.get("/status", (_req, res) => {
  res.json(getProducerState());
});

router.post("/start", (req, res) => {
  const {
    scenarioId,
    transport,
    eventRatePerSecond,
    payloadSizeBytes
  } = req.body;

  if ( scenarioId == null || transport == null || eventRatePerSecond == null || payloadSizeBytes == null ) {
    return res.status(400).json({
      error: "Missing required fields: scenarioId, transport, eventRatePerSecond, payloadSizeBytes"
    });
  }
  const result = startProducer({
    scenarioId,
    transport,
    eventRatePerSecond,
    payloadSizeBytes
  });

  res.json(result);
});

router.post("/stop", (_req, res) => {
  const result = stopProducer();
  res.json(result);
});

export default router;