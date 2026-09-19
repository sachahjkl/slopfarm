import { describe, expect, it } from "vitest";
import { isGateApproached } from "./gate-activity";

describe("isGateApproached", () => {
  it("ouvre une porte pour le joueur", () => {
    expect(isGateApproached({ x: 0, z: 0 }, { x: 2, z: 0 }, [])).toBe(true);
  });

  it("ouvre une porte pour un travailleur", () => {
    expect(
      isGateApproached({ x: 0, z: 0 }, { x: 8, z: 0 }, [
        { position: { x: 0, z: 2 } },
      ]),
    ).toBe(true);
  });

  it("ferme une porte sans acteur proche", () => {
    expect(
      isGateApproached({ x: 0, z: 0 }, { x: 8, z: 0 }, [
        { position: { x: 8, z: 2 } },
      ]),
    ).toBe(false);
  });
});
