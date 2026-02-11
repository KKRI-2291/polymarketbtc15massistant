import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectRegime } from "../src/engines/regime.js";
import { scoreDirection, applyTimeAwareness } from "../src/engines/probability.js";
import { computeEdge, decide } from "../src/engines/edge.js";

// --- Regime Detection ---

describe("detectRegime", () => {
  it("returns CHOP for missing inputs", () => {
    const result = detectRegime({ price: null, vwap: null, vwapSlope: null, vwapCrossCount: null, volumeRecent: null, volumeAvg: null });
    assert.equal(result.regime, "CHOP");
  });

  it("detects TREND_UP when price above VWAP with positive slope", () => {
    const result = detectRegime({ price: 100, vwap: 95, vwapSlope: 0.5, vwapCrossCount: 1, volumeRecent: 100, volumeAvg: 100 });
    assert.equal(result.regime, "TREND_UP");
  });

  it("detects TREND_DOWN when price below VWAP with negative slope", () => {
    const result = detectRegime({ price: 90, vwap: 95, vwapSlope: -0.5, vwapCrossCount: 1, volumeRecent: 100, volumeAvg: 100 });
    assert.equal(result.regime, "TREND_DOWN");
  });

  it("detects RANGE with frequent VWAP crosses", () => {
    const result = detectRegime({ price: 100, vwap: 95, vwapSlope: -0.1, vwapCrossCount: 5, volumeRecent: 100, volumeAvg: 100 });
    assert.equal(result.regime, "RANGE");
  });

  it("detects CHOP with low volume and flat price", () => {
    const result = detectRegime({ price: 100, vwap: 100.05, vwapSlope: 0.01, vwapCrossCount: 0, volumeRecent: 50, volumeAvg: 100 });
    assert.equal(result.regime, "CHOP");
  });
});

// --- Probability Scoring ---

describe("scoreDirection", () => {
  it("returns scores with base 1 each for neutral inputs", () => {
    const result = scoreDirection({
      price: null, vwap: null, vwapSlope: null,
      rsi: null, rsiSlope: null, macd: null,
      heikenColor: null, heikenCount: 0, failedVwapReclaim: false
    });
    assert.equal(result.upScore, 1);
    assert.equal(result.downScore, 1);
    assert.equal(result.rawUp, 0.5);
  });

  it("favors UP when price above VWAP with positive slope", () => {
    const result = scoreDirection({
      price: 100, vwap: 95, vwapSlope: 0.5,
      rsi: null, rsiSlope: null, macd: null,
      heikenColor: null, heikenCount: 0, failedVwapReclaim: false
    });
    assert.ok(result.rawUp > 0.5);
    assert.ok(result.upScore > result.downScore);
  });

  it("favors DOWN when price below VWAP with negative slope", () => {
    const result = scoreDirection({
      price: 90, vwap: 95, vwapSlope: -0.5,
      rsi: null, rsiSlope: null, macd: null,
      heikenColor: null, heikenCount: 0, failedVwapReclaim: false
    });
    assert.ok(result.rawUp < 0.5);
    assert.ok(result.downScore > result.upScore);
  });

  it("adds RSI bullish score when RSI > 55 with positive slope", () => {
    const base = scoreDirection({
      price: null, vwap: null, vwapSlope: null,
      rsi: null, rsiSlope: null, macd: null,
      heikenColor: null, heikenCount: 0, failedVwapReclaim: false
    });
    const withRsi = scoreDirection({
      price: null, vwap: null, vwapSlope: null,
      rsi: 60, rsiSlope: 0.5, macd: null,
      heikenColor: null, heikenCount: 0, failedVwapReclaim: false
    });
    assert.ok(withRsi.upScore > base.upScore);
  });

  it("penalizes down on failed VWAP reclaim", () => {
    const without = scoreDirection({
      price: null, vwap: null, vwapSlope: null,
      rsi: null, rsiSlope: null, macd: null,
      heikenColor: null, heikenCount: 0, failedVwapReclaim: false
    });
    const with_ = scoreDirection({
      price: null, vwap: null, vwapSlope: null,
      rsi: null, rsiSlope: null, macd: null,
      heikenColor: null, heikenCount: 0, failedVwapReclaim: true
    });
    assert.ok(with_.downScore > without.downScore);
    assert.equal(with_.downScore - without.downScore, 3);
  });

  it("adds Heiken Ashi score for consecutive green candles", () => {
    const result = scoreDirection({
      price: null, vwap: null, vwapSlope: null,
      rsi: null, rsiSlope: null, macd: null,
      heikenColor: "green", heikenCount: 3, failedVwapReclaim: false
    });
    assert.equal(result.upScore, 2); // base 1 + 1 heiken
  });
});

// --- Time Awareness ---

describe("applyTimeAwareness", () => {
  it("returns 0.5 when no time left", () => {
    const result = applyTimeAwareness(0.7, 0, 15);
    assert.equal(result.adjustedUp, 0.5);
    assert.equal(result.adjustedDown, 0.5);
  });

  it("preserves raw probability at full window", () => {
    const result = applyTimeAwareness(0.7, 15, 15);
    assert.ok(Math.abs(result.adjustedUp - 0.7) < 0.0001);
    assert.ok(Math.abs(result.adjustedDown - 0.3) < 0.0001);
  });

  it("decays probability at half window", () => {
    const result = applyTimeAwareness(0.8, 7.5, 15);
    assert.ok(result.adjustedUp > 0.5);
    assert.ok(result.adjustedUp < 0.8);
  });

  it("adjustedUp + adjustedDown equals 1", () => {
    const result = applyTimeAwareness(0.65, 10, 15);
    assert.ok(Math.abs(result.adjustedUp + result.adjustedDown - 1) < 0.0001);
  });
});

// --- Edge Computation ---

describe("computeEdge", () => {
  it("returns nulls when market data missing", () => {
    const result = computeEdge({ modelUp: 0.6, modelDown: 0.4, marketYes: null, marketNo: null });
    assert.equal(result.edgeUp, null);
    assert.equal(result.edgeDown, null);
  });

  it("computes edge as model minus market probability", () => {
    const result = computeEdge({ modelUp: 0.7, modelDown: 0.3, marketYes: 0.5, marketNo: 0.5 });
    assert.ok(Math.abs(result.edgeUp - 0.2) < 0.0001);
    assert.ok(Math.abs(result.edgeDown - (-0.2)) < 0.0001);
  });

  it("normalizes market prices to probabilities", () => {
    const result = computeEdge({ modelUp: 0.6, modelDown: 0.4, marketYes: 60, marketNo: 40 });
    assert.ok(Math.abs(result.marketUp - 0.6) < 0.0001);
    assert.ok(Math.abs(result.marketDown - 0.4) < 0.0001);
  });
});

// --- Trade Decisions ---

describe("decide", () => {
  it("returns NO_TRADE when edge data is missing", () => {
    const result = decide({ remainingMinutes: 12, edgeUp: null, edgeDown: null });
    assert.equal(result.action, "NO_TRADE");
    assert.equal(result.reason, "missing_market_data");
  });

  it("returns NO_TRADE when edge below EARLY threshold (5%)", () => {
    const result = decide({ remainingMinutes: 12, edgeUp: 0.03, edgeDown: 0.01, modelUp: 0.6, modelDown: 0.4 });
    assert.equal(result.action, "NO_TRADE");
    assert.equal(result.phase, "EARLY");
  });

  it("returns ENTER for strong edge in EARLY phase", () => {
    const result = decide({ remainingMinutes: 12, edgeUp: 0.25, edgeDown: -0.05, modelUp: 0.7, modelDown: 0.3 });
    assert.equal(result.action, "ENTER");
    assert.equal(result.side, "UP");
    assert.equal(result.phase, "EARLY");
    assert.equal(result.strength, "STRONG");
  });

  it("detects MID phase between 5-10 minutes", () => {
    const result = decide({ remainingMinutes: 7, edgeUp: 0.15, edgeDown: -0.05, modelUp: 0.65, modelDown: 0.35 });
    assert.equal(result.phase, "MID");
    assert.equal(result.action, "ENTER");
  });

  it("requires higher threshold in LATE phase", () => {
    const result = decide({ remainingMinutes: 3, edgeUp: 0.15, edgeDown: -0.05, modelUp: 0.7, modelDown: 0.3 });
    assert.equal(result.phase, "LATE");
    assert.equal(result.action, "NO_TRADE"); // 15% < 20% threshold
  });

  it("enters in LATE phase with sufficient edge", () => {
    const result = decide({ remainingMinutes: 3, edgeUp: 0.25, edgeDown: -0.05, modelUp: 0.75, modelDown: 0.25 });
    assert.equal(result.phase, "LATE");
    assert.equal(result.action, "ENTER");
    assert.equal(result.side, "UP");
  });

  it("rejects when probability below minimum", () => {
    const result = decide({ remainingMinutes: 12, edgeUp: 0.1, edgeDown: -0.05, modelUp: 0.52, modelDown: 0.48 });
    assert.equal(result.action, "NO_TRADE");
    assert.ok(result.reason.includes("prob_below"));
  });

  it("picks DOWN when down edge is higher", () => {
    const result = decide({ remainingMinutes: 12, edgeUp: -0.1, edgeDown: 0.2, modelUp: 0.3, modelDown: 0.7 });
    assert.equal(result.action, "ENTER");
    assert.equal(result.side, "DOWN");
  });
});
