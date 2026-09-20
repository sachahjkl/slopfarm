import type { PickupKind, Vector2 } from "./model";

export interface StackItemOffset {
  x: number;
  z: number;
  rotation: number;
}

export function stackItemOffset(index: number): StackItemOffset {
  return {
    x: Math.sin(index * 12.9898) * 0.035,
    z: Math.sin(index * 78.233 + 1.7) * 0.035,
    rotation: Math.sin(index * 37.719 + 0.4) * 0.055,
  };
}

export function stackedResourcePosition(
  kind: PickupKind,
  origin: Vector2,
  index: number,
): Vector2 & { y: number } {
  const offset = stackItemOffset(index);
  return {
    x: origin.x + offset.x,
    y: kind === "coin" ? 0.99 + index * 0.115 : 0.22 + index * 0.38,
    z: origin.z + offset.z,
  };
}
