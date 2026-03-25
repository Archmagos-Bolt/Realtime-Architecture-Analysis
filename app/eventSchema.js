export function createEvent({
  eventId,
  scenarioId,
  sequenceNo,
  transport,
  payload,
  payloadSizeBytes,
  serverCreatedWallMs
}) {
  return {
    eventId,
    scenarioId,
    sequenceNo,
    transport,
    payload,
    payloadSizeBytes,
    serverCreatedWallMs
  };
}