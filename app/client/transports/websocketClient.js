export function connectWebSocket({ onOpen, onEvent, onError }) {
  const socket = new WebSocket("ws://localhost:3000/events/ws");

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