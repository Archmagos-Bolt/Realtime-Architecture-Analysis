CREATE OR REPLACE FUNCTION notify_sync_event()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'sync_events_channel',
    json_build_object(
      'scenarioId', NEW.scenario_id,
      'sequenceNo', NEW.sequence_no,
      'transport', NEW.transport,
      'payload', NEW.payload,
      'payloadSizeBytes', NEW.payload_size_bytes,
      'createdAt', NEW.created_at
    )::text
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_events_notify_trigger ON sync_events;

CREATE TRIGGER sync_events_notify_trigger
AFTER INSERT ON sync_events
FOR EACH ROW
EXECUTE FUNCTION notify_sync_event();