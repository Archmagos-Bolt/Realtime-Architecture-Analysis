export function connectWebSocket({ onOpen, onEvent, onError }) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${window.location.host}/events/ws`);

  socket.onopen = () => {
    onOpen?.();
  };

  socket.onmessage = (message) => {
    const event = JSON.parse(message.data);
    onEvent?.(event);
  };

  socket.onerror = (err) => {
    onError?.(err, socket.readyState);
  };

  return {
    close: () => socket.close()
  };
}