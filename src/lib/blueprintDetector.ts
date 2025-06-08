export interface BlueprintResult {
  symbol: string;
  blueprintType: string;
  confidence: "High" | "Medium" | "Low";
  price: number;
  change24h: number;
  volume: number;
  details: string;
}

export interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume: number;
  high24h: number;
  low24h: number;
  open: number;
  close: number;
}

export async function detectBlueprints(
  marketData: MarketData[]
): Promise<BlueprintResult[]> {
  const results: BlueprintResult[] = [];

  for (const data of marketData) {
    const blueprints = analyzeSymbol(data);
    results.push(...blueprints);
  }

  return results;
}

function analyzeSymbol(data: MarketData): BlueprintResult[] {
  const results: BlueprintResult[] = [];

  // Calculate basic metrics
  const range = data.high24h - data.low24h;
  const bodySize = Math.abs(data.close - data.open);
  const upperWick = data.high24h - Math.max(data.open, data.close);
  const lowerWick = Math.min(data.open, data.close) - data.low24h;
  const changePercent = Math.abs(data.change24h);

  // Rejection Day Detection
  if (detectRejectionDay(data, range, upperWick, lowerWick)) {
    const confidence = getConfidenceLevel(changePercent, data.volume);
    results.push({
      symbol: data.symbol,
      blueprintType:
        data.change24h > 0 ? "Long Rejection Day" : "Short Rejection Day",
      confidence,
      price: data.price,
      change24h: data.change24h,
      volume: data.volume,
      details: `${data.change24h > 0 ? "Bullish" : "Bearish"} rejection with ${(
        ((upperWick + lowerWick) / range) *
        100
      ).toFixed(1)}% wick ratio`,
    });
  }

  // Failed New High/Low Detection
  if (detectFailedNewHigh(data, changePercent)) {
    const confidence = getConfidenceLevel(changePercent, data.volume);
    results.push({
      symbol: data.symbol,
      blueprintType: "Failed New High",
      confidence,
      price: data.price,
      change24h: data.change24h,
      volume: data.volume,
      details: `Failed to sustain new highs, showing weakness with ${changePercent.toFixed(
        2
      )}% reversal`,
    });
  }

  if (detectFailedNewLow(data, changePercent)) {
    const confidence = getConfidenceLevel(changePercent, data.volume);
    results.push({
      symbol: data.symbol,
      blueprintType: "Failed New Low",
      confidence,
      price: data.price,
      change24h: data.change24h,
      volume: data.volume,
      details: `Failed to sustain new lows, showing strength with ${changePercent.toFixed(
        2
      )}% recovery`,
    });
  }

  // Outside Day Detection
  if (detectOutsideDay(data, range, changePercent)) {
    const confidence = getConfidenceLevel(changePercent, data.volume);
    results.push({
      symbol: data.symbol,
      blueprintType:
        data.change24h > 0 ? "Bullish Outside Day" : "Bearish Outside Day",
      confidence,
      price: data.price,
      change24h: data.change24h,
      volume: data.volume,
      details: `High volatility outside day with ${changePercent.toFixed(
        2
      )}% move`,
    });
  }

  // Absorption Day Detection
  if (detectAbsorptionDay(data, bodySize, range, data.volume)) {
    const confidence = getConfidenceLevel(changePercent, data.volume);
    results.push({
      symbol: data.symbol,
      blueprintType:
        data.change24h > 0
          ? "Bullish Absorption Day"
          : "Bearish Absorption Day",
      confidence,
      price: data.price,
      change24h: data.change24h,
      volume: data.volume,
      details: `High volume absorption with ${(
        (bodySize / range) *
        100
      ).toFixed(1)}% body ratio`,
    });
  }

  // Stop Run Day Detection
  if (detectStopRunDay(data, upperWick, lowerWick, range)) {
    const confidence = getConfidenceLevel(changePercent, data.volume);
    results.push({
      symbol: data.symbol,
      blueprintType:
        upperWick > lowerWick ? "Stop Run Day High" : "Stop Run Day Low",
      confidence,
      price: data.price,
      change24h: data.change24h,
      volume: data.volume,
      details: `Stop run detected with ${(
        (Math.max(upperWick, lowerWick) / range) *
        100
      ).toFixed(1)}% wick`,
    });
  }

  return results;
}

function detectRejectionDay(
  data: MarketData,
  range: number,
  upperWick: number,
  lowerWick: number
): boolean {
  const totalWick = upperWick + lowerWick;
  const wickRatio = totalWick / range;
  return wickRatio > 0.6 && Math.abs(data.change24h) > 2;
}

function detectFailedNewHigh(data: MarketData, changePercent: number): boolean {
  return data.change24h < -3 && data.close < data.open && changePercent > 5;
}

function detectFailedNewLow(data: MarketData, changePercent: number): boolean {
  return data.change24h > 3 && data.close > data.open && changePercent > 5;
}

function detectOutsideDay(
  data: MarketData,
  range: number,
  changePercent: number
): boolean {
  return changePercent > 8 && range / data.price > 0.05;
}

function detectAbsorptionDay(
  data: MarketData,
  bodySize: number,
  range: number,
  volume: number
): boolean {
  const bodyRatio = bodySize / range;
  const hasHighVolume = volume > 1000000; // Volume threshold for absorption
  return bodyRatio > 0.7 && Math.abs(data.change24h) > 3 && hasHighVolume;
}

function detectStopRunDay(
  data: MarketData,
  upperWick: number,
  lowerWick: number,
  range: number
): boolean {
  const maxWick = Math.max(upperWick, lowerWick);
  const wickRatio = maxWick / range;
  return wickRatio > 0.4 && Math.abs(data.change24h) < 2;
}

function getConfidenceLevel(
  changePercent: number,
  volume: number
): "High" | "Medium" | "Low" {
  if (changePercent > 10 && volume > 1000000) return "High";
  if (changePercent > 5 && volume > 500000) return "Medium";
  return "Low";
}
