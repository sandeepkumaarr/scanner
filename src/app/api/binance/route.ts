import { NextRequest, NextResponse } from "next/server";
import { binanceClient } from "@/lib/binanceClient";
import { detectBlueprints } from "@/lib/blueprintDetector";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbols = searchParams.get("symbols");
    const action = searchParams.get("action") || "market-data";

    switch (action) {
      case "symbols":
        const symbolList = await binanceClient.getSymbols();
        return NextResponse.json({ symbols: symbolList });

      case "market-data":
        const symbolsArray = symbols
          ? symbols.split(",")
          : await binanceClient.getSymbols();
        const marketData = await binanceClient.getMarketData(
          symbolsArray.slice(0, 20)
        ); // Limit to 20 for performance
        return NextResponse.json({ marketData });

      case "blueprints":
        const targetSymbols = symbols
          ? symbols.split(",")
          : await binanceClient.getSymbols();
        const data = await binanceClient.getMarketData(
          targetSymbols.slice(0, 20)
        );
        const blueprints = await detectBlueprints(data);
        return NextResponse.json({ blueprints });

      default:
        return NextResponse.json(
          { error: "Invalid action parameter" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Binance API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch data from Binance" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbols, action } = body;

    switch (action) {
      case "scan-blueprints":
        if (!symbols || !Array.isArray(symbols)) {
          return NextResponse.json(
            { error: "Symbols array is required" },
            { status: 400 }
          );
        }

        const marketData = await binanceClient.getMarketData(symbols);
        const blueprints = await detectBlueprints(marketData);

        return NextResponse.json({
          success: true,
          data: {
            scannedSymbols: symbols.length,
            blueprintsFound: blueprints.length,
            blueprints,
          },
        });

      default:
        return NextResponse.json(
          { error: "Invalid action parameter" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Binance API POST Error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
