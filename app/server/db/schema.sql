CREATE TABLE IF NOT EXISTS sync_events (
  id BIGSERIAL PRIMARY KEY,
  scenario_id TEXT NOT NULL,
  sequence_no INTEGER NOT NULL,
  payload TEXT NOT NULL,
  payload_size_bytes INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS sync_events_scenario_seq_idx
ON sync_events (scenario_id, sequence_no);