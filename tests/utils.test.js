import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clamp, formatNumber, formatPct, getCandleWindowTiming } from "../src/utils.js";

describe("clamp", () => {
  it("returns value when within range", () => {
    assert.equal(clamp(5, 0, 10), 5);
  });

  it("clamps to min", () => {
    assert.equal(clamp(-3, 0, 10), 0);
  });

  it("clamps to max", () => {
    assert.equal(clamp(15, 0, 10), 10);
  });

  it("handles edge values equal to bounds", () => {
    assert.equal(clamp(0, 0, 10), 0);
    assert.equal(clamp(10, 0, 10), 10);
  });
});

describe("formatNumber", () => {
  it("formats integers with no decimals", () => {
    assert.equal(formatNumber(1234, 0), "1,234");
  });

  it("formats with decimal places", () => {
    assert.equal(formatNumber(1234.567, 2), "1,234.57");
  });

  it("returns dash for null", () => {
    assert.equal(formatNumber(null, 0), "-");
  });

  it("returns dash for undefined", () => {
    assert.equal(formatNumber(undefined, 0), "-");
  });

  it("returns dash for NaN", () => {
    assert.equal(formatNumber(NaN, 0), "-");
  });

  it("formats zero correctly", () => {
    assert.equal(formatNumber(0, 0), "0");
  });
});

describe("formatPct", () => {
  it("formats decimal as percentage", () => {
    assert.equal(formatPct(0.1234, 2), "12.34%");
  });

  it("formats 1.0 as 100%", () => {
    assert.equal(formatPct(1, 0), "100%");
  });

  it("returns dash for null", () => {
    assert.equal(formatPct(null), "-");
  });

  it("returns dash for NaN", () => {
    assert.equal(formatPct(NaN), "-");
  });

  it("handles negative values", () => {
    assert.equal(formatPct(-0.05, 1), "-5.0%");
  });
});

describe("getCandleWindowTiming", () => {
  it("returns valid timing object for 15-minute window", () => {
    const result = getCandleWindowTiming(15);
    assert.ok(typeof result.startMs === "number");
    assert.ok(typeof result.endMs === "number");
    assert.ok(typeof result.elapsedMs === "number");
    assert.ok(typeof result.remainingMs === "number");
    assert.ok(typeof result.elapsedMinutes === "number");
    assert.ok(typeof result.remainingMinutes === "number");
  });

  it("elapsed + remaining equals window duration", () => {
    const result = getCandleWindowTiming(15);
    const total = result.elapsedMs + result.remainingMs;
    assert.equal(total, 15 * 60_000);
  });

  it("remaining is between 0 and window", () => {
    const result = getCandleWindowTiming(15);
    assert.ok(result.remainingMinutes >= 0);
    assert.ok(result.remainingMinutes <= 15);
  });

  it("elapsed is between 0 and window", () => {
    const result = getCandleWindowTiming(15);
    assert.ok(result.elapsedMinutes >= 0);
    assert.ok(result.elapsedMinutes <= 15);
  });
});
