export function connectDbTriggered({ onOpen, onEvent, onError }) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${window.location.host}/events/dbtriggered`;
  console.log("DB-triggered client attempting WebSocket:", url);

  const socket = new WebSocket(url);

  socket.onopen = () => {
    onOpen?.();
  };

  socket.onmessage = (message) => {
    const event = JSON.parse(message.data);
    onEvent?.(event);
  };

  socket.onerror = (err) => {
    console.warn("DB-triggered WebSocket error", err, "readyState:", socket.readyState);
    onError?.(err, socket.readyState);
  };

  socket.onclose = (evt) => {
    console.warn("DB-triggered WebSocket closed", evt.code, evt.reason);
  };

  return {
    close: () => socket.close()
  };
}