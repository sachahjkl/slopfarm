import type { Vector2, WorkerState } from "../game/model";

export function isGateApproached(
  gate: Vector2,
  player: Vector2,
  workers: readonly Pick<WorkerState, "position">[],
  radius = 3.2,
): boolean {
  if (distance(gate, player) < radius) return true;
  return workers.some((worker) => distance(gate, worker.position) < radius);
}

function distance(left: Vector2, right: Vector2): number {
  return Math.hypot(right.x - left.x, right.z - left.z);
}
