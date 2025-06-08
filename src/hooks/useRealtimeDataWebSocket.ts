import { useState, useEffect, useRef, useCallback } from "react";
import { BlueprintResult, detectBlueprints } from "@/lib/blueprintDetector";
import {
  getWebSocketClient,
  MarketDataUpdate,
  TimeframeType,
} from "@/lib/websocketClient";

// Interface for the WebSocket client methods we use
interface WebSocketClient {
  subscribe: (callback: (data: MarketDataUpdate[]) => void) => string;
  unsubscribe: (id: string) => void;
  setTimeframe: (timeframe: TimeframeType) => void;
  getCurrentTimeframe: () => TimeframeType;
  getCurrentData: () => MarketDataUpdate[];
  getConnectionStatus: () => boolean;
  getTopSymbols: (limit?: number) => string[];
}

interface RealtimeData {
  success: boolean;
  data: BlueprintResult[];
  totalFound: number;
  totalScanned: number;
  timestamp: string;
  connectionStatus: boolean;
  currentTimeframe: TimeframeType;
  error?: string;
}

interface UseRealtimeDataOptions {
  enabled: boolean;
  selectedType: string;
  selectedConfidence: string;
  sortBy: string;
  timeframe?: TimeframeType;
  onData?: (data: RealtimeData) => void;
  onError?: (error: string) => void;
  onTimeframeChange?: (timeframe: TimeframeType) => void;
}

export function useRealtimeData({
  enabled,
  selectedType,
  selectedConfidence,
  sortBy,
  timeframe = "4h",
  onData,
  onError,
  onTimeframeChange,
}: UseRealtimeDataOptions) {
  const [data, setData] = useState<RealtimeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [currentTimeframe, setCurrentTimeframe] =
    useState<TimeframeType>(timeframe);
  const subscriptionIdRef = useRef<string | null>(null);
  // Use the WebSocketClient interface for proper typing
  const wsClientRef = useRef<WebSocketClient | null>(null);
  const processTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Stable references for callbacks to prevent re-renders
  const onDataRef = useRef(onData);
  const onErrorRef = useRef(onError);
  const onTimeframeChangeRef = useRef(onTimeframeChange);

  useEffect(() => {
    onDataRef.current = onData;
    onErrorRef.current = onError;
    onTimeframeChangeRef.current = onTimeframeChange;
  }, [onData, onError, onTimeframeChange]);

  // Initialize WebSocket client on mount (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        // Use type assertion to fix TypeScript errors
        wsClientRef.current =
          getWebSocketClient() as unknown as WebSocketClient;
      } catch (err) {
        console.error("Failed to initialize WebSocket client:", err);
        setError("Failed to initialize WebSocket connection");
      }
    }
  }, []);

  // Memoized processing function with throttling
  const processMarketData = useCallback(
    async (marketData: MarketDataUpdate[]) => {
      // Throttle processing to prevent excessive updates
      if (processTimeoutRef.current) {
        clearTimeout(processTimeoutRef.current);
      }

      processTimeoutRef.current = setTimeout(async () => {
        try {
          if (!wsClientRef.current) {
            setError("WebSocket client not initialized");
            return;
          }

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
            connectionStatus:
              wsClientRef.current?.getConnectionStatus() || false,
            currentTimeframe: currentTimeframe,
          };

          setData(newData);
          setLoading(false);
          setError(null);
          onDataRef.current?.(newData);
        } catch (err) {
          const errorMessage =
            err instanceof Error
              ? err.message
              : "Failed to process market data";
          setError(errorMessage);
          setLoading(false);
          onErrorRef.current?.(errorMessage);
        }
      }, 1000); // Throttle to 1 second
    },
    [selectedType, selectedConfidence, sortBy, currentTimeframe] // Keep currentTimeframe in deps
  );

  const disconnect = useCallback(() => {
    if (subscriptionIdRef.current && wsClientRef.current) {
      wsClientRef.current.unsubscribe(subscriptionIdRef.current);
      subscriptionIdRef.current = null;
    }
    if (processTimeoutRef.current) {
      clearTimeout(processTimeoutRef.current);
      processTimeoutRef.current = null;
    }
    setConnected(false);
  }, []);

  // Add a method to change the timeframe
  const changeTimeframe = useCallback(
    (newTimeframe: TimeframeType) => {
      if (wsClientRef.current && newTimeframe !== currentTimeframe) {
        setCurrentTimeframe(newTimeframe);
        wsClientRef.current.setTimeframe(newTimeframe);
        onTimeframeChangeRef.current?.(newTimeframe);

        // Refresh data after timeframe change
        if (wsClientRef.current.getConnectionStatus()) {
          const currentData = wsClientRef.current.getCurrentData();
          if (currentData.length > 0) {
            processMarketData(currentData);
          }
        }
      }
    },
    [currentTimeframe, processMarketData]
  );

  const connect = useCallback(() => {
    disconnect(); // Close existing subscription

    if (!wsClientRef.current) {
      setError("WebSocket client not initialized");
      return;
    }

    setLoading(true);
    setError(null);

    // Create stable subscription callback
    const subscriptionCallback = (marketData: MarketDataUpdate[]) => {
      processMarketData(marketData);
    };

    // Subscribe to WebSocket updates
    const subscriptionId = wsClientRef.current.subscribe(subscriptionCallback);

    subscriptionIdRef.current = subscriptionId;
    setConnected(wsClientRef.current.getConnectionStatus());

    // Check connection status periodically
    const statusInterval = setInterval(() => {
      if (!wsClientRef.current) return;
      const isConnected = wsClientRef.current.getConnectionStatus();
      setConnected(isConnected);
      if (!isConnected && subscriptionIdRef.current) {
        setError("Connection lost. Attempting to reconnect...");
      }
    }, 10000); // Increased to 10 seconds to reduce overhead

    return () => {
      clearInterval(statusInterval);
    };
  }, [processMarketData, disconnect]);

  const reconnect = useCallback(() => {
    connect();
  }, [connect]);

  const refreshData = useCallback(() => {
    if (!wsClientRef.current) return;
    const currentData = wsClientRef.current.getCurrentData();
    if (currentData.length > 0) {
      processMarketData(currentData);
    }
  }, [processMarketData]);

  // Main effect for enabling/disabling
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
    changeTimeframe, // Expose changeTimeframe method
    currentTimeframe, // Expose the current timeframe
  };
}
