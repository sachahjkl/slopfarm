import { describe, expect, it } from "vitest";
import { clampOverlayPosition } from "./service-overlay";

describe("clampOverlayPosition", () => {
  it("keeps a service bubble inside a desktop viewport", () => {
    expect(
      clampOverlayPosition(
        { x: 2, y: 4 },
        { width: 240, height: 80 },
        { width: 1280, height: 720 },
      ),
    ).toEqual({ x: 132, y: 92 });
  });

  it("keeps a service bubble inside a narrow mobile viewport", () => {
    expect(
      clampOverlayPosition(
        { x: 370, y: 790 },
        { width: 220, height: 76 },
        { width: 390, height: 844 },
      ),
    ).toEqual({ x: 268, y: 790 });
  });
});
