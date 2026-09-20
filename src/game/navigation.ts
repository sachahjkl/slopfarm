import type { Vector2 } from "./model";

interface PathOptions {
  step: number;
  goalRadius: number;
  canOccupy(position: Vector2): boolean;
  maximumNodes?: number;
}

interface SearchNode {
  point: Vector2;
  cost: number;
  estimate: number;
  parent?: string;
}

const DIRECTIONS = [
  { x: -1, z: -1 },
  { x: 0, z: -1 },
  { x: 1, z: -1 },
  { x: -1, z: 0 },
  { x: 1, z: 0 },
  { x: -1, z: 1 },
  { x: 0, z: 1 },
  { x: 1, z: 1 },
] as const;

export function findPath(
  from: Vector2,
  to: Vector2,
  options: PathOptions,
): Vector2[] | undefined {
  if (distance(from, to) <= options.goalRadius) return [];
  const start = snap(from, options.step);
  const startKey = key(start);
  const nodes = new Map<string, SearchNode>();
  const open = new Set([startKey]);
  nodes.set(startKey, {
    point: start,
    cost: 0,
    estimate: distance(start, to),
  });
  const maximumNodes = options.maximumNodes ?? 20_000;

  while (open.size > 0 && nodes.size < maximumNodes) {
    const currentKey = minimumEstimate(open, nodes);
    const current = nodes.get(currentKey)!;
    open.delete(currentKey);
    if (distance(current.point, to) <= options.goalRadius) {
      const path = rebuildPath(currentKey, nodes);
      if (path.length === 0 && distance(from, to) > options.goalRadius)
        return [start];
      return path;
    }

    for (const direction of DIRECTIONS) {
      const point = {
        x: current.point.x + direction.x * options.step,
        z: current.point.z + direction.z * options.step,
      };
      if (!options.canOccupy(point)) continue;
      if (
        direction.x !== 0 &&
        direction.z !== 0 &&
        (!options.canOccupy({ x: point.x, z: current.point.z }) ||
          !options.canOccupy({ x: current.point.x, z: point.z }))
      )
        continue;
      const pointKey = key(point);
      const cost =
        current.cost +
        options.step *
          (direction.x !== 0 && direction.z !== 0 ? Math.SQRT2 : 1);
      const known = nodes.get(pointKey);
      if (known && known.cost <= cost) continue;
      nodes.set(pointKey, {
        point,
        cost,
        estimate: cost + distance(point, to),
        parent: currentKey,
      });
      open.add(pointKey);
    }
  }
  return undefined;
}

function rebuildPath(
  end: string,
  nodes: ReadonlyMap<string, SearchNode>,
): Vector2[] {
  const path: Vector2[] = [];
  let current: string | undefined = end;
  while (current) {
    const searchNode: SearchNode | undefined = nodes.get(current);
    if (!searchNode) break;
    path.push(searchNode.point);
    current = searchNode.parent;
  }
  path.reverse();
  path.shift();
  return path;
}

function minimumEstimate(
  open: ReadonlySet<string>,
  nodes: ReadonlyMap<string, SearchNode>,
): string {
  let result: string | undefined;
  for (const candidate of open)
    if (
      result === undefined ||
      nodes.get(candidate)!.estimate < nodes.get(result)!.estimate
    )
      result = candidate;
  return result!;
}

function snap(point: Vector2, step: number): Vector2 {
  return {
    x: Math.round(point.x / step) * step,
    z: Math.round(point.z / step) * step,
  };
}

function key(point: Vector2): string {
  return `${point.x.toFixed(2)}:${point.z.toFixed(2)}`;
}

function distance(left: Vector2, right: Vector2): number {
  return Math.hypot(right.x - left.x, right.z - left.z);
}
