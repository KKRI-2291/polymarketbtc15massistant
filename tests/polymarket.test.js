import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  flattenEventMarkets,
  pickLatestLiveMarket,
  filterBtcUpDown15mMarkets,
  summarizeOrderBook
} from "../src/data/polymarket.js";

describe("flattenEventMarkets", () => {
  it("returns empty array for empty events", () => {
    assert.deepEqual(flattenEventMarkets([]), []);
  });

  it("returns empty array for non-array", () => {
    assert.deepEqual(flattenEventMarkets(null), []);
  });

  it("flattens markets from multiple events", () => {
    const events = [
      { markets: [{ id: 1 }, { id: 2 }] },
      { markets: [{ id: 3 }] }
    ];
    const result = flattenEventMarkets(events);
    assert.equal(result.length, 3);
    assert.equal(result[0].id, 1);
    assert.equal(result[2].id, 3);
  });

  it("handles events without markets array", () => {
    const events = [{ markets: [{ id: 1 }] }, { noMarkets: true }];
    const result = flattenEventMarkets(events);
    assert.equal(result.length, 1);
  });
});

describe("pickLatestLiveMarket", () => {
  it("returns null for empty array", () => {
    assert.equal(pickLatestLiveMarket([]), null);
  });

  it("returns null for null input", () => {
    assert.equal(pickLatestLiveMarket(null), null);
  });

  it("picks live market that ends soonest", () => {
    const now = Date.now();
    const markets = [
      { id: "a", endDate: new Date(now + 600_000).toISOString(), eventStartTime: new Date(now - 300_000).toISOString() },
      { id: "b", endDate: new Date(now + 300_000).toISOString(), eventStartTime: new Date(now - 600_000).toISOString() }
    ];
    const result = pickLatestLiveMarket(markets, now);
    assert.equal(result.id, "b"); // ends sooner
  });

  it("skips markets that haven't started yet", () => {
    const now = Date.now();
    const markets = [
      { id: "future", endDate: new Date(now + 600_000).toISOString(), eventStartTime: new Date(now + 300_000).toISOString() },
      { id: "live", endDate: new Date(now + 900_000).toISOString(), eventStartTime: new Date(now - 300_000).toISOString() }
    ];
    const result = pickLatestLiveMarket(markets, now);
    assert.equal(result.id, "live");
  });

  it("falls back to upcoming if no live markets", () => {
    const now = Date.now();
    const markets = [
      { id: "upcoming", endDate: new Date(now + 1_800_000).toISOString(), eventStartTime: new Date(now + 600_000).toISOString() }
    ];
    const result = pickLatestLiveMarket(markets, now);
    assert.equal(result.id, "upcoming");
  });

  it("skips markets with past endDate", () => {
    const now = Date.now();
    const markets = [
      { id: "expired", endDate: new Date(now - 60_000).toISOString() }
    ];
    const result = pickLatestLiveMarket(markets, now);
    assert.equal(result, null);
  });
});

describe("filterBtcUpDown15mMarkets", () => {
  it("filters by slug prefix", () => {
    const markets = [
      { slug: "btc-up-or-down-15m-abc" },
      { slug: "eth-up-or-down-15m-xyz" }
    ];
    const result = filterBtcUpDown15mMarkets(markets, { slugPrefix: "btc-up-or-down-15m" });
    assert.equal(result.length, 1);
    assert.equal(result[0].slug, "btc-up-or-down-15m-abc");
  });

  it("filters by series slug", () => {
    const markets = [
      { slug: "m1", seriesSlug: "btc-up-or-down-15m" },
      { slug: "m2", seriesSlug: "eth-up-or-down-15m" }
    ];
    const result = filterBtcUpDown15mMarkets(markets, { seriesSlug: "btc-up-or-down-15m" });
    assert.equal(result.length, 1);
  });

  it("returns empty for no matches", () => {
    const markets = [{ slug: "other-market" }];
    const result = filterBtcUpDown15mMarkets(markets, { slugPrefix: "btc-up" });
    assert.equal(result.length, 0);
  });
});

describe("summarizeOrderBook", () => {
  it("handles empty book", () => {
    const result = summarizeOrderBook({});
    assert.equal(result.bestBid, null);
    assert.equal(result.bestAsk, null);
    assert.equal(result.spread, null);
  });

  it("computes best bid as highest bid price", () => {
    const book = {
      bids: [{ price: "0.50", size: "100" }, { price: "0.55", size: "50" }],
      asks: [{ price: "0.60", size: "100" }]
    };
    const result = summarizeOrderBook(book);
    assert.equal(result.bestBid, 0.55);
    assert.equal(result.bestAsk, 0.60);
  });

  it("computes spread correctly", () => {
    const book = {
      bids: [{ price: "0.50", size: "100" }],
      asks: [{ price: "0.60", size: "100" }]
    };
    const result = summarizeOrderBook(book);
    assert.ok(Math.abs(result.spread - 0.10) < 0.0001);
  });

  it("computes liquidity for top N levels", () => {
    const book = {
      bids: [{ price: "0.50", size: "100" }, { price: "0.49", size: "200" }],
      asks: [{ price: "0.60", size: "150" }]
    };
    const result = summarizeOrderBook(book, 5);
    assert.equal(result.bidLiquidity, 300);
    assert.equal(result.askLiquidity, 150);
  });
});
