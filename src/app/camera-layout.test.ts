import { describe, expect, it } from "vitest";
import { CAMERA_OFFSET, screenToWorldDirection } from "./camera-layout";

describe("screenToWorldDirection", () => {
  it("oriente le haut de l’écran à l’opposé de la caméra", () => {
    const direction = screenToWorldDirection({ x: 0, z: -1 });
    expect(direction.x).toBeLessThan(0);
    expect(direction.z).toBeLessThan(0);
  });

  it("oriente la droite selon l’axe horizontal de la caméra", () => {
    const direction = screenToWorldDirection({ x: 1, z: 0 });
    expect(direction.x).toBeCloseTo(
      CAMERA_OFFSET.z / Math.hypot(CAMERA_OFFSET.x, CAMERA_OFFSET.z),
    );
    expect(direction.z).toBeLessThan(0);
  });
});
