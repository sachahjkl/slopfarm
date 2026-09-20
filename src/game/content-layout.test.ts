import { describe, expect, it } from "vitest";
import {
  MARKET_CONVEYOR_PATH,
  MARKET_TABLE,
  MONUMENT_BUILDING,
  MONUMENT_COLLIDER_RADIUS,
  MONUMENT_CONVEYOR_PATH,
  MONUMENT_PLANK_OUTPUT,
  SAWMILL_BUILDING,
  SAWMILL_OUTPUT,
  SAWMILL_OUTPUT_FOOTPRINT,
  WORKER_CONVEYOR_PATH,
  WORKER_DEPOT,
  ZONES,
} from "./content";
import { FOREST_FENCES, FOREST_YARDS, PROGRESSION_GATES } from "./forest-map";
import type { Vector2 } from "./model";

const PALLET = {
  center: SAWMILL_OUTPUT,
  ...SAWMILL_OUTPUT_FOOTPRINT,
};

describe("graphe des convoyeurs", () => {
  it("partage un tronc puis sépare le marché et la scierie", () => {
    expect(MARKET_CONVEYOR_PATH.slice(0, 3)).toEqual(
      WORKER_CONVEYOR_PATH.slice(0, 3),
    );
    expect(MARKET_CONVEYOR_PATH[0]).toEqual(WORKER_DEPOT);
    expect(MARKET_CONVEYOR_PATH.at(-1)).toEqual(MARKET_TABLE);
    expect(WORKER_CONVEYOR_PATH.at(-1)).toEqual(SAWMILL_BUILDING);
  });
});

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

describe("implantation du monument", () => {
  it("contient le monument entier dans sa cour", () => {
    const yard = FOREST_YARDS.find(({ unlockStep }) => unlockStep === 6)!;
    const minimumX = Math.min(...yard.points.map(({ x }) => x));
    const maximumX = Math.max(...yard.points.map(({ x }) => x));
    const minimumZ = Math.min(...yard.points.map(({ z }) => z));
    const maximumZ = Math.max(...yard.points.map(({ z }) => z));
    expect(MONUMENT_BUILDING.x - MONUMENT_COLLIDER_RADIUS).toBeGreaterThan(
      minimumX,
    );
    expect(MONUMENT_BUILDING.x + MONUMENT_COLLIDER_RADIUS).toBeLessThan(
      maximumX,
    );
    expect(MONUMENT_BUILDING.z - MONUMENT_COLLIDER_RADIUS).toBeGreaterThan(
      minimumZ,
    );
    expect(MONUMENT_BUILDING.z + MONUMENT_COLLIDER_RADIUS).toBeLessThan(
      maximumZ,
    );
  });

  it("garde le dépôt et la pile hors du collider", () => {
    for (const point of [ZONES.monument, MONUMENT_PLANK_OUTPUT])
      expect(distance(point, MONUMENT_BUILDING)).toBeGreaterThan(
        MONUMENT_COLLIDER_RADIUS + 0.25,
      );
  });

  it("termine le convoyeur devant le monument sans le traverser", () => {
    for (let index = 1; index < MONUMENT_CONVEYOR_PATH.length; index += 1)
      expect(
        pointSegmentDistance(
          MONUMENT_BUILDING,
          MONUMENT_CONVEYOR_PATH[index - 1]!,
          MONUMENT_CONVEYOR_PATH[index]!,
        ),
      ).toBeGreaterThan(MONUMENT_COLLIDER_RADIUS);
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

function distance(left: Vector2, right: Vector2): number {
  return Math.hypot(left.x - right.x, left.z - right.z);
}

function pointSegmentDistance(
  point: Vector2,
  from: Vector2,
  to: Vector2,
): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const lengthSquared = dx * dx + dz * dz;
  const amount = Math.max(
    0,
    Math.min(
      1,
      ((point.x - from.x) * dx + (point.z - from.z) * dz) / lengthSquared,
    ),
  );
  return Math.hypot(
    point.x - (from.x + dx * amount),
    point.z - (from.z + dz * amount),
  );
}
