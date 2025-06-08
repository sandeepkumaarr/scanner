import { NextRequest, NextResponse } from "next/server";
import { detectBlueprints } from "@/lib/blueprintDetector";
import { binanceClient } from "@/lib/binanceClient";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "all";
    const confidence = searchParams.get("confidence") || "all";
    const sortBy = searchParams.get("sortBy") || "confidence";

    // Get market data from Binance
    const symbols = await binanceClient.getSymbols();
    const marketData = await binanceClient.getMarketData(symbols);

    // Detect blueprints
    const allResults = await detectBlueprints(marketData);

    // Filter by type
    let filteredResults = allResults;
    if (type !== "all") {
      filteredResults = allResults.filter((result) =>
        result.blueprintType.toLowerCase().includes(type.toLowerCase())
      );
    }

    // Filter by confidence
    if (confidence !== "all") {
      filteredResults = filteredResults.filter(
        (result) => result.confidence.toLowerCase() === confidence.toLowerCase()
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
            (confidenceOrder[b.confidence as keyof typeof confidenceOrder] ||
              0) -
            (confidenceOrder[a.confidence as keyof typeof confidenceOrder] || 0)
          );
      }
    });

    return NextResponse.json({
      success: true,
      data: filteredResults,
      totalFound: filteredResults.length,
      totalScanned: symbols.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Scanner API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        data: [],
        totalFound: 0,
        totalScanned: 0,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
