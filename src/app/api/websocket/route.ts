import { NextRequest } from "next/server";
import { BinanceClient, CandleData } from "@/lib/binanceClient";
import { detectBlueprints, MarketData } from "@/lib/blueprintDetector";

// Type for Binance symbol info
interface SymbolInfo {
  symbol: string;
  status: string;
  contractType: string;
  quoteAsset: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const interval = searchParams.get("interval") || "4h";
  const limit = parseInt(searchParams.get("limit") || "100");

  // This would be a WebSocket upgrade in a real implementation
  // For now, we'll implement Server-Sent Events (SSE)

  const stream = new ReadableStream({
    start(controller) {
      const sendUpdate = async () => {
        try {
          const binanceClient = new BinanceClient();

          // Get exchange info
          const exchangeInfo = await binanceClient.getExchangeInfo();
          const usdtSymbols = exchangeInfo.symbols
            .filter(
              (symbol: SymbolInfo) =>
                symbol.status === "TRADING" &&
                symbol.contractType === "PERPETUAL" &&
                symbol.quoteAsset === "USDT"
            )
            .map((symbol: SymbolInfo) => symbol.symbol)
            .slice(0, limit);

          // Fetch candle data
          const results = await binanceClient.getMultipleKlines(
            usdtSymbols,
            interval,
            2
          );

          // Process data
          const candlesBySymbol: Record<string, CandleData[]> = {};
          results.forEach(({ symbol, data }) => {
            if (data && data.length > 0) {
              const formattedCandles: CandleData[] = data.map(
                (kline: number[]) => ({
                  symbol,
                  openTime: kline[0],
                  closeTime: kline[6],
                  open: parseFloat(kline[1].toString()),
                  high: parseFloat(kline[2].toString()),
                  low: parseFloat(kline[3].toString()),
                  close: parseFloat(kline[4].toString()),
                  volume: parseFloat(kline[5].toString()),
                  range:
                    parseFloat(kline[2].toString()) -
                    parseFloat(kline[3].toString()), // high - low
                })
              );
              candlesBySymbol[symbol] = formattedCandles.sort(
                (a, b) => a.openTime - b.openTime
              );
            }
          });

          // Convert candle data to market data format for blueprint detection
          const marketData: MarketData[] = Object.entries(candlesBySymbol)
            .map(([symbol, candles]) => {
              if (candles.length === 0) return null;

              const latestCandle = candles[candles.length - 1];
              const previousCandle =
                candles.length > 1 ? candles[candles.length - 2] : latestCandle;

              // Calculate 24h change percentage
              const change24h = previousCandle
                ? ((latestCandle.close - previousCandle.close) /
                    previousCandle.close) *
                  100
                : 0;

              return {
                symbol,
                price: latestCandle.close,
                change24h,
                volume: latestCandle.volume,
                high24h: latestCandle.high,
                low24h: latestCandle.low,
                open: latestCandle.open,
                close: latestCandle.close,
                historicalRanges: undefined, // Will be populated when we add historical data fetching
              };
            })
            .filter(Boolean) as MarketData[];

          // Detect blueprints
          const blueprints = await detectBlueprints(marketData);

          const data = {
            success: true,
            data: blueprints,
            totalFound: blueprints.length,
            totalScanned: Object.keys(candlesBySymbol).length,
            timestamp: new Date().toISOString(),
            interval,
            limit,
          };

          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
        } catch (error) {
          console.error("SSE Error:", error);
          controller.enqueue(
            `data: ${JSON.stringify({ error: "Failed to fetch data" })}\n\n`
          );
        }
      };

      // Send initial data
      sendUpdate();

      // Set up interval for live updates
      const intervalId = setInterval(sendUpdate, 30000); // Every 30 seconds

      // Cleanup function
      return () => {
        clearInterval(intervalId);
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
