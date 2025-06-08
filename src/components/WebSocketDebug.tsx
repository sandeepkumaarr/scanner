"use client";

import React, { useEffect, useState } from "react";
import { getWebSocketClient, MarketDataUpdate } from "@/lib/websocketClient";

export default function WebSocketDebug() {
  const [connectionStatus, setConnectionStatus] = useState(false);
  const [dataCount, setDataCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [sampleData, setSampleData] = useState<MarketDataUpdate[]>([]);

  useEffect(() => {
    const wsClient = getWebSocketClient();

    // Check connection status periodically
    const statusInterval = setInterval(() => {
      setConnectionStatus(wsClient.getConnectionStatus());
    }, 1000);

    // Subscribe to data updates
    const subscriptionId = wsClient.subscribe((data: MarketDataUpdate[]) => {
      setDataCount(data.length);
      setLastUpdate(new Date().toLocaleTimeString());
      // Keep first 5 items as sample
      setSampleData(data.slice(0, 5));
    });

    return () => {
      clearInterval(statusInterval);
      wsClient.unsubscribe(subscriptionId);
    };
  }, []);

  return (
    <div className="p-6 bg-gray-100 rounded-lg">
      <h2 className="text-xl font-bold mb-4">WebSocket Debug Info</h2>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <span className="font-semibold">Connection Status: </span>
          <span
            className={connectionStatus ? "text-green-600" : "text-red-600"}
          >
            {connectionStatus ? "Connected" : "Disconnected"}
          </span>
        </div>

        <div>
          <span className="font-semibold">Data Count: </span>
          <span>{dataCount}</span>
        </div>

        <div>
          <span className="font-semibold">Last Update: </span>
          <span>{lastUpdate}</span>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Sample Data (First 5 symbols):</h3>
        <div className="space-y-2">
          {sampleData.map((item, index) => (
            <div key={index} className="text-sm bg-white p-2 rounded">
              <span className="font-mono">{item.symbol}</span> -
              <span className="ml-2">${item.price.toFixed(4)}</span> -
              <span
                className={`ml-2 ${
                  item.change24h >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {item.change24h >= 0 ? "+" : ""}
                {item.change24h.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
