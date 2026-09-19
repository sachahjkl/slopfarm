import { describe, expect, it } from "vitest";
import { renderPixelRatio } from "./render-quality";

describe("renderPixelRatio", () => {
  it("conserve un pixel par pixel CSS en qualité basse", () => {
    expect(renderPixelRatio("low", 3, 390, 844)).toBe(1);
  });

  it("utilise deux pixels sur un mobile dense en qualité haute", () => {
    expect(renderPixelRatio("high", 3, 390, 844)).toBe(2);
  });

  it("limite le nombre de pixels des grands écrans", () => {
    const ratio = renderPixelRatio("high", 2, 1440, 900);
    expect(ratio).toBeCloseTo(Math.sqrt(2_000_000 / (1440 * 900)));
    expect(ratio).toBeGreaterThan(1.15);
  });
});
