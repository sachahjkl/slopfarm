import type { Vector2 } from "../game/model";

export const CAMERA_OFFSET = { x: 3.2, y: 20, z: 14 } as const;

export function screenToWorldDirection(screen: Vector2): Vector2 {
  const horizontalLength = Math.hypot(CAMERA_OFFSET.x, CAMERA_OFFSET.z);
  const right = {
    x: CAMERA_OFFSET.z / horizontalLength,
    z: -CAMERA_OFFSET.x / horizontalLength,
  };
  const down = {
    x: CAMERA_OFFSET.x / horizontalLength,
    z: CAMERA_OFFSET.z / horizontalLength,
  };
  return {
    x: right.x * screen.x + down.x * screen.z,
    z: right.z * screen.x + down.z * screen.z,
  };
}
