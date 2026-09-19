import { MARKET_TABLE, SALE_OUTPUT } from "../game/content";
import type { Vector2 } from "../game/model";

const COIN_TRAY = {
  x: MARKET_TABLE.x,
  y: 1.25,
  z: MARKET_TABLE.z - 0.57,
} as const;
const SIMULATION_STACK_BASE_Y = 0.99;
const SIMULATION_STACK_STEP = 0.115;
const VISUAL_STACK_STEP = 0.075;

export function isSaleCoin(position: Vector2): boolean {
  return (
    Math.hypot(position.x - SALE_OUTPUT.x, position.z - SALE_OUTPUT.z) < 0.2
  );
}

export function marketCoinPosition(position: Vector2 & { y: number }): {
  x: number;
  y: number;
  z: number;
} {
  const stackIndex = Math.max(
    0,
    Math.round((position.y - SIMULATION_STACK_BASE_Y) / SIMULATION_STACK_STEP),
  );
  return {
    x: COIN_TRAY.x + position.x - SALE_OUTPUT.x,
    y: COIN_TRAY.y + stackIndex * VISUAL_STACK_STEP,
    z: COIN_TRAY.z + position.z - SALE_OUTPUT.z,
  };
}
