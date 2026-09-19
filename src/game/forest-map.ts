import type { Vector2 } from "./model";
import {
  BUTCHER_BUILDING,
  MARKET_TABLE,
  MONUMENT_BUILDING,
  SAWMILL_BUILDING,
  TURRET_BUILDING,
} from "./content";

export interface MapArea {
  points: readonly Vector2[];
  color: number;
}

export interface MapSegment {
  from: Vector2;
  to: Vector2;
  width: number;
  minimumStep?: number;
  maximumStep?: number;
}

export interface MapPath {
  points: readonly Vector2[];
  width: number;
  unlockStep: number;
  surface?: "dirt" | "market";
}

export interface ProgressionGate extends MapSegment {
  unlockStep: number;
}

export interface TrailBarrier extends MapSegment {
  minimumStep: number;
}

export interface MapYard extends MapArea {
  unlockStep: number;
}

export const PLAYABLE_BOUNDARY: readonly Vector2[] = [
  { x: -25, z: -35 },
  { x: -10, z: -34 },
  { x: 1, z: -32 },
  { x: 14, z: -35 },
  { x: 28, z: -30 },
  { x: 34, z: -20 },
  { x: 32, z: -8 },
  { x: 36, z: 6 },
  { x: 35, z: 19 },
  { x: 25, z: 31 },
  { x: 11, z: 34 },
  { x: -2, z: 32 },
  { x: -16, z: 35 },
  { x: -29, z: 29 },
  { x: -34, z: 18 },
  { x: -35, z: 8 },
  { x: -36, z: -7 },
  { x: -32, z: -22 },
];

export const FOREST_BOUNDARY: readonly Vector2[] = PLAYABLE_BOUNDARY.map(
  ({ x, z }) => ({ x: x * 1.45, z: z * 1.45 }),
);

export const FOREST_RIDGE_POSITIONS: readonly Vector2[] = sampleBoundary(
  PLAYABLE_BOUNDARY,
  1.35,
);

function sampleBoundary(
  points: readonly Vector2[],
  spacing: number,
): Vector2[] {
  const samples: Vector2[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const from = points[index]!;
    const to = points[(index + 1) % points.length]!;
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    const count = Math.max(1, Math.ceil(length / spacing));
    for (let sample = 0; sample < count; sample += 1) {
      const amount = sample / count;
      samples.push({
        x: from.x + (to.x - from.x) * amount,
        z: from.z + (to.z - from.z) * amount,
      });
    }
  }
  return samples;
}

export interface MapDecoration {
  kind: "bush" | "flowers" | "rock";
  position: Vector2;
  rotation: number;
  scale: number;
}

export type MapCollider = (
  | { shape: "circle"; center: Vector2; radius: number }
  | {
      shape: "rectangle";
      center: Vector2;
      halfWidth: number;
      halfDepth: number;
    }
) & { minimumStep?: number; maximumStep?: number };

export const FOREST_TREE_POSITIONS: readonly Vector2[] =
  createForestTreePositions();

function createForestTreePositions(): Vector2[] {
  const positions: Vector2[] = [];
  const spacing = 1.45;
  const rowStep = spacing * 0.866;
  let row = 0;
  for (let z = -52; z <= 52; z += rowStep) {
    const rowOffset = (row % 2) * spacing * 0.5;
    for (let x = -53 + rowOffset; x <= 53; x += spacing) {
      const index = positions.length + row * 97;
      const position = {
        x: x + proceduralOffset(index, 17) * 0.12,
        z: z + proceduralOffset(index, 43) * 0.12,
      };
      if (!pointInMap(position, FOREST_BOUNDARY)) continue;
      if (Math.hypot(position.x, position.z) < 3.45) continue;
      positions.push(position);
    }
    row += 1;
  }
  return positions;
}

function proceduralOffset(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43_758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function pointInMap(point: Vector2, polygon: readonly Vector2[]): boolean {
  let inside = false;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const previous = polygon[(index + polygon.length - 1) % polygon.length]!;
    if (
      current.z > point.z !== previous.z > point.z &&
      point.x <
        ((previous.x - current.x) * (point.z - current.z)) /
          (previous.z - current.z) +
          current.x
    )
      inside = !inside;
  }
  return inside;
}

export const FOREST_AREAS: readonly MapArea[] = [
  {
    color: 0x659f43,
    points: [
      { x: -34, z: -13 },
      { x: -24, z: -15 },
      { x: -13, z: -10 },
      { x: -12, z: 22 },
      { x: -23, z: 29 },
      { x: -34, z: 25 },
    ],
  },
  {
    color: 0x5e973f,
    points: [
      { x: -32, z: -29 },
      { x: -18, z: -32 },
      { x: -5, z: -26 },
      { x: -5, z: -12 },
      { x: -19, z: -10 },
      { x: -32, z: -14 },
    ],
  },
  {
    color: 0x5c943e,
    points: [
      { x: 7, z: -27 },
      { x: 18, z: -31 },
      { x: 31, z: -28 },
      { x: 33, z: -12 },
      { x: 23, z: -9 },
      { x: 8, z: -12 },
    ],
  },
  {
    color: 0x629b42,
    points: [
      { x: 15, z: -3 },
      { x: 27, z: -5 },
      { x: 34, z: 0 },
      { x: 34, z: 29 },
      { x: 22, z: 30 },
      { x: 14, z: 22 },
    ],
  },
];

export const FOREST_YARDS: readonly MapYard[] = [
  {
    color: 0xc8ad72,
    unlockStep: 1,
    points: [
      { x: -4.3, z: -3.8 },
      { x: 4.3, z: -3.8 },
      { x: 4.3, z: 4.8 },
      { x: -4.3, z: 4.8 },
    ],
  },
  {
    color: 0xc29f66,
    unlockStep: 2,
    points: [
      { x: -8.3, z: 0 },
      { x: -4.1, z: 0 },
      { x: -4.1, z: 4.8 },
      { x: -8.3, z: 4.8 },
    ],
  },
  {
    color: 0xbe9d63,
    unlockStep: 4,
    points: [
      { x: 4.1, z: -3.8 },
      { x: 8.3, z: -3.8 },
      { x: 8.3, z: 2.2 },
      { x: 4.1, z: 2.2 },
    ],
  },
  {
    color: 0xc6a76b,
    unlockStep: 5,
    points: [
      { x: 1.8, z: 4.6 },
      { x: 8.3, z: 4.6 },
      { x: 8.3, z: 8.4 },
      { x: 1.8, z: 8.4 },
    ],
  },
  {
    color: 0xb99a65,
    unlockStep: 6,
    points: [
      { x: -3, z: -8 },
      { x: 3, z: -8 },
      { x: 3, z: -3.6 },
      { x: -3, z: -3.6 },
    ],
  },
  {
    color: 0xc8ad72,
    unlockStep: 7,
    points: [
      { x: -2.5, z: 4.6 },
      { x: 1.8, z: 4.6 },
      { x: 1.8, z: 10 },
      { x: -2.5, z: 10 },
    ],
  },
  {
    color: 0xbc9660,
    unlockStep: 8,
    points: [
      { x: -8.5, z: 5 },
      { x: -2.5, z: 5 },
      { x: -2.5, z: 10 },
      { x: -8.5, z: 10 },
    ],
  },
];

export const FOREST_PATHS: readonly MapPath[] = [
  {
    width: 3.2,
    unlockStep: 1,
    points: [
      { x: -4.5, z: -1 },
      { x: -18, z: 4 },
      { x: -27, z: 1 },
      { x: -35, z: 0 },
    ],
  },
  {
    width: 2.5,
    unlockStep: 2,
    surface: "market",
    points: [
      { x: -8.5, z: 2.5 },
      { x: -12, z: 2.5 },
      { x: -16, z: 2.5 },
    ],
  },
  {
    width: 3.2,
    unlockStep: 4,
    points: [
      { x: 8.5, z: -0.8 },
      { x: 15, z: -8 },
      { x: 23, z: -18 },
      { x: 30, z: -31 },
    ],
  },
  {
    width: 3.2,
    unlockStep: 6,
    points: [
      { x: 0, z: -8 },
      { x: -8, z: -13 },
      { x: -17, z: -22 },
      { x: -25, z: -32 },
    ],
  },
  {
    width: 3.2,
    unlockStep: 5,
    points: [
      { x: 8.5, z: 6.5 },
      { x: 21, z: 5 },
      { x: 28, z: 10 },
      { x: 35, z: 14 },
    ],
  },
  {
    width: 3.4,
    unlockStep: 7,
    points: [
      { x: -0.35, z: 10 },
      { x: -0.2, z: 15 },
      { x: 0, z: 22 },
      { x: -2, z: 32 },
    ],
  },
];

export const FOREST_TRAIL_BARRIERS: readonly TrailBarrier[] = [0, 2, 3, 4].map(
  (pathIndex) => createTrailBarrier(FOREST_PATHS[pathIndex]!),
);

function createTrailBarrier(path: MapPath): TrailBarrier {
  const endpoint = path.points.at(-1)!;
  const previous = path.points.at(-2)!;
  const dx = endpoint.x - previous.x;
  const dz = endpoint.z - previous.z;
  const length = Math.hypot(dx, dz) || 1;
  const center = {
    x: endpoint.x - (dx / length) * 1.1,
    z: endpoint.z - (dz / length) * 1.1,
  };
  const halfWidth = path.width * 0.58;
  const perpendicular = { x: -dz / length, z: dx / length };
  return {
    from: {
      x: center.x - perpendicular.x * halfWidth,
      z: center.z - perpendicular.z * halfWidth,
    },
    to: {
      x: center.x + perpendicular.x * halfWidth,
      z: center.z + perpendicular.z * halfWidth,
    },
    width: 0.45,
    minimumStep: path.unlockStep,
  };
}

export const FOREST_DECORATIONS: readonly MapDecoration[] = [
  { kind: "bush", position: { x: -32, z: -12 }, rotation: 0.3, scale: 1.2 },
  { kind: "bush", position: { x: -26, z: -12 }, rotation: 1.8, scale: 0.9 },
  { kind: "rock", position: { x: -20, z: -11.5 }, rotation: 0.4, scale: 0.8 },
  { kind: "flowers", position: { x: -16, z: -6 }, rotation: 0, scale: 1.1 },
  { kind: "bush", position: { x: -15.7, z: 2.8 }, rotation: 2.2, scale: 0.85 },
  { kind: "flowers", position: { x: -21, z: 11 }, rotation: 0.7, scale: 1 },
  { kind: "rock", position: { x: -29, z: 9 }, rotation: 1.1, scale: 0.75 },
  { kind: "bush", position: { x: -33, z: 5 }, rotation: 0.8, scale: 1.05 },

  { kind: "bush", position: { x: -31, z: -30 }, rotation: 1.6, scale: 1.15 },
  { kind: "rock", position: { x: -24, z: -30.5 }, rotation: 0.5, scale: 0.95 },
  { kind: "flowers", position: { x: -16, z: -30 }, rotation: 0.2, scale: 1.1 },
  { kind: "bush", position: { x: -8.5, z: -26 }, rotation: 2.5, scale: 0.9 },
  { kind: "rock", position: { x: -8.5, z: -19 }, rotation: 0.9, scale: 0.7 },
  { kind: "flowers", position: { x: -12, z: -12 }, rotation: 1.4, scale: 0.95 },
  { kind: "bush", position: { x: -20, z: -12 }, rotation: 0.1, scale: 1.05 },
  { kind: "bush", position: { x: -29, z: -13 }, rotation: 2.9, scale: 0.85 },

  { kind: "rock", position: { x: 8, z: -29 }, rotation: 1.4, scale: 1 },
  { kind: "bush", position: { x: 15, z: -31 }, rotation: 0.6, scale: 1.1 },
  { kind: "flowers", position: { x: 23, z: -30 }, rotation: 2.1, scale: 1 },
  { kind: "bush", position: { x: 31, z: -27 }, rotation: 1.2, scale: 0.95 },
  { kind: "rock", position: { x: 32, z: -20 }, rotation: 0.3, scale: 0.8 },
  { kind: "flowers", position: { x: 30, z: -12 }, rotation: 1.5, scale: 1.15 },
  { kind: "bush", position: { x: 23, z: -11 }, rotation: 2.4, scale: 0.9 },
  { kind: "bush", position: { x: 9, z: -13 }, rotation: 0.8, scale: 1 },

  { kind: "flowers", position: { x: 17, z: 1 }, rotation: 0.4, scale: 0.9 },
  { kind: "bush", position: { x: 21, z: -2 }, rotation: 1.9, scale: 1 },
  { kind: "rock", position: { x: 29, z: -2 }, rotation: 0.6, scale: 0.75 },
  { kind: "bush", position: { x: 33, z: 4 }, rotation: 2.7, scale: 1.1 },
  { kind: "flowers", position: { x: 32, z: 12 }, rotation: 0.2, scale: 1.2 },
  { kind: "rock", position: { x: 31, z: 21 }, rotation: 1.3, scale: 0.9 },
  { kind: "bush", position: { x: 25, z: 23 }, rotation: 0.9, scale: 1.05 },
  { kind: "flowers", position: { x: 18, z: 20 }, rotation: 2.2, scale: 1 },

  { kind: "flowers", position: { x: -5, z: 5 }, rotation: 0.5, scale: 0.85 },
  { kind: "rock", position: { x: -6, z: -5 }, rotation: 1.7, scale: 0.65 },
  { kind: "flowers", position: { x: 5, z: 5 }, rotation: 2.4, scale: 0.9 },
  { kind: "rock", position: { x: 6, z: -5 }, rotation: 0.2, scale: 0.7 },
];

export const FOREST_FENCES: readonly MapSegment[] = [
  // Noyau du camp.
  {
    from: { x: -4.5, z: -4 },
    to: { x: -4.5, z: -1.9 },
    width: 0.35,
    minimumStep: 1,
  },
  {
    from: { x: -4.5, z: -0.1 },
    to: { x: -4.5, z: 5 },
    width: 0.35,
    minimumStep: 1,
    maximumStep: 1,
  },
  {
    from: { x: 4.5, z: -4 },
    to: { x: 4.5, z: 2.2 },
    width: 0.35,
    minimumStep: 1,
    maximumStep: 3,
  },
  {
    from: { x: 4.5, z: 2.2 },
    to: { x: 4.5, z: 5 },
    width: 0.35,
    minimumStep: 1,
  },
  {
    from: { x: -4.5, z: -4 },
    to: { x: -3, z: -4 },
    width: 0.35,
    minimumStep: 1,
  },
  {
    from: { x: -3, z: -4 },
    to: { x: 3, z: -4 },
    width: 0.35,
    minimumStep: 1,
    maximumStep: 5,
  },
  { from: { x: 3, z: -4 }, to: { x: 4.5, z: -4 }, width: 0.35, minimumStep: 1 },
  {
    from: { x: -4.5, z: 5 },
    to: { x: -2.5, z: 5 },
    width: 0.35,
    minimumStep: 1,
  },
  {
    from: { x: -2.5, z: 5 },
    to: { x: 1.8, z: 5 },
    width: 0.35,
    minimumStep: 1,
    maximumStep: 6,
  },
  {
    from: { x: 1.8, z: 5 },
    to: { x: 4.5, z: 5 },
    width: 0.35,
    minimumStep: 1,
    maximumStep: 5,
  },

  // Aile du marché. Le comptoir occupe l'ouverture du mur extérieur.
  {
    from: { x: -8.5, z: 0 },
    to: { x: -4.5, z: 0 },
    width: 0.35,
    minimumStep: 2,
  },
  {
    from: { x: -8.5, z: 5 },
    to: { x: -4.5, z: 5 },
    width: 0.35,
    minimumStep: 2,
  },
  {
    from: { x: -8.5, z: 0 },
    to: { x: -8.5, z: 1 },
    width: 0.35,
    minimumStep: 2,
  },
  {
    from: { x: -8.5, z: 4 },
    to: { x: -8.5, z: 5 },
    width: 0.35,
    minimumStep: 2,
  },

  // Aile industrielle.
  {
    from: { x: 4.5, z: -4 },
    to: { x: 8.5, z: -4 },
    width: 0.35,
    minimumStep: 4,
  },
  {
    from: { x: 4.5, z: 2.2 },
    to: { x: 8.5, z: 2.2 },
    width: 0.35,
    minimumStep: 4,
  },
  {
    from: { x: 8.5, z: -4 },
    to: { x: 8.5, z: -1.7 },
    width: 0.35,
    minimumStep: 4,
  },
  {
    from: { x: 8.5, z: 0.1 },
    to: { x: 8.5, z: 2.2 },
    width: 0.35,
    minimumStep: 4,
  },

  // Aile des ouvriers.
  {
    from: { x: 1.8, z: 8.5 },
    to: { x: 8.5, z: 8.5 },
    width: 0.35,
    minimumStep: 5,
  },
  {
    from: { x: 4.5, z: 4.6 },
    to: { x: 8.5, z: 4.6 },
    width: 0.35,
    minimumStep: 5,
  },
  {
    from: { x: 8.5, z: 4.6 },
    to: { x: 8.5, z: 5.6 },
    width: 0.35,
    minimumStep: 5,
  },
  {
    from: { x: 8.5, z: 7.4 },
    to: { x: 8.5, z: 8.5 },
    width: 0.35,
    minimumStep: 5,
  },

  // Quai du convoi.
  {
    from: { x: -3, z: -8 },
    to: { x: -0.9, z: -8 },
    width: 0.35,
    minimumStep: 6,
  },
  { from: { x: 0.9, z: -8 }, to: { x: 3, z: -8 }, width: 0.35, minimumStep: 6 },
  { from: { x: -3, z: -8 }, to: { x: -3, z: -4 }, width: 0.35, minimumStep: 6 },
  { from: { x: 3, z: -8 }, to: { x: 3, z: -4 }, width: 0.35, minimumStep: 6 },

  // Aile de sortie.
  {
    from: { x: -2.5, z: 5 },
    to: { x: -2.5, z: 6.1 },
    width: 0.35,
    minimumStep: 7,
  },
  {
    from: { x: -2.5, z: 7.9 },
    to: { x: -2.5, z: 10 },
    width: 0.35,
    minimumStep: 7,
  },
  {
    from: { x: 1.8, z: 5 },
    to: { x: 1.8, z: 10 },
    width: 0.35,
    minimumStep: 7,
  },
  {
    from: { x: -2.5, z: 10 },
    to: { x: -1.25, z: 10 },
    width: 0.35,
    minimumStep: 7,
  },
  {
    from: { x: 0.55, z: 10 },
    to: { x: 1.8, z: 10 },
    width: 0.35,
    minimumStep: 7,
  },

  // Aile de la faune.
  {
    from: { x: -8.5, z: 5 },
    to: { x: -8.5, z: 10 },
    width: 0.35,
    minimumStep: 8,
  },
  {
    from: { x: -8.5, z: 10 },
    to: { x: -2.5, z: 10 },
    width: 0.35,
    minimumStep: 8,
  },
];

export const PROGRESSION_GATES: readonly ProgressionGate[] = [
  {
    from: { x: -4.5, z: -1.9 },
    to: { x: -4.5, z: -0.1 },
    width: 0.35,
    minimumStep: 1,
    unlockStep: 1,
  },
  {
    from: { x: 8.5, z: -1.7 },
    to: { x: 8.5, z: 0.1 },
    width: 0.35,
    minimumStep: 4,
    unlockStep: 4,
  },
  {
    from: { x: 8.5, z: 5.6 },
    to: { x: 8.5, z: 7.4 },
    width: 0.35,
    minimumStep: 5,
    unlockStep: 5,
  },
  {
    from: { x: -0.9, z: -8 },
    to: { x: 0.9, z: -8 },
    width: 0.35,
    minimumStep: 6,
    unlockStep: 6,
  },
  {
    from: { x: -1.25, z: 10 },
    to: { x: 0.55, z: 10 },
    width: 0.35,
    minimumStep: 7,
    unlockStep: 7,
  },
  {
    from: { x: -2.5, z: 6.1 },
    to: { x: -2.5, z: 7.9 },
    width: 0.35,
    minimumStep: 8,
    unlockStep: 8,
  },
];

export const FOREST_COLLIDERS: readonly MapCollider[] = [
  {
    shape: "rectangle",
    center: MARKET_TABLE,
    halfWidth: 0.75,
    halfDepth: 1.5,
    minimumStep: 2,
  },
  {
    shape: "rectangle",
    center: SAWMILL_BUILDING,
    halfWidth: 1.15,
    halfDepth: 0.75,
    minimumStep: 4,
  },
  {
    shape: "circle",
    center: MONUMENT_BUILDING,
    radius: 0.75,
    minimumStep: 6,
  },
  {
    shape: "rectangle",
    center: BUTCHER_BUILDING,
    halfWidth: 0.88,
    halfDepth: 0.38,
    minimumStep: 8,
  },
  {
    shape: "circle",
    center: TURRET_BUILDING,
    radius: 0.7,
    minimumStep: 9,
  },
  ...FOREST_FENCES.map(
    ({ from, to, width, minimumStep, maximumStep }): MapCollider => ({
      shape: "rectangle",
      center: { x: (from.x + to.x) / 2, z: (from.z + to.z) / 2 },
      halfWidth: Math.abs(to.x - from.x) / 2 + width,
      halfDepth: Math.abs(to.z - from.z) / 2 + width,
      minimumStep,
      maximumStep,
    }),
  ),
  ...FOREST_TRAIL_BARRIERS.map(
    ({ from, to, width, minimumStep }): MapCollider => ({
      shape: "rectangle",
      center: { x: (from.x + to.x) / 2, z: (from.z + to.z) / 2 },
      halfWidth: Math.abs(to.x - from.x) / 2 + width,
      halfDepth: Math.abs(to.z - from.z) / 2 + width,
      minimumStep,
    }),
  ),
];

export function isPointCleared(
  position: Vector2,
  campaignStep: number,
): boolean {
  if (
    FOREST_YARDS.some(
      (yard) =>
        campaignStep >= yard.unlockStep &&
        (pointInMap(position, yard.points) ||
          polygonDistance(position, yard.points) <= 2.5),
    )
  )
    return true;
  return FOREST_PATHS.some(
    ({ points, width, unlockStep }) =>
      campaignStep >= unlockStep &&
      points
        .slice(1)
        .some(
          (to, index) =>
            mapSegmentDistance(position, points[index]!, to) <= width / 2 + 0.8,
        ),
  );
}

function polygonDistance(point: Vector2, points: readonly Vector2[]): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length; index += 1) {
    minimum = Math.min(
      minimum,
      mapSegmentDistance(
        point,
        points[index]!,
        points[(index + 1) % points.length]!,
      ),
    );
  }
  return minimum;
}

function mapSegmentDistance(
  point: Vector2,
  from: Vector2,
  to: Vector2,
): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared === 0)
    return Math.hypot(point.x - from.x, point.z - from.z);
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
