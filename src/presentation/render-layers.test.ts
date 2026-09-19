import { describe, expect, it } from "vitest";
import { RENDER_LAYER } from "./render-layers";

describe("RENDER_LAYER", () => {
  it("renders service zones above the world and resources but below the player", () => {
    expect(RENDER_LAYER.serviceZone).toBeGreaterThan(RENDER_LAYER.world);
    expect(RENDER_LAYER.serviceZone).toBeGreaterThan(RENDER_LAYER.resource);
    expect(RENDER_LAYER.serviceZone).toBeLessThan(RENDER_LAYER.player);
  });
});
