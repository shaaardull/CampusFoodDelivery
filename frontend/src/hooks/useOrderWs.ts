"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { WsMessage } from "@/types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8001";

interface UseOrderWsOptions {
  orderId: string;
  role: "requester" | "pilot";
  onMessage?: (msg: WsMessage) => void;
}

export function useOrderWs({ orderId, role, onMessage }: UseOrderWsOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(
      `${WS_URL}/ws/order/${orderId}?role=${role}`
    );

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        setMessages((prev) => [...prev.slice(-99), msg]); // Keep last 100
        onMessage?.(msg);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Auto-reconnect after 3 seconds
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
    wsRef.current = ws;
  }, [orderId, role, onMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback(
    (msg: Record<string, unknown>) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(msg));
      }
    },
    []
  );

  return { connected, messages, send };
}

/**
 * Hook for pilot to broadcast GPS location every N seconds.
 */
export function usePilotLocationBroadcast(
  send: (msg: Record<string, unknown>) => void,
  active: boolean,
  intervalMs = 10000
) {
  useEffect(() => {
    if (!active || !navigator.geolocation) return;

    const id = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          send({
            type: "location",
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {}, // Ignore errors silently
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }, intervalMs);

    return () => clearInterval(id);
  }, [send, active, intervalMs]);
}
