import { useEffect, useRef, useState } from "react";

const DEFAULT_WS_URL = "ws://localhost:8080";

export function useTerminalSocket() {
  const [screen, setScreen] = useState({ type: "SCREEN", state: "IDLE" });
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const url = import.meta.env.VITE_TERMINAL_WS_URL || DEFAULT_WS_URL;
    let cancelled = false;
    let socket;

    function connect() {
      socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        if (!cancelled) setTimeout(connect, 1000);
      };
      socket.onerror = () => socket.close();
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "SCREEN") setScreen(msg);
        } catch {
          // ignore malformed messages
        }
      };
    }

    connect();
    return () => {
      cancelled = true;
      socketRef.current?.close();
    };
  }, []);

  function send(message) {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }

  return { screen, connected, send };
}
