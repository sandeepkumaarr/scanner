import { useState, useEffect, useRef, useCallback } from "react";
import { BlueprintResult } from "@/lib/blueprintDetector";

interface RealtimeData {
  success: boolean;
  data: BlueprintResult[];
  totalFound: number;
  totalScanned: number;
  timestamp: string;
  interval?: string;
  limit?: number;
  error?: string;
}

interface UseRealtimeDataOptions {
  interval: string;
  limit: number;
  enabled: boolean;
  onData?: (data: RealtimeData) => void;
  onError?: (error: string) => void;
}

export function useRealtimeData({
  interval,
  limit,
  enabled,
  onData,
  onError,
}: UseRealtimeDataOptions) {
  const [data, setData] = useState<RealtimeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnected(false);
  }, []);

  const connect = useCallback(() => {
    disconnect(); // Close existing connection

    setLoading(true);
    setError(null);

    const url = `/api/websocket?interval=${interval}&limit=${limit}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
      setLoading(false);
      console.log("SSE connection opened");
    };

    eventSource.onmessage = (event) => {
      try {
        const newData: RealtimeData = JSON.parse(event.data);

        if (newData.error) {
          setError(newData.error);
          onError?.(newData.error);
        } else {
          setData(newData);
          setError(null);
          onData?.(newData);
        }

        setLoading(false);
      } catch (err) {
        const errorMsg = "Failed to parse SSE data";
        setError(errorMsg);
        onError?.(errorMsg);
        console.error("SSE parse error:", err);
      }
    };

    eventSource.onerror = (err) => {
      setConnected(false);
      setLoading(false);
      const errorMsg = "SSE connection error";
      setError(errorMsg);
      onError?.(errorMsg);
      console.error("SSE error:", err);

      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (enabled) {
          connect();
        }
      }, 5000);
    };
  }, [interval, limit, onData, onError, enabled, disconnect]);

  useEffect(() => {
    if (!enabled) {
      disconnect();
      return;
    }

    connect();

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  const reconnect = useCallback(() => {
    if (enabled) {
      connect();
    }
  }, [enabled, connect]);

  return {
    data,
    loading,
    error,
    connected,
    reconnect,
    disconnect,
  };
}
