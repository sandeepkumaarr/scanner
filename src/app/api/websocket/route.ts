import { NextRequest } from "next/server";
import { BinanceClient } from "@/lib/binanceClient";
import { BlueprintDetector, CandleData } from "@/lib/blueprintDetector";

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
                })
              );
              candlesBySymbol[symbol] = formattedCandles.sort(
                (a, b) => a.openTime - b.openTime
              );
            }
          });

          // Detect blueprints
          const blueprints =
            BlueprintDetector.detectBlueprints(candlesBySymbol);

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
