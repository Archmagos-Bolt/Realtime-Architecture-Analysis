export function connectSSE({ onOpen, onEvent, onError }) {
  const source = new EventSource("/events/sse");

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