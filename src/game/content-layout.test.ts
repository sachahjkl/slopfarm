import { describe, expect, it } from "vitest";
import {
  SAWMILL_BUILDING,
  SAWMILL_OUTPUT,
  SAWMILL_OUTPUT_FOOTPRINT,
  ZONES,
} from "./content";
import { FOREST_FENCES, PROGRESSION_GATES } from "./forest-map";
import type { Vector2 } from "./model";

const PALLET = {
  center: SAWMILL_OUTPUT,
  ...SAWMILL_OUTPUT_FOOTPRINT,
};

describe("implantation du dépôt de planches", () => {
  it("reste séparé de la scierie et de l’établi", () => {
    expect(
      rectanglesOverlap(PALLET, {
        center: SAWMILL_BUILDING,
        halfWidth: 1.15,
        halfDepth: 0.75,
      }),
    ).toBe(false);
    expect(
      rectanglesOverlap(PALLET, {
        center: ZONES.automation,
        halfWidth: 1.1,
        halfDepth: 0.5,
      }),
    ).toBe(false);
  });

  it("ne chevauche aucun mur, aucune porte ou aucun spot", () => {
    for (const segment of [...FOREST_FENCES, ...PROGRESSION_GATES]) {
      expect(
        rectanglesOverlap(PALLET, {
          center: {
            x: (segment.from.x + segment.to.x) / 2,
            z: (segment.from.z + segment.to.z) / 2,
          },
          halfWidth:
            Math.abs(segment.to.x - segment.from.x) / 2 + segment.width,
          halfDepth:
            Math.abs(segment.to.z - segment.from.z) / 2 + segment.width,
        }),
      ).toBe(false);
    }
    for (const spot of Object.values(ZONES))
      expect(rectangleCircleDistance(PALLET, spot)).toBeGreaterThan(1.05);
  });
});

interface Rectangle {
  center: Vector2;
  halfWidth: number;
  halfDepth: number;
}

function rectanglesOverlap(left: Rectangle, right: Rectangle): boolean {
  return (
    Math.abs(left.center.x - right.center.x) <
      left.halfWidth + right.halfWidth &&
    Math.abs(left.center.z - right.center.z) < left.halfDepth + right.halfDepth
  );
}

function rectangleCircleDistance(rectangle: Rectangle, point: Vector2): number {
  const dx = Math.max(
    Math.abs(point.x - rectangle.center.x) - rectangle.halfWidth,
    0,
  );
  const dz = Math.max(
    Math.abs(point.z - rectangle.center.z) - rectangle.halfDepth,
    0,
  );
  return Math.hypot(dx, dz);
}
