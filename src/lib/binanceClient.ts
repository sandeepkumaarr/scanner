import crypto from "crypto";
import axios, { AxiosRequestConfig } from "axios";

const BINANCE_BASE_URL = "https://fapi.binance.com";

export class BinanceClient {
  private apiKey: string;
  private secretKey: string;

  constructor() {
    this.apiKey = process.env.BINANCE_API_KEY || "";
    this.secretKey = process.env.BINANCE_SECRET_KEY || "";

    if (!this.apiKey || !this.secretKey) {
      throw new Error(
        "Binance API credentials not found in environment variables"
      );
    }
  }

  private createSignature(queryString: string): string {
    return crypto
      .createHmac("sha256", this.secretKey)
      .update(queryString)
      .digest("hex");
  }

  private async makeRequest(
    endpoint: string,
    params: Record<string, string | number> = {},
    requiresAuth = false
  ) {
    const url = `${BINANCE_BASE_URL}${endpoint}`;
    const config: AxiosRequestConfig = {
      headers: {
        "X-MBX-APIKEY": this.apiKey,
      },
    };

    if (requiresAuth) {
      const timestamp = Date.now();
      const queryString = new URLSearchParams({
        ...params,
        timestamp: timestamp.toString(),
      }).toString();

      const signature = this.createSignature(queryString);
      params.timestamp = timestamp;
      params.signature = signature;
    }

    config.params = params;

    try {
      const response = await axios.get(url, config);
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { data?: unknown };
        message?: string;
      };
      console.error(
        `Binance API Error for ${endpoint}:`,
        axiosError.response?.data || axiosError.message
      );
      throw error;
    }
  }

  async getExchangeInfo() {
    return this.makeRequest("/fapi/v1/exchangeInfo");
  }

  async getKlines(symbol: string, interval: string, limit: number = 500) {
    return this.makeRequest("/fapi/v1/klines", {
      symbol,
      interval,
      limit,
    });
  }

  async get24hrTicker(symbol?: string) {
    const params: Record<string, string | number> = {};
    if (symbol) {
      params.symbol = symbol;
    }
    return this.makeRequest("/fapi/v1/ticker/24hr", params);
  }

  async getAccountInfo() {
    return this.makeRequest("/fapi/v2/account", {}, true);
  }

  async getSymbolPriceTicker(symbol?: string) {
    const params: Record<string, string | number> = {};
    if (symbol) {
      params.symbol = symbol;
    }
    return this.makeRequest("/fapi/v1/ticker/price", params);
  }

  // Get multiple symbols klines efficiently
  async getMultipleKlines(
    symbols: string[],
    interval: string,
    limit: number = 2
  ) {
    const promises = symbols.map((symbol) =>
      this.getKlines(symbol, interval, limit)
        .then((data) => ({ symbol, data }))
        .catch((error) => {
          console.error(`Error fetching ${symbol}:`, error.message);
          return { symbol, data: [] };
        })
    );

    return Promise.all(promises);
  }

  // Get list of active trading symbols
  async getSymbols(): Promise<string[]> {
    try {
      const exchangeInfo = await this.getExchangeInfo();
      return exchangeInfo.symbols
        .filter(
          (symbol: { status: string; contractType: string }) =>
            symbol.status === "TRADING" && symbol.contractType === "PERPETUAL"
        )
        .map((symbol: { symbol: string }) => symbol.symbol)
        .slice(0, 50); // Limit to first 50 symbols for demo
    } catch (error) {
      console.error("Error fetching symbols:", error);
      return [];
    }
  }

  // Get historical daily ranges for ADR calculation
  async getHistoricalRanges(
    symbol: string,
    days: number = 20
  ): Promise<number[]> {
    try {
      const klines = await this.getKlines(symbol, "1d", days);
      return klines.map((kline: BinanceKlineArray) => {
        const high = parseFloat(kline[2]);
        const low = parseFloat(kline[3]);
        return high - low; // Daily range
      });
    } catch (error) {
      console.error(`Error fetching historical ranges for ${symbol}:`, error);
      return [];
    }
  }

  // Get market data for symbols with historical ranges for ADR
  async getMarketData(symbols: string[]): Promise<
    Array<{
      symbol: string;
      price: number;
      change24h: number;
      volume: number;
      high24h: number;
      low24h: number;
      open: number;
      close: number;
      historicalRanges?: number[];
    }>
  > {
    try {
      const tickers = await this.get24hrTicker();
      const filteredTickers = tickers.filter((ticker: { symbol: string }) =>
        symbols.includes(ticker.symbol)
      );

      // Fetch historical ranges for each symbol in parallel
      const marketDataPromises = filteredTickers.map(
        async (ticker: {
          symbol: string;
          lastPrice: string;
          priceChangePercent: string;
          volume: string;
          highPrice: string;
          lowPrice: string;
          openPrice: string;
        }) => {
          const historicalRanges = await this.getHistoricalRanges(
            ticker.symbol
          );

          return {
            symbol: ticker.symbol,
            price: parseFloat(ticker.lastPrice),
            change24h: parseFloat(ticker.priceChangePercent),
            volume: parseFloat(ticker.volume),
            high24h: parseFloat(ticker.highPrice),
            low24h: parseFloat(ticker.lowPrice),
            open: parseFloat(ticker.openPrice),
            close: parseFloat(ticker.lastPrice),
            historicalRanges,
          };
        }
      );

      return Promise.all(marketDataPromises);
    } catch (error) {
      console.error("Error fetching market data:", error);
      return [];
    }
  }
}

// Create and export a singleton instance
export const binanceClient = new BinanceClient();

export interface CandleData {
  symbol: string;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  range: number;
}

// Define the structure of Binance kline data
type BinanceKlineArray = [
  number, // Open time
  string, // Open price
  string, // High price
  string, // Low price
  string, // Close price
  string, // Volume
  number, // Close time
  string, // Quote asset volume
  number, // Number of trades
  string, // Taker buy base asset volume
  string, // Taker buy quote asset volume
  string // Unused field, ignore
];

export function formatKlineData(
  symbol: string,
  klines: BinanceKlineArray[]
): CandleData[] {
  return klines.map((kline: BinanceKlineArray) => ({
    symbol,
    openTime: kline[0],
    closeTime: kline[6],
    open: parseFloat(kline[1]),
    high: parseFloat(kline[2]),
    low: parseFloat(kline[3]),
    close: parseFloat(kline[4]),
    volume: parseFloat(kline[5]),
    range: parseFloat(kline[2]) - parseFloat(kline[3]), // high - low
  }));
}
