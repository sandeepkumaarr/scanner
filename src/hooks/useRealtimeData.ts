import { useState, useEffect, useRef, useCallback } from "react";
import { BlueprintResult, detectBlueprints } from "../lib/blueprintDetector";
import {
  getWebSocketClient,
  MarketDataUpdate,
  BinanceWebSocketClient,
} from "../lib/websocketClient";

interface RealtimeData {
  success: boolean;
  data: BlueprintResult[];
  totalFound: number;
  totalScanned: number;
  timestamp: string;
  connectionStatus: boolean;
  error?: string;
}

interface UseRealtimeDataOptions {
  enabled: boolean;
  selectedType: string;
  selectedConfidence: string;
  sortBy: string;
  onData?: (data: RealtimeData) => void;
  onError?: (error: string) => void;
}

export function useRealtimeData({
  enabled,
  selectedType,
  selectedConfidence,
  sortBy,
  onData,
  onError,
}: UseRealtimeDataOptions) {
  const [data, setData] = useState<RealtimeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const subscriptionIdRef = useRef<string | null>(null);
  const wsClientRef = useRef<BinanceWebSocketClient | null>(null);

  // Initialize WebSocket client on mount (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        wsClientRef.current = getWebSocketClient();
      } catch (err) {
        console.error("Failed to initialize WebSocket client:", err);
        setError("Failed to initialize WebSocket connection");
      }
    }
  }, []);

  const processMarketData = useCallback(
    async (marketData: MarketDataUpdate[]) => {
      if (!wsClientRef.current) return;

      try {
        // Get top 50 symbols by volume
        const topSymbols = wsClientRef.current.getTopSymbols(50);
        const filteredMarketData = marketData.filter((item) =>
          topSymbols.includes(item.symbol)
        );

        // Detect blueprints
        const allResults = await detectBlueprints(filteredMarketData);

        // Filter by type
        let filteredResults = allResults;
        if (selectedType !== "all") {
          filteredResults = allResults.filter((result) =>
            result.blueprintType
              .toLowerCase()
              .includes(selectedType.toLowerCase())
          );
        }

        // Filter by confidence
        if (selectedConfidence !== "all") {
          filteredResults = filteredResults.filter(
            (result) =>
              result.confidence.toLowerCase() ===
              selectedConfidence.toLowerCase()
          );
        }

        // Sort results
        filteredResults.sort((a, b) => {
          switch (sortBy) {
            case "symbol":
              return a.symbol.localeCompare(b.symbol);
            case "price":
              return b.price - a.price;
            case "change":
              return b.change24h - a.change24h;
            case "volume":
              return b.volume - a.volume;
            case "confidence":
            default:
              const confidenceOrder = { High: 3, Medium: 2, Low: 1 };
              return (
                (confidenceOrder[
                  b.confidence as keyof typeof confidenceOrder
                ] || 0) -
                (confidenceOrder[
                  a.confidence as keyof typeof confidenceOrder
                ] || 0)
              );
          }
        });

        const newData: RealtimeData = {
          success: true,
          data: filteredResults,
          totalFound: filteredResults.length,
          totalScanned: filteredMarketData.length,
          timestamp: new Date().toISOString(),
          connectionStatus: wsClientRef.current.getConnectionStatus(),
        };

        setData(newData);
        setLoading(false);
        setError(null);
        onData?.(newData);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to process market data";
        setError(errorMessage);
        setLoading(false);
        onError?.(errorMessage);
      }
    },
    [selectedType, selectedConfidence, sortBy, onData, onError]
  );

  const disconnect = useCallback(() => {
    if (subscriptionIdRef.current && wsClientRef.current) {
      wsClientRef.current.unsubscribe(subscriptionIdRef.current);
      subscriptionIdRef.current = null;
    }
    setConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!wsClientRef.current) return;

    disconnect(); // Close existing subscription

    setLoading(true);
    setError(null);

    // Subscribe to WebSocket updates
    const subscriptionId = wsClientRef.current.subscribe(
      (marketData: MarketDataUpdate[]) => {
        processMarketData(marketData);
      }
    );

    subscriptionIdRef.current = subscriptionId;
    setConnected(wsClientRef.current.getConnectionStatus());

    // Check connection status periodically
    const statusInterval = setInterval(() => {
      if (wsClientRef.current) {
        const isConnected = wsClientRef.current.getConnectionStatus();
        setConnected(isConnected);
        if (!isConnected && subscriptionIdRef.current) {
          setError("Connection lost. Attempting to reconnect...");
        }
      }
    }, 5000);

    return () => {
      clearInterval(statusInterval);
    };
  }, [processMarketData, disconnect]);

  const reconnect = useCallback(() => {
    connect();
  }, [connect]);

  const refreshData = useCallback(() => {
    if (wsClientRef.current) {
      const currentData = wsClientRef.current.getCurrentData();
      if (currentData.length > 0) {
        processMarketData(currentData);
      }
    }
  }, [processMarketData]);

  useEffect(() => {
    if (enabled) {
      const cleanup = connect();
      return cleanup;
    } else {
      disconnect();
    }
  }, [enabled, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    data,
    loading,
    error,
    connected,
    disconnect,
    reconnect,
    refreshData,
  };
}
