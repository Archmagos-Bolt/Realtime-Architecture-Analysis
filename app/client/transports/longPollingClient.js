export function connectLongPolling({ onOpen, onEvent, onError }) {
  let closed = false;
  let lastSeq = 0;

  onOpen?.();

  async function poll() {
    while (!closed) {
      try {
        const response = await fetch(`/events/longpoll?afterSeq=${lastSeq}`, {
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const events = await response.json();

        for (const event of events) {
          onEvent?.(event);
          lastSeq = Math.max(lastSeq, event.sequenceNo);
        }
      } catch (err) {
        onError?.(err);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  poll();

  return {
    close: () => {
      closed = true;
    }
  };
}