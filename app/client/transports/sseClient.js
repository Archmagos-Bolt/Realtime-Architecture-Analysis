function getScenarioIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("scenarioId") || "";
}

export function connectSSE({ onOpen, onEvent, onError }) {
  const scenarioId = getScenarioIdFromQuery();
  let lastSeq = 0;

  const source = new EventSource(
    `/events/sse?scenarioId=${encodeURIComponent(scenarioId)}&afterSeq=${ lastSeq }`
  );

  source.onopen = () => {
    onOpen?.();
  };

  source.onmessage = (message) => {
    const event = JSON.parse(message.data);
    onEvent?.(event);
    lastSeq = Math.max(lastSeq, event.sequenceNo);
  };

  source.onerror = (err) => {
    onError?.(err, source.readyState);
  };

  return {
    close: () => source.close()
  };
}