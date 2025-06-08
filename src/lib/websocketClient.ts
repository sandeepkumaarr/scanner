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

export interface KlineData {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  k: {
    t: number; // Kline start time
    T: number; // Kline close time
    s: string; // Symbol
    i: string; // Interval
    f: number; // First trade ID
    L: number; // Last trade ID
    o: string; // Open price
    c: string; // Close price
    h: string; // High price
    l: string; // Low price
    v: string; // Base asset volume
    n: number; // Number of trades
    x: boolean; // Is this kline closed?
    q: string; // Quote asset volume
    V: string; // Taker buy base asset volume
    Q: string; // Taker buy quote asset volume
  };
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
  timeframe?: string;
  timestamp?: number;
}

export interface CandlestickData {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
  timeframe: string;
}

export type TimeframeType = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export const TIMEFRAME_INTERVALS: Record<TimeframeType, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
};

export class BinanceWebSocketClient {
  private ws: WebSocket | null = null;
  private klineWs: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnected = false;
  private isKlineConnected = false;
  private subscribers: Map<string, (data: MarketDataUpdate[]) => void> =
    new Map();
  private klineSubscribers: Map<string, (data: CandlestickData[]) => void> =
    new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private klinePingInterval: NodeJS.Timeout | null = null;
  private marketData: Map<string, MarketDataUpdate> = new Map();
  private candlestickData: Map<string, Map<string, CandlestickData>> =
    new Map();
  private currentTimeframe: TimeframeType = "4h";

  constructor() {
    this.connect();
    // Initialize kline connection with default timeframe after a short delay
    setTimeout(() => {
      this.connectKline(this.currentTimeframe);
    }, 2000);
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

  private connectKline(timeframe: TimeframeType, symbols: string[] = []) {
    if (this.klineWs) {
      this.klineWs.close();
    }

    try {
      // Get top symbols if none provided
      const targetSymbols =
        symbols.length > 0 ? symbols : this.getTopSymbols(50);

      // Create stream names for kline data
      const streams = targetSymbols
        .filter((symbol) => symbol.endsWith("USDT"))
        .map(
          (symbol) =>
            `${symbol.toLowerCase()}@kline_${TIMEFRAME_INTERVALS[timeframe]}`
        )
        .slice(0, 50); // Limit to 50 streams

      if (streams.length === 0) {
        console.warn("No symbols available for kline connection");
        return;
      }

      const streamUrl = `wss://fstream.binance.com/stream?streams=${streams.join(
        "/"
      )}`;
      this.klineWs = new WebSocket(streamUrl);

      this.klineWs.onopen = () => {
        console.log(`Kline WebSocket connected for timeframe ${timeframe}`);
        this.isKlineConnected = true;
        this.startKlinePing();
      };

      this.klineWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.data && data.data.k) {
            this.handleKlineData(data.data);
          }
        } catch (error) {
          console.error("Error parsing kline WebSocket message:", error);
        }
      };

      this.klineWs.onclose = (event) => {
        console.log(
          "Kline WebSocket connection closed:",
          event.code,
          event.reason
        );
        this.isKlineConnected = false;
        this.stopKlinePing();
      };

      this.klineWs.onerror = (error) => {
        console.error("Kline WebSocket error:", error);
        this.isKlineConnected = false;
      };
    } catch (error) {
      console.error("Failed to create kline WebSocket connection:", error);
    }
  }

  private handleKlineData(klineData: KlineData) {
    if (!klineData.k.x) {
      // Only process closed candles
      return;
    }

    const symbol = klineData.s;
    const candle: CandlestickData = {
      symbol,
      open: parseFloat(klineData.k.o),
      high: parseFloat(klineData.k.h),
      low: parseFloat(klineData.k.l),
      close: parseFloat(klineData.k.c),
      volume: parseFloat(klineData.k.v),
      timestamp: klineData.k.t,
      timeframe: this.currentTimeframe,
    };

    // Store candlestick data
    if (!this.candlestickData.has(symbol)) {
      this.candlestickData.set(symbol, new Map());
    }
    this.candlestickData.get(symbol)!.set(this.currentTimeframe, candle);

    // Notify kline subscribers
    const candleArray = Array.from(this.candlestickData.values())
      .map((timeframeMap) => timeframeMap.get(this.currentTimeframe))
      .filter(Boolean) as CandlestickData[];

    this.klineSubscribers.forEach((callback) => {
      callback(candleArray);
    });
  }

  private startKlinePing() {
    this.klinePingInterval = setInterval(() => {
      if (this.klineWs && this.klineWs.readyState === WebSocket.OPEN) {
        this.klineWs.send('{"method":"ping"}');
      }
    }, 30000);
  }

  private stopKlinePing() {
    if (this.klinePingInterval) {
      clearInterval(this.klinePingInterval);
      this.klinePingInterval = null;
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

  public subscribeToKlines(
    callback: (data: CandlestickData[]) => void
  ): string {
    const id = Math.random().toString(36).substr(2, 9);
    this.klineSubscribers.set(id, callback);

    // Send current candlestick data immediately if available
    const candleArray = Array.from(this.candlestickData.values())
      .map((timeframeMap) => timeframeMap.get(this.currentTimeframe))
      .filter(Boolean) as CandlestickData[];

    if (candleArray.length > 0) {
      callback(candleArray);
    }

    return id;
  }

  public unsubscribeFromKlines(id: string) {
    this.klineSubscribers.delete(id);
  }

  public setTimeframe(timeframe: TimeframeType) {
    if (this.currentTimeframe !== timeframe) {
      this.currentTimeframe = timeframe;
      // Reconnect kline WebSocket with new timeframe
      this.connectKline(timeframe);
    }
  }

  public getCurrentTimeframe(): TimeframeType {
    return this.currentTimeframe;
  }

  public getCurrentKlineData(): CandlestickData[] {
    const candleArray = Array.from(this.candlestickData.values())
      .map((timeframeMap) => timeframeMap.get(this.currentTimeframe))
      .filter(Boolean) as CandlestickData[];
    return candleArray;
  }

  public getCurrentData(): MarketDataUpdate[] {
    return Array.from(this.marketData.values());
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  public getKlineConnectionStatus(): boolean {
    return this.isKlineConnected;
  }

  public disconnect() {
    this.stopPing();
    this.stopKlinePing();
    this.subscribers.clear();
    this.klineSubscribers.clear();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.klineWs) {
      this.klineWs.close();
      this.klineWs = null;
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
