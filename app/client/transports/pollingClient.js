function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getScenarioIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("scenarioId") || "";
}

export function connectPolling({ onOpen, onEvent, onError, intervalMs = 1000 }) {
  let stopped = false;
  let lastSeq = 0;
  let opened = false;
  
  const scenarioId = getScenarioIdFromQuery();

  async function pollLoop() {
    while (!stopped) {
      try {
        const response = await fetch(
          `/events/polling?scenarioId=${encodeURIComponent(scenarioId)}&afterSeq=${lastSeq}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error(`Polling failed with status ${response.status}`);
        }

        if (!opened) {
          onOpen?.();
          opened = true;
        }

        const events = await response.json();

        for (const event of events) {
          onEvent?.(event);
          lastSeq = Math.max(lastSeq, event.sequenceNo);
        }
      } catch (err) {
        onError?.(err);
      }

      await sleep(intervalMs);
    }
  }

  pollLoop();

  return {
    close: () => {
      stopped = true;
    }
  };
}