import { describe, expect, it } from "vitest";
import { harvestWood, initialEconomy, sellWood } from "./economy";

describe("economy", () => {
  it("multiplie la récolte par le niveau de la hache", () => {
    expect(harvestWood({ ...initialEconomy(), axeLevel: 3 }, 2).wood).toBe(6);
  });

  it("vend tout le bois", () => {
    expect(sellWood({ ...initialEconomy(), wood: 5 })).toEqual({
      coins: 10,
      wood: 0,
      axeLevel: 1,
    });
  });
});
