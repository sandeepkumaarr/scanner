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
  // Add historical data for ADR calculation
  historicalRanges?: number[]; // Array of daily ranges from last 20 days
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

  // Calculate ADR (Average Daily Range)
  const adr = calculateADR(data.historicalRanges, range);

  // Rejection Day Detection with proper blueprint measurements
  if (detectRejectionDay(data, range, upperWick, lowerWick, bodySize, adr)) {
    const confidence = getConfidenceLevel(changePercent, data.volume);
    const mid = (data.high24h + data.low24h) / 2;
    const isBullish = data.change24h > 0;
    const relevantTail = isBullish ? lowerWick : upperWick;
    const tailToBodyRatio = bodySize > 0 ? relevantTail / bodySize : 0;

    results.push({
      symbol: data.symbol,
      blueprintType: isBullish ? "Long Rejection Day" : "Short Rejection Day",
      confidence,
      price: data.price,
      change24h: data.change24h,
      volume: data.volume,
      details: `${isBullish ? "Bullish" : "Bearish"} rejection - Range: ${(
        (range / adr) *
        100
      ).toFixed(0)}% ADR, Tail/Body: ${tailToBodyRatio.toFixed(
        1
      )}x, MID: ${mid.toFixed(2)}`,
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

// Calculate Average Daily Range from historical data
function calculateADR(
  historicalRanges?: number[],
  currentRange?: number
): number {
  if (!historicalRanges || historicalRanges.length === 0) {
    // Fallback: estimate ADR as 80% of current range if no historical data
    return currentRange ? currentRange * 0.8 : 1;
  }

  // Calculate average of last 20 days (or available data)
  const sum = historicalRanges.reduce((acc, range) => acc + range, 0);
  return sum / historicalRanges.length;
}

function detectRejectionDay(
  data: MarketData,
  range: number,
  upperWick: number,
  lowerWick: number,
  bodySize: number,
  adr: number
): boolean {
  // 1. Check if range > 125% ADR
  const rangeVsADR = range / adr;
  if (rangeVsADR <= 1.25) return false;

  // 2. Determine if bullish or bearish rejection
  const isBullish = data.close > data.open;

  // 3. Check tail > 2.5x body size
  const relevantTail = isBullish ? lowerWick : upperWick;
  const tailToBodyRatio = bodySize > 0 ? relevantTail / bodySize : 0;
  if (tailToBodyRatio <= 2.5) return false;

  // 4. Check close position in range
  const closePositionInRange = (data.close - data.low24h) / range;

  // Bullish: close in upper 35% (above 65% of range)
  if (isBullish && closePositionInRange < 0.65) return false;

  // Bearish: close in lower 35% (below 35% of range)
  if (!isBullish && closePositionInRange > 0.35) return false;

  // 5. Minimum change threshold
  return Math.abs(data.change24h) > 2;
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
