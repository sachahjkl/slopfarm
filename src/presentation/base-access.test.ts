import { describe, expect, it } from "vitest";
import { ZONES } from "../game/content";
import { FOREST_COLLIDERS, type MapCollider } from "../game/forest-map";
import { findPath } from "../game/navigation";
import type { Vector2 } from "../game/model";

const PLAYER_RADIUS = 0.5;

describe("accès aux ailes de la base", () => {
  it.each([
    ["ouvriers", ZONES.worker, 5],
    ["boucherie", ZONES.butcher, 8],
  ] as const)("garde la zone %s hors des colliders", (_name, zone, step) => {
    expect(canOccupy(zone, step)).toBe(true);
  });

  it.each([
    ["ouvriers", ZONES.worker, 5],
    ["boucherie", ZONES.butcher, 8],
  ] as const)("conserve un trajet vers l’aile %s", (_name, zone, step) => {
    expect(
      findPath({ x: 0, z: 0 }, zone, {
        step: 0.25,
        goalRadius: 0.7,
        canOccupy: (point) => canOccupy(point, step),
      }),
    ).toBeDefined();
  });
});

function canOccupy(position: Vector2, step: number): boolean {
  return !FOREST_COLLIDERS.some(
    (collider) =>
      step >= (collider.minimumStep ?? 0) &&
      step <= (collider.maximumStep ?? Number.POSITIVE_INFINITY) &&
      intersects(position, collider),
  );
}

function intersects(position: Vector2, collider: MapCollider): boolean {
  if (collider.shape === "circle")
    return (
      Math.hypot(
        position.x - collider.center.x,
        position.z - collider.center.z,
      ) <
      PLAYER_RADIUS + collider.radius
    );
  const closestX = Math.max(
    collider.center.x - collider.halfWidth,
    Math.min(collider.center.x + collider.halfWidth, position.x),
  );
  const closestZ = Math.max(
    collider.center.z - collider.halfDepth,
    Math.min(collider.center.z + collider.halfDepth, position.z),
  );
  return (
    Math.hypot(position.x - closestX, position.z - closestZ) < PLAYER_RADIUS
  );
}
