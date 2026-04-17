function getScenarioIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("scenarioId") || "";
}

export function connectSSE({ onOpen, onEvent, onError }) {
  const scenarioId = getScenarioIdFromQuery();
  const source = new EventSource(
    `/events/sse?scenarioId=${encodeURIComponent(scenarioId)}`
  );

  source.onopen = () => {
    onOpen?.();
  };

  source.onmessage = (message) => {
    const event = JSON.parse(message.data);
    onEvent?.(event);
  };

  source.onerror = (err) => {
    onError?.(err, source.readyState);
  };

  return {
    close: () => source.close()
  };
}