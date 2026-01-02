/// <reference lib="webworker" />

declare const self: SharedWorkerGlobalScope;

const ports: Set<MessagePort> = new Set();

self.onconnect = (e: MessageEvent) => {
  const port = e.ports[0];
  ports.add(port);

  port.onmessage = (event: MessageEvent) => {
    const { type } = event.data;

    if (type === 'LOGOUT') {
      // Broadcast to all other ports
      ports.forEach((p) => {
        if (p !== port) {
          p.postMessage({ type: 'LOGOUT' });
        }
      });
    }
  };

  port.start();
};

export {};
