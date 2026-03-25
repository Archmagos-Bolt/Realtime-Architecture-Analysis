const subscribers = new Set();

export function subscribe(handler) {
  subscribers.add(handler);
  return () => subscribers.delete(handler);
}

export function publish(event) {
  for (const handler of subscribers) {
    handler(event);
  }
}