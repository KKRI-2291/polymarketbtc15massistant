import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeSessionVwap, computeVwapSeries } from "../src/indicators/vwap.js";
import { computeRsi, sma, slopeLast } from "../src/indicators/rsi.js";
import { computeMacd } from "../src/indicators/macd.js";
import { computeHeikenAshi, countConsecutive } from "../src/indicators/heikenAshi.js";

// --- VWAP ---

describe("computeSessionVwap", () => {
  it("returns null for empty array", () => {
    assert.equal(computeSessionVwap([]), null);
  });

  it("returns null for non-array", () => {
    assert.equal(computeSessionVwap(null), null);
  });

  it("computes VWAP for single candle", () => {
    const candles = [{ high: 100, low: 90, close: 95, volume: 10 }];
    const tp = (100 + 90 + 95) / 3;
    assert.equal(computeSessionVwap(candles), tp);
  });

  it("computes VWAP for multiple candles", () => {
    const candles = [
      { high: 100, low: 90, close: 95, volume: 10 },
      { high: 110, low: 100, close: 105, volume: 20 }
    ];
    const tp1 = (100 + 90 + 95) / 3;
    const tp2 = (110 + 100 + 105) / 3;
    const expected = (tp1 * 10 + tp2 * 20) / 30;
    assert.ok(Math.abs(computeSessionVwap(candles) - expected) < 0.0001);
  });

  it("returns null when total volume is zero", () => {
    const candles = [{ high: 100, low: 90, close: 95, volume: 0 }];
    assert.equal(computeSessionVwap(candles), null);
  });
});

describe("computeVwapSeries", () => {
  it("returns series with same length as candles", () => {
    const candles = [
      { high: 100, low: 90, close: 95, volume: 10 },
      { high: 110, low: 100, close: 105, volume: 20 },
      { high: 105, low: 95, close: 100, volume: 15 }
    ];
    const series = computeVwapSeries(candles);
    assert.equal(series.length, 3);
  });

  it("first element equals single-candle VWAP", () => {
    const candles = [
      { high: 100, low: 90, close: 95, volume: 10 },
      { high: 110, low: 100, close: 105, volume: 20 }
    ];
    const series = computeVwapSeries(candles);
    assert.equal(series[0], computeSessionVwap([candles[0]]));
  });
});

// --- RSI ---

describe("computeRsi", () => {
  it("returns null when not enough data", () => {
    assert.equal(computeRsi([1, 2, 3], 14), null);
  });

  it("returns 100 when all gains and no losses", () => {
    const closes = Array.from({ length: 16 }, (_, i) => 100 + i);
    assert.equal(computeRsi(closes, 14), 100);
  });

  it("returns 0 when all losses and no gains", () => {
    const closes = Array.from({ length: 16 }, (_, i) => 200 - i);
    assert.equal(computeRsi(closes, 14), 0);
  });

  it("returns value between 0 and 100 for mixed data", () => {
    const closes = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84,
      46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00];
    const rsi = computeRsi(closes, 14);
    assert.ok(rsi !== null);
    assert.ok(rsi >= 0 && rsi <= 100);
  });
});

describe("sma", () => {
  it("returns null when not enough data", () => {
    assert.equal(sma([1, 2], 3), null);
  });

  it("computes simple moving average", () => {
    assert.equal(sma([1, 2, 3, 4, 5], 3), 4); // (3+4+5)/3
  });

  it("uses last N values", () => {
    assert.equal(sma([10, 20, 30], 2), 25); // (20+30)/2
  });
});

describe("slopeLast", () => {
  it("returns null when not enough data", () => {
    assert.equal(slopeLast([1], 3), null);
  });

  it("computes positive slope", () => {
    assert.equal(slopeLast([1, 2, 3], 3), 1); // (3-1)/(3-1)
  });

  it("computes negative slope", () => {
    assert.equal(slopeLast([3, 2, 1], 3), -1);
  });

  it("returns zero for flat values", () => {
    assert.equal(slopeLast([5, 5, 5], 3), 0);
  });
});

// --- MACD ---

describe("computeMacd", () => {
  it("returns null when not enough data", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    assert.equal(computeMacd(closes, 12, 26, 9), null);
  });

  it("returns valid MACD object with enough data", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 5) * 10);
    const result = computeMacd(closes, 12, 26, 9);
    assert.ok(result !== null);
    assert.ok(typeof result.macd === "number");
    assert.ok(typeof result.signal === "number");
    assert.ok(typeof result.hist === "number");
  });

  it("hist equals macd minus signal", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 5) * 10);
    const result = computeMacd(closes, 12, 26, 9);
    assert.ok(Math.abs(result.hist - (result.macd - result.signal)) < 0.0001);
  });
});

// --- Heiken Ashi ---

describe("computeHeikenAshi", () => {
  it("returns empty array for empty input", () => {
    assert.deepEqual(computeHeikenAshi([]), []);
  });

  it("returns same length as input", () => {
    const candles = [
      { open: 100, high: 110, low: 90, close: 105 },
      { open: 105, high: 115, low: 95, close: 110 }
    ];
    assert.equal(computeHeikenAshi(candles).length, 2);
  });

  it("computes HA close as OHLC average", () => {
    const candles = [{ open: 100, high: 110, low: 90, close: 105 }];
    const ha = computeHeikenAshi(candles);
    const expected = (100 + 110 + 90 + 105) / 4;
    assert.ok(Math.abs(ha[0].close - expected) < 0.0001);
  });

  it("marks green candles correctly", () => {
    const candles = [
      { open: 90, high: 110, low: 85, close: 105 }
    ];
    const ha = computeHeikenAshi(candles);
    assert.equal(ha[0].isGreen, true);
  });

  it("marks red candles correctly", () => {
    const candles = [
      { open: 110, high: 112, low: 80, close: 85 }
    ];
    const ha = computeHeikenAshi(candles);
    // HA close = (110+112+80+85)/4 = 96.75, HA open = (110+85)/2 = 97.5
    // close < open -> red
    assert.equal(ha[0].isGreen, false);
  });
});

describe("countConsecutive", () => {
  it("returns null color and 0 count for empty array", () => {
    const result = countConsecutive([]);
    assert.equal(result.color, null);
    assert.equal(result.count, 0);
  });

  it("counts consecutive green candles", () => {
    const ha = [
      { isGreen: false },
      { isGreen: true },
      { isGreen: true },
      { isGreen: true }
    ];
    const result = countConsecutive(ha);
    assert.equal(result.color, "green");
    assert.equal(result.count, 3);
  });

  it("counts consecutive red candles", () => {
    const ha = [
      { isGreen: true },
      { isGreen: false },
      { isGreen: false }
    ];
    const result = countConsecutive(ha);
    assert.equal(result.color, "red");
    assert.equal(result.count, 2);
  });

  it("returns 1 when only last candle differs", () => {
    const ha = [
      { isGreen: true },
      { isGreen: true },
      { isGreen: false }
    ];
    const result = countConsecutive(ha);
    assert.equal(result.color, "red");
    assert.equal(result.count, 1);
  });
});
