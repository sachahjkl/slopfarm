import { describe, expect, it } from "vitest";
import { pausedProductionRoutes } from "./lane-pause";

describe("pausedProductionRoutes", () => {
  it("maps attacking bears to the affected production routes", () => {
    expect(
      pausedProductionRoutes([
        { phase: "attacking", route: 0 },
        { phase: "approaching", route: 1 },
        { phase: "attacking", route: 2 },
      ]),
    ).toEqual([true, false, true]);
  });
});
