import type { Vector2, ZoneKind } from "./model";
import { CAMPAIGN_STEPS } from "./campaign";

export const FOREST = {
  treeHealth: 3,
  treeRespawnSeconds: 25,
  logsPerTree: 5,
  playerSpeed: 5,
  trailSpeedBonus: 0.65,
  trailMomentumSeconds: 2.4,
  trailMomentumDecaySeconds: 1.8,
  pickupRadius: 2.8,
  depositInitialInterval: 0.22,
  depositAcceleration: 1.35,
  depositMinimumInterval: 0.025,
  salePrice: 2,
  sawmillSecondsPerPlank: 0.65,
  workerHarvestSeconds: 1.6,
  workerSpeed: 2.8,
  workerCapacity: 5,
  conveyorSpeed: 2.5,
  maxWorkers: 10,
  toolCosts: [0, 24, 55, 110, 200, 350],
  workerCosts: [15, 24, 36, 52, 72, 96, 124, 156, 192, 232],
  automationCosts: [0, 12, 30, 65],
  monumentCosts: [18, 35, 60],
  animalSpawnSeconds: 14,
  animalSpawnSecondsByTurret: [14, 11, 8, 6],
  maximumAnimalsByTurret: [2, 3, 4, 5],
  bearHealth: 8,
  bearHealthPerTurretLevel: 2,
  bearSpeed: 1.6,
  bearHitCooldownSeconds: 0.8,
  bearMeat: 3,
  meatPrice: 4,
  butcherPlankCosts: [0, 18, 40],
  butcherMeatRequirements: [0, 8, 24],
  butcherPriceBonuses: [0, 2, 4],
  butcherWorkerSpeedBonuses: [0, 0.12, 0.25],
  butcherWorkerCapacityBonuses: [0, 1, 2],
  turretCosts: [30, 70, 140],
  turretPlankCosts: [12, 28, 55],
  turretMeatRequirements: [6, 18, 36],
  turretRange: 14,
  turretRanges: [8, 10, 12],
  turretDamage: [1, 2, 3],
  turretSecondsPerShot: [1.1, 0.72, 0.45],
} as const;

export const ZONES: Record<ZoneKind, Vector2> = {
  camp: { x: 0, z: 2 },
  sale: { x: -5.7, z: 2.5 },
  tool: { x: -2, z: 2.7 },
  worker: { x: 5.5, z: 6.5 },
  automation: { x: 7.25, z: 0.55 },
  sawmill: { x: 5.2, z: 0.75 },
  monument: { x: 0, z: -5.8 },
  departure: { x: -0.35, z: 8.5 },
  butcher: { x: -5.2, z: 7.4 },
  turret: { x: -7, z: 6.4 },
};

export const WORKER_DEPOT: Vector2 = { x: 6.5, z: 7 };
export const MARKET_TABLE: Vector2 = { x: -8.1, z: 2.5 };
export const SALE_OUTPUT: Vector2 = { x: -7.65, z: 3 };
export const SAWMILL_BUILDING: Vector2 = { x: 6, z: -2.45 };
export const SAWMILL_OUTPUT: Vector2 = { x: 5.9, z: -1 };
export const SAWMILL_OUTPUT_FOOTPRINT = {
  halfWidth: 0.8,
  halfDepth: 0.6,
} as const;
export const MONUMENT_BUILDING: Vector2 = { x: 1.8, z: -5.8 };
export const BUTCHER_BUILDING: Vector2 = { x: -6.5, z: 8.1 };
export const BUTCHER_OUTPUT: Vector2 = { x: -3.8, z: 8.4 };
export const TURRET_BUILDING: Vector2 = { x: -7.2, z: 6.3 };
export const TURRET_BUILDINGS: readonly Vector2[] = [
  TURRET_BUILDING,
  { x: 7.2, z: 1.1 },
  { x: -0.4, z: 8.2 },
];

export const BEAR_PATHS: readonly (readonly Vector2[])[] = [
  [
    { x: -35, z: 0 },
    { x: -27, z: 1 },
    { x: -18, z: 4 },
    { x: -4.9, z: -1 },
  ],
  [
    { x: 30, z: -31 },
    { x: 23, z: -18 },
    { x: 15, z: -8 },
    { x: 8.9, z: -0.8 },
  ],
  [
    { x: -2, z: 32 },
    { x: 0, z: 22 },
    { x: -0.2, z: 15 },
    { x: -0.35, z: 10.4 },
  ],
];

export const WORKER_CONVEYOR_PATH: readonly Vector2[] = [
  WORKER_DEPOT,
  { x: 9.4, z: 6.5 },
  { x: 9.4, z: -0.8 },
  { x: 8, z: -0.8 },
  SAWMILL_BUILDING,
];

export const MONUMENT_CONVEYOR_PATH: readonly Vector2[] = [
  SAWMILL_BUILDING,
  { x: 2.1, z: -2.8 },
  { x: 2.1, z: -4.8 },
  MONUMENT_BUILDING,
];

export function pathLength(points: readonly Vector2[]): number {
  return points
    .slice(1)
    .reduce(
      (total, point, index) =>
        total +
        Math.hypot(point.x - points[index]!.x, point.z - points[index]!.z),
      0,
    );
}

export function pointAlongPath(
  points: readonly Vector2[],
  progress: number,
): Vector2 {
  const targetDistance =
    pathLength(points) * Math.max(0, Math.min(1, progress));
  let travelled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const segmentLength = Math.hypot(to.x - from.x, to.z - from.z);
    if (travelled + segmentLength < targetDistance) {
      travelled += segmentLength;
      continue;
    }
    const amount =
      segmentLength === 0 ? 0 : (targetDistance - travelled) / segmentLength;
    return {
      x: from.x + (to.x - from.x) * amount,
      z: from.z + (to.z - from.z) * amount,
    };
  }
  return { ...points.at(-1)! };
}

export function zonePosition(kind: ZoneKind, campaignStep: number): Vector2 {
  if (kind === "sale" && campaignStep === CAMPAIGN_STEPS.market)
    return { x: -2.5, z: 2 };
  if (kind === "sawmill" && campaignStep === CAMPAIGN_STEPS.sawmill)
    return { x: 2.4, z: -0.4 };
  if (kind === "worker" && campaignStep === CAMPAIGN_STEPS.worker)
    return { x: 2.2, z: 2.6 };
  return ZONES[kind];
}

export function toolCount(level: number): number {
  return Math.min(4, level + 1);
}

export function toolOrbitRadius(level: number): number {
  return 0.68 + level * 0.03;
}

export function toolDamage(level: number): number {
  return level >= 4 ? 2 : 1;
}
