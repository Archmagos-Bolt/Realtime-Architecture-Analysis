function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function connectPolling({ onOpen, onEvent, onError, intervalMs = 1000 }) {
  let stopped = false;
  let lastSeq = 0;
  let opened = false;

  async function pollLoop() {
    while (!stopped) {
      try {
        const response = await fetch(`/events/polling?afterSeq=${lastSeq}`);

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