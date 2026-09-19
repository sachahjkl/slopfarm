import { describe, expect, it } from "vitest";
import { SALE_OUTPUT } from "../game/content";
import { isSaleCoin, marketCoinPosition } from "./market-stock-layout";

describe("marketCoinPosition", () => {
  it("places the first coin on the sale bench coin tray", () => {
    const position = marketCoinPosition({ ...SALE_OUTPUT, y: 0.99 });

    expect(position.x).toBeCloseTo(-8.1);
    expect(position.y).toBeCloseTo(1.25);
    expect(position.z).toBeCloseTo(1.93);
  });

  it("uses a compact vertical stack without overlapping coins", () => {
    const first = marketCoinPosition({ ...SALE_OUTPUT, y: 0.99 });
    const second = marketCoinPosition({ ...SALE_OUTPUT, y: 1.105 });

    expect(second.y - first.y).toBeCloseTo(0.075);
    expect(second.y - first.y).toBeGreaterThan(0.0665);
  });

  it("does not classify other coin stocks as sale coins", () => {
    expect(isSaleCoin({ x: -3.8, z: 8.4 })).toBe(false);
  });
});
