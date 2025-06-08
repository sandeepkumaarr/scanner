export interface TickerData {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  p: string; // Price change
  P: string; // Price change percent
  w: string; // Weighted average price
  c: string; // Last price
  Q: string; // Last quantity
  o: string; // Open price
  h: string; // High price
  l: string; // Low price
  v: string; // Total traded base asset volume
  q: string; // Total traded quote asset volume
  O: number; // Statistics open time
  C: number; // Statistics close time
  F: number; // First trade ID
  L: number; // Last trade ID
  n: number; // Total number of trades
}

export interface MarketDataUpdate {
  symbol: string;
  price: number;
  change24h: number;
  volume: number;
  high24h: number;
  low24h: number;
  open: number;
  close: number;
}

export class BinanceWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnected = false;
  private subscribers: Map<string, (data: MarketDataUpdate[]) => void> =
    new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private marketData: Map<string, MarketDataUpdate> = new Map();

  constructor() {
    this.connect();
  }

  private connect() {
    try {
      // Binance Futures WebSocket stream for all 24hr ticker data
      this.ws = new WebSocket("wss://fstream.binance.com/ws/!ticker@arr");

      this.ws.onopen = () => {
        console.log("WebSocket connected to Binance");
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (Array.isArray(data)) {
            this.handleTickerArray(data);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      this.ws.onclose = (event) => {
        console.log("WebSocket connection closed:", event.code, event.reason);
        this.isConnected = false;
        this.stopPing();
        this.handleReconnection();
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.isConnected = false;
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      this.handleReconnection();
    }
  }

  private handleTickerArray(tickers: TickerData[]) {
    const updates: MarketDataUpdate[] = [];

    tickers.forEach((ticker) => {
      // Only process USDT perpetual futures
      if (ticker.s.endsWith("USDT")) {
        const marketUpdate: MarketDataUpdate = {
          symbol: ticker.s,
          price: parseFloat(ticker.c),
          change24h: parseFloat(ticker.P),
          volume: parseFloat(ticker.v),
          high24h: parseFloat(ticker.h),
          low24h: parseFloat(ticker.l),
          open: parseFloat(ticker.o),
          close: parseFloat(ticker.c),
        };

        this.marketData.set(ticker.s, marketUpdate);
        updates.push(marketUpdate);
      }
    });

    // Notify all subscribers
    this.subscribers.forEach((callback) => {
      callback(Array.from(this.marketData.values()));
    });
  }

  private startPing() {
    // Send ping every 30 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('{"method":"ping"}');
      }
    }, 30000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private handleReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );

      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error("Max reconnection attempts reached");
    }
  }

  public subscribe(callback: (data: MarketDataUpdate[]) => void): string {
    const id = Math.random().toString(36).substr(2, 9);
    this.subscribers.set(id, callback);

    // Send current data immediately if available
    if (this.marketData.size > 0) {
      callback(Array.from(this.marketData.values()));
    }

    return id;
  }

  public unsubscribe(id: string) {
    this.subscribers.delete(id);
  }

  public getCurrentData(): MarketDataUpdate[] {
    return Array.from(this.marketData.values());
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  public disconnect() {
    this.stopPing();
    this.subscribers.clear();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // Get filtered symbols (top volume USDT pairs)
  public getTopSymbols(limit: number = 50): string[] {
    const sortedByVolume = Array.from(this.marketData.values())
      .filter((data) => data.symbol.endsWith("USDT"))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, limit)
      .map((data) => data.symbol);

    return sortedByVolume;
  }
}

// Singleton instance
let wsClientInstance: BinanceWebSocketClient | null = null;

export function getWebSocketClient(): BinanceWebSocketClient {
  // Check if we're in a browser environment
  if (typeof window === "undefined") {
    throw new Error("WebSocket client can only be used on the client side");
  }

  if (!wsClientInstance) {
    wsClientInstance = new BinanceWebSocketClient();
  }
  return wsClientInstance;
}
