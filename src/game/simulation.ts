export interface Vector2 {
  x: number;
  z: number;
}

export type GameCommand =
  | { type: "movement.changed"; direction: Vector2 }
  | { type: "tool.upgrade-requested" };

export type GameEvent =
  | { type: "tree.hit"; position: Vector2 }
  | { type: "tree.destroyed"; position: Vector2 }
  | { type: "loot.collected"; position: Vector2; total: number }
  | { type: "tool.upgraded"; level: number };

export interface TreeState {
  id: number;
  position: Vector2;
  health: number;
}

export interface LootState {
  id: number;
  position: Vector2 & { y: number };
  rotation: number;
}

export interface GameState {
  player: { position: Vector2; heading: number };
  tool: { level: number; angle: number; positions: readonly Vector2[] };
  trees: readonly TreeState[];
  loot: readonly LootState[];
  collectedWood: number;
}

interface LootBody extends LootState {
  age: number;
  velocity: Vector2 & { y: number };
}

const FIXED_STEP = 1 / 60;
const MAX_FRAME_TIME = 0.1;

export class GameSimulation {
  readonly #commands: GameCommand[] = [];
  readonly #events: GameEvent[] = [];
  readonly #trees: TreeState[];
  readonly #loot: LootBody[] = [];
  readonly #toolPositions: Vector2[] = [];
  readonly #treeHitTimes = new Map<number, number>();
  readonly #random: RandomSource;
  readonly #state: GameState;
  #movement: Vector2 = { x: 0, z: 0 };
  #accumulator = 0;
  #time = 0;
  #nextLootId = 1;

  constructor(seed = 0x5eed_fa11) {
    this.#random = new RandomSource(seed);
    this.#trees = createTrees(28);
    this.#state = {
      player: { position: { x: 0, z: 0 }, heading: 0 },
      tool: { level: 1, angle: 0, positions: this.#toolPositions },
      trees: this.#trees,
      loot: this.#loot,
      collectedWood: 0,
    };
    this.#updateTools();
  }

  get state(): GameState {
    return this.#state;
  }

  enqueue(command: GameCommand): void {
    this.#commands.push(command);
  }

  advance(elapsedSeconds: number): void {
    this.#accumulator += Math.min(elapsedSeconds, MAX_FRAME_TIME);
    while (this.#accumulator >= FIXED_STEP) {
      this.#step(FIXED_STEP);
      this.#accumulator -= FIXED_STEP;
    }
  }

  drainEvents(): GameEvent[] {
    return this.#events.splice(0);
  }

  #step(delta: number): void {
    this.#consumeCommands();
    this.#time += delta;
    this.#movePlayer(delta);
    this.#state.tool.angle += delta * (2.4 + this.#state.tool.level * 0.38);
    this.#updateTools();
    this.#hitTrees();
    this.#updateLoot(delta);
  }

  #consumeCommands(): void {
    for (const command of this.#commands.splice(0)) {
      if (command.type === "movement.changed") {
        const length = Math.hypot(command.direction.x, command.direction.z);
        this.#movement =
          length > 1
            ? {
                x: command.direction.x / length,
                z: command.direction.z / length,
              }
            : { ...command.direction };
      } else if (this.#state.tool.level < 6) {
        this.#state.tool.level += 1;
        this.#events.push({
          type: "tool.upgraded",
          level: this.#state.tool.level,
        });
      }
    }
  }

  #movePlayer(delta: number): void {
    const player = this.#state.player;
    player.position.x = clamp(
      player.position.x + this.#movement.x * delta * 5,
      -12,
      12,
    );
    player.position.z = clamp(
      player.position.z + this.#movement.z * delta * 5,
      -12,
      12,
    );
    if (this.#movement.x !== 0 || this.#movement.z !== 0) {
      player.heading = Math.atan2(this.#movement.x, this.#movement.z);
    }
  }

  #updateTools(): void {
    const tool = this.#state.tool;
    const count = tool.level + 1;
    const radius = 1.45 + tool.level * 0.08;
    this.#toolPositions.length = count;
    for (let index = 0; index < count; index += 1) {
      const angle = tool.angle + (index / count) * Math.PI * 2;
      this.#toolPositions[index] = {
        x: this.#state.player.position.x + Math.cos(angle) * radius,
        z: this.#state.player.position.z + Math.sin(angle) * radius,
      };
    }
  }

  #hitTrees(): void {
    for (const tree of this.#trees) {
      if (
        tree.health <= 0 ||
        this.#time - (this.#treeHitTimes.get(tree.id) ?? -1) < 0.26
      )
        continue;
      const hit = this.#toolPositions.some(
        (tool) => distance(tool, tree.position) < 0.9,
      );
      if (!hit) continue;
      this.#treeHitTimes.set(tree.id, this.#time);
      tree.health -= 1;
      this.#events.push({ type: "tree.hit", position: tree.position });
      if (tree.health === 0) {
        this.#events.push({ type: "tree.destroyed", position: tree.position });
        this.#spawnLoot(tree.position, 5);
      }
    }
  }

  #spawnLoot(position: Vector2, count: number): void {
    for (let index = 0; index < count; index += 1) {
      this.#loot.push({
        id: this.#nextLootId++,
        position: { x: position.x, y: 0.8, z: position.z },
        velocity: {
          x: (this.#random.next() - 0.5) * 4,
          y: 3.5 + this.#random.next() * 2,
          z: (this.#random.next() - 0.5) * 4,
        },
        rotation: this.#random.next() * Math.PI,
        age: 0,
      });
    }
  }

  #updateLoot(delta: number): void {
    const player = this.#state.player.position;
    for (let index = this.#loot.length - 1; index >= 0; index -= 1) {
      const loot = this.#loot[index]!;
      loot.age += delta;
      if (loot.age < 0.38) {
        loot.velocity.y -= 10 * delta;
        loot.position.x += loot.velocity.x * delta;
        loot.position.y += loot.velocity.y * delta;
        loot.position.z += loot.velocity.z * delta;
        if (loot.position.y < 0.18) {
          loot.position.y = 0.18;
          loot.velocity.y = Math.abs(loot.velocity.y) * 0.3;
        }
        continue;
      }
      const distanceToPlayer = distance(loot.position, player);
      if (distanceToPlayer >= 4.5) continue;
      const amount = Math.min(1, delta * 8);
      loot.position.x += (player.x - loot.position.x) * amount;
      loot.position.y += (1.2 - loot.position.y) * amount;
      loot.position.z += (player.z - loot.position.z) * amount;
      loot.rotation += delta * 12;
      if (distanceToPlayer < 0.42) {
        this.#loot.splice(index, 1);
        this.#state.collectedWood += 1;
        this.#events.push({
          type: "loot.collected",
          position: { ...player },
          total: this.#state.collectedWood,
        });
      }
    }
  }
}

class RandomSource {
  #state: number;

  constructor(seed: number) {
    this.#state = seed >>> 0;
  }

  next(): number {
    this.#state += 0x6d2b_79f5;
    let value = this.#state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }
}

function createTrees(count: number): TreeState[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 + (index % 3) * 0.23;
    const radius = 5.2 + (index % 5) * 1.55;
    return {
      id: index,
      position: { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius },
      health: 3,
    };
  });
}

function distance(left: Vector2, right: Vector2): number {
  return Math.hypot(left.x - right.x, left.z - right.z);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
