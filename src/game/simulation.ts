import {
  BEAR_PATHS,
  BUTCHER_OUTPUT,
  FOREST,
  MARKET_TABLE,
  MONUMENT_BUILDING,
  MONUMENT_CONVEYOR_PATH,
  SALE_OUTPUT,
  SAWMILL_BUILDING,
  SAWMILL_OUTPUT,
  TURRET_BUILDINGS,
  WORKER_DEPOT,
  WORKER_CONVEYOR_PATH,
  ZONES,
  toolCount,
  toolDamage,
  toolOrbitRadius,
  pathLength,
  zonePosition,
} from "./content";
import { CAMPAIGN_STEPS, campaignCosts } from "./campaign";
import {
  FOREST_COLLIDERS,
  FOREST_PATHS,
  FOREST_TREE_POSITIONS,
  PROGRESSION_GATES,
  PLAYABLE_BOUNDARY,
  isPointCleared,
  type MapCollider,
} from "./forest-map";
import type {
  ConveyorItemState,
  CustomerState,
  AnimalState,
  GameCommand,
  GameEvent,
  GameState,
  PickupKind,
  PickupState,
  ReplayData,
  ResourceKind,
  SaveData,
  TreeState,
  Vector2,
  WorkerState,
} from "./model";
import { findPath } from "./navigation";
import { Queue } from "./queue";
import { RandomSource } from "./random";
import { stackItemOffset } from "./stack-layout";

export type {
  ConveyorItemState,
  CustomerState,
  GameCommand,
  GameEvent,
  GameState,
  PickupKind,
  PickupState,
  ReplayData,
  ResourceKind,
  SaveData,
  TreeState,
  Vector2,
  WorkerState,
  ZoneKind,
} from "./model";

interface PickupBody extends PickupState {
  age: number;
  velocity: Vector2 & { y: number };
}

interface WorkerBody extends WorkerState {
  targetTreeId?: number;
  actionRemaining: number;
  path: Vector2[];
  pathIndex: number;
  pathRetryRemaining: number;
}

interface ConveyorBody extends ConveyorItemState {
  destination: "sawmill" | "monument";
}

interface CustomerBody extends CustomerState {
  serviceRemaining: number;
}

interface ToolHitShape {
  from: Vector2;
  to: Vector2;
  radius: number;
}

type DepositZone =
  | "camp"
  | "sale"
  | "sawmill"
  | "tool"
  | "worker"
  | "monument"
  | "automation"
  | "butcher"
  | "turret";

const FIXED_STEP = 1 / 60;
const MAX_FRAME_TIME = 0.1;
const DEFAULT_SEED = 0x5eed_fa11;
const WORKER_PATH_RETRY_SECONDS = 1.5;

export class GameSimulation {
  readonly #commands = new Queue<GameCommand>();
  readonly #events = new Queue<GameEvent>();
  readonly #random: RandomSource;
  #seed: number;
  readonly #trees: TreeState[];
  readonly #pickups: PickupBody[] = [];
  readonly #workers: WorkerBody[] = [];
  readonly #conveyorItems: ConveyorBody[] = [];
  readonly #customers: CustomerBody[] = [];
  readonly #animals: AnimalState[] = [];
  readonly #toolPositions: Vector2[] = [];
  readonly #toolHitShapes: ToolHitShape[] = [];
  readonly #treeHitTimes = new Map<number, number>();
  readonly #animalHitTimes = new Map<number, number>();
  readonly #animalContactTimes = new Map<number, number>();
  readonly #animalAttackOrigins = new Map<number, Vector2>();
  readonly #replayCommands: ReplayData["commands"] = [];
  #replayStart: SaveData;
  readonly #state: GameState;
  #movement: Vector2 = { x: 0, z: 0 };
  #accumulator = 0;
  #stepIndex = 0;
  #nextEntityId = 1;
  #depositRemaining = 0;
  #depositDuration = 0;
  #depositZone: DepositZone | undefined;
  #sawmillRemaining = 0;
  #customerSpawnRemaining = 0;
  #animalSpawnRemaining: number = FOREST.animalSpawnSeconds;
  readonly #turretRemaining = [0, 0, 0];

  constructor(seed = DEFAULT_SEED) {
    this.#seed = seed;
    this.#random = new RandomSource(seed);
    this.#trees = createTrees(FOREST.treeHealth);
    this.#state = {
      elapsed: 0,
      player: {
        position: { x: 0, z: 0 },
        heading: 0,
        trailMomentum: 0,
      },
      inventory: { coins: 0, wood: 0, planks: 0, meat: 0 },
      tool: { level: 1, angle: 0, positions: this.#toolPositions },
      trees: this.#trees,
      pickups: this.#pickups,
      workers: this.#workers,
      conveyorItems: this.#conveyorItems,
      customers: this.#customers,
      animals: this.#animals,
      campaign: {
        step: CAMPAIGN_STEPS.camp,
        completed: false,
        campWood: 0,
        marketWood: 0,
        sawmillWood: 0,
        marketStock: 0,
        customersServed: 0,
        exitPlanks: 0,
        butcherWood: 0,
        meatSold: 0,
        animalsDefeated: 0,
      },
      automationLevel: 0,
      automationProgress: 0,
      payments: { toolCoins: 0, workerCoins: 0 },
      sawmill: { wood: 0, planks: 0 },
      monument: { stage: 0, progress: 0 },
      butcher: { level: 0, planks: 0 },
      turret: { level: 0, coins: 0, planks: 0 },
    };
    this.#updateTools();
    this.#replayStart = this.createSave();
  }

  get state(): GameState {
    return this.#state;
  }

  enqueue(command: GameCommand): void {
    this.#commands.add(command);
  }

  advance(elapsedSeconds: number): void {
    this.#accumulator += Math.min(elapsedSeconds, MAX_FRAME_TIME);
    while (this.#accumulator >= FIXED_STEP) {
      this.#step(FIXED_STEP);
      this.#accumulator -= FIXED_STEP;
    }
  }

  drainEvents(): GameEvent[] {
    return this.#events.drain();
  }

  createSave(): SaveData {
    return {
      seed: this.#seed,
      randomState: this.#random.state,
      state: structuredClone(this.#state),
    };
  }

  createReplay(): ReplayData {
    return {
      seed: this.#seed,
      initial: structuredClone(this.#replayStart),
      commands: structuredClone(this.#replayCommands),
    };
  }

  restore(save: SaveData): void {
    this.#load(save);
    this.#accumulator = 0;
  }

  #step(delta: number): void {
    this.#consumeCommands();
    this.#stepIndex += 1;
    this.#state.elapsed += delta;
    this.#depositRemaining -= delta;
    this.#sawmillRemaining -= delta;
    this.#movePlayer(delta);
    const productionMultiplier = this.#state.monument.stage >= 3 ? 4 : 1;
    this.#state.tool.angle +=
      delta * (2.35 + this.#state.tool.level * 0.32) * productionMultiplier;
    this.#updateTools();
    this.#hitTrees();
    this.#hitAnimals();
    this.#updateTrees(delta * productionMultiplier);
    this.#updatePickups(delta);
    this.#updateZones(delta);
    this.#updateCustomers(delta);
    this.#updateAnimals(delta);
    this.#pushPlayerFromAnimals();
    this.#updateTurret(delta);
    this.#updateWorkers(delta * productionMultiplier);
    this.#updateConveyors(delta * productionMultiplier);
    this.#updateSawmill();
  }

  #consumeCommands(): void {
    for (const command of this.#commands.drain()) {
      if (command.type === "movement.changed") {
        const length = Math.hypot(command.direction.x, command.direction.z);
        const movement =
          length > 1
            ? {
                x: command.direction.x / length,
                z: command.direction.z / length,
              }
            : { ...command.direction };
        if (movement.x === this.#movement.x && movement.z === this.#movement.z)
          continue;
        this.#movement = movement;
        this.#record(command);
      } else if (command.type === "tool.upgrade-requested") {
        this.#record(command);
        if (this.#state.tool.level < 6) {
          this.#state.tool.level += 1;
          this.#events.add({
            type: "tool.upgraded",
            level: this.#state.tool.level,
          });
        }
      } else if (command.type === "debug.grant") {
        this.#record(command);
        this.#state.inventory.coins += command.coins ?? 0;
        this.#state.inventory.wood += command.wood ?? 0;
        this.#state.inventory.planks += command.planks ?? 0;
        this.#state.inventory.meat += command.meat ?? 0;
      } else if (command.type === "debug.spawn-animal") {
        this.#record(command);
        this.#spawnAnimal(command.position, command.route);
      } else if (command.type === "debug.progress") {
        this.#record(command);
        if (command.automation && this.#state.automationLevel < 3) {
          this.#state.automationLevel += 1;
          this.#events.add({
            type: "automation.upgraded",
            level: this.#state.automationLevel,
          });
        }
        if (command.monument && this.#state.monument.stage < 3) {
          this.#state.monument.stage += 1;
          this.#events.add({
            type: "monument.advanced",
            stage: this.#state.monument.stage,
          });
        }
        if (command.worker && this.#workers.length < FOREST.maxWorkers)
          this.#hireWorker();
        if (command.turret && this.#state.turret.level < 3) {
          this.#state.turret.level += 1;
          this.#events.add({
            type: "turret.upgraded",
            level: this.#state.turret.level,
          });
        }
      } else {
        this.#load(command.data);
      }
    }
  }

  #record(command: GameCommand): void {
    this.#replayCommands.push({
      step: this.#stepIndex,
      command: structuredClone(command),
    });
  }

  #movePlayer(delta: number): void {
    const player = this.#state.player;
    const moving = this.#movement.x !== 0 || this.#movement.z !== 0;
    const movement =
      delta *
      FOREST.playerSpeed *
      (1 + player.trailMomentum * FOREST.trailSpeedBonus);
    const previous = { ...player.position };
    const nextX = {
      x: player.position.x + this.#movement.x * movement,
      z: player.position.z,
    };
    if (
      canMoveTo(player.position, nextX, this.#trees, this.#state.campaign.step)
    )
      player.position.x = nextX.x;
    const nextZ = {
      x: player.position.x,
      z: player.position.z + this.#movement.z * movement,
    };
    if (
      canMoveTo(player.position, nextZ, this.#trees, this.#state.campaign.step)
    )
      player.position.z = nextZ.z;
    if (moving) {
      player.heading = Math.atan2(this.#movement.x, this.#movement.z);
    }
    const moved = distance(previous, player.position) > 0.001;
    if (moved && isOnForestPath(player.position, this.#state.campaign.step)) {
      player.trailMomentum = clamp(
        player.trailMomentum + delta / FOREST.trailMomentumSeconds,
        0,
        1,
      );
    } else {
      const decaySeconds = moved ? FOREST.trailMomentumDecaySeconds : 0.8;
      player.trailMomentum = clamp(
        player.trailMomentum - delta / decaySeconds,
        0,
        1,
      );
    }
  }

  #updateTools(): void {
    const tool = this.#state.tool;
    const count = toolCount(tool.level);
    const radius = toolOrbitRadius(tool.level);
    this.#toolPositions.length = count;
    this.#toolHitShapes.length = 0;
    for (let index = 0; index < count; index += 1) {
      const angle = tool.angle + (index / count) * Math.PI * 2;
      const radial = { x: Math.cos(angle), z: Math.sin(angle) };
      const tangent = { x: -Math.sin(angle), z: Math.cos(angle) };
      const pivot = {
        x: this.#state.player.position.x + radial.x * radius,
        z: this.#state.player.position.z + radial.z * radius,
      };
      this.#toolPositions[index] = pivot;
      const handleEnd = {
        x: pivot.x + radial.x * AXE_LENGTH,
        z: pivot.z + radial.z * AXE_LENGTH,
      };
      this.#toolHitShapes.push({
        from: pivot,
        to: handleEnd,
        radius: AXE_HANDLE_RADIUS,
      });
      const bladeCenter = {
        x: pivot.x + radial.x * AXE_BLADE_LENGTH,
        z: pivot.z + radial.z * AXE_BLADE_LENGTH,
      };
      const bladeHalfWidth = tool.level >= 4 ? 0.61 : 0.355;
      this.#toolHitShapes.push({
        from: {
          x: bladeCenter.x - tangent.x * bladeHalfWidth,
          z: bladeCenter.z - tangent.z * bladeHalfWidth,
        },
        to: {
          x: bladeCenter.x + tangent.x * bladeHalfWidth,
          z: bladeCenter.z + tangent.z * bladeHalfWidth,
        },
        radius: AXE_BLADE_RADIUS,
      });
    }
  }

  #hitTrees(): void {
    for (const tree of nearbyTrees(
      this.#state.player.position,
      this.#trees,
      3,
    )) {
      if (
        tree.health <= 0 ||
        this.#state.elapsed - (this.#treeHitTimes.get(tree.id) ?? -1) < 0.24
      )
        continue;
      if (
        !this.#toolHitShapes.some(
          (shape) =>
            distanceToSegment(tree.position, shape.from, shape.to) <
            TREE_RADIUS + shape.radius,
        )
      )
        continue;
      this.#treeHitTimes.set(tree.id, this.#state.elapsed);
      this.#damageTree(tree, toolDamage(this.#state.tool.level), "player");
    }
  }

  #damageTree(
    tree: TreeState,
    damage: number,
    source: "player" | "worker",
  ): void {
    tree.health = Math.max(0, tree.health - damage);
    this.#events.add({ type: "tree.hit", position: tree.position, source });
    if (tree.health > 0) return;
    tree.respawnRemaining = FOREST.treeRespawnSeconds;
    this.#events.add({ type: "tree.destroyed", position: tree.position });
    if (source === "player")
      this.#spawnPickups("wood", tree.position, FOREST.logsPerTree);
  }

  #hitAnimals(): void {
    for (const animal of this.#animals) {
      if (
        (this.#animalHitTimes.get(animal.id) ?? -Infinity) +
          FOREST.bearHitCooldownSeconds >
        this.#state.elapsed
      )
        continue;
      if (
        !this.#toolHitShapes.some(
          (shape) =>
            distanceToSegment(animal.position, shape.from, shape.to) <
            0.62 + shape.radius,
        )
      )
        continue;
      this.#animalHitTimes.set(animal.id, this.#state.elapsed);
      this.#damageAnimal(animal, toolDamage(this.#state.tool.level), "player");
    }
  }

  #damageAnimal(
    animal: AnimalState,
    damage: number,
    source: "player" | "turret",
  ): void {
    animal.health = Math.max(0, animal.health - damage);
    this.#events.add({ type: "animal.hit", position: animal.position, source });
    if (animal.health > 0) return;
    const index = this.#animals.indexOf(animal);
    if (index >= 0) this.#animals.splice(index, 1);
    this.#animalAttackOrigins.delete(animal.id);
    this.#state.campaign.animalsDefeated += 1;
    this.#events.add({ type: "animal.destroyed", position: animal.position });
    this.#spawnPickups(
      "meat",
      animal.position,
      FOREST.bearMeat + this.#state.turret.level,
    );
  }

  #updateTrees(delta: number): void {
    for (const tree of this.#trees) {
      if (tree.health > 0) continue;
      if (tree.cleared) continue;
      tree.respawnRemaining -= delta;
      if (tree.respawnRemaining <= 0) {
        tree.health = FOREST.treeHealth;
        tree.respawnRemaining = 0;
        this.#events.add({ type: "tree.regrown", position: tree.position });
      }
    }
  }

  #spawnPickups(
    kind: PickupKind,
    position: Vector2,
    count: number,
    settled = false,
  ): void {
    for (let index = 0; index < count; index += 1) {
      const settledIndex = settled
        ? this.#pickups.filter(
            (pickup) =>
              pickup.kind === kind && distance(pickup.position, position) < 2,
          ).length
        : 0;
      const stacked = settledPickupPosition(kind, position, settledIndex);
      this.#pickups.push({
        id: this.#nextEntityId++,
        kind,
        fixed: settled,
        position: settled ? stacked : { x: position.x, y: 0.8, z: position.z },
        velocity: settled
          ? { x: 0, y: 0, z: 0 }
          : {
              x: (this.#random.next() - 0.5) * 4,
              y: 3.5 + this.#random.next() * 2,
              z: (this.#random.next() - 0.5) * 4,
            },
        rotation: settled
          ? stackItemOffset(settledIndex).rotation
          : this.#random.next() * Math.PI,
        age: settled ? 0.8 : 0,
      });
    }
  }

  #updatePickups(delta: number): void {
    const player = this.#state.player.position;
    for (let index = this.#pickups.length - 1; index >= 0; index -= 1) {
      const pickup = this.#pickups[index]!;
      pickup.age += delta;
      if (pickup.age < 0.38) {
        pickup.velocity.y -= 10 * delta;
        pickup.position.x += pickup.velocity.x * delta;
        pickup.position.y += pickup.velocity.y * delta;
        pickup.position.z += pickup.velocity.z * delta;
        if (pickup.position.y < 0.18) {
          pickup.position.y = 0.18;
          pickup.velocity.y = Math.abs(pickup.velocity.y) * 0.3;
        }
        continue;
      }
      const distanceToPlayer = distance(pickup.position, player);
      const pickupRadius = pickup.fixed ? 1.4 : FOREST.pickupRadius;
      if (distanceToPlayer >= pickupRadius) continue;
      const amount = Math.min(1, delta * 8);
      pickup.position.x += (player.x - pickup.position.x) * amount;
      pickup.position.y += (1.2 - pickup.position.y) * amount;
      pickup.position.z += (player.z - pickup.position.z) * amount;
      pickup.rotation += delta * 12;
      if (distanceToPlayer < 0.42) this.#collectPickup(index, pickup);
    }
  }

  #collectPickup(index: number, pickup: PickupBody): void {
    this.#pickups.splice(index, 1);
    const inventory = this.#state.inventory;
    if (pickup.kind === "coin") inventory.coins += 1;
    else if (pickup.kind === "wood") inventory.wood += 1;
    else if (pickup.kind === "plank") inventory.planks += 1;
    else inventory.meat += 1;
    const total =
      pickup.kind === "coin"
        ? inventory.coins
        : pickup.kind === "wood"
          ? inventory.wood
          : pickup.kind === "plank"
            ? inventory.planks
            : inventory.meat;
    this.#events.add({
      type: "pickup.collected",
      kind: pickup.kind,
      position: this.#state.player.position,
      total,
    });
  }

  #updateZones(delta: number): void {
    const depositZone = this.#findDepositZone();
    if (!depositZone) {
      this.#depositZone = undefined;
      this.#depositDuration = 0;
      this.#depositRemaining = 0;
    } else {
      if (depositZone !== this.#depositZone) {
        this.#depositZone = depositZone;
        this.#depositDuration = 0;
        this.#depositRemaining = 0;
      }
      this.#depositDuration += delta;
    }
    if (depositZone && this.#depositRemaining <= 0) {
      const campaign = this.#state.campaign;
      const costs = campaignCosts();
      if (depositZone === "camp") {
        this.#state.inventory.wood -= 1;
        campaign.campWood += 1;
        this.#events.add({
          type: "resource.deposited",
          kind: "wood",
          target: "camp",
          position: ZONES.camp,
        });
        if (campaign.campWood >= costs.campWood)
          this.#advanceCampaign(CAMPAIGN_STEPS.market);
      } else if (depositZone === "sale") {
        const target = zonePosition("sale", campaign.step);
        this.#state.inventory.wood -= 1;
        if (campaign.step === CAMPAIGN_STEPS.market) {
          campaign.marketWood += 1;
          if (campaign.marketWood >= costs.marketWood)
            this.#advanceCampaign(CAMPAIGN_STEPS.trade);
        } else campaign.marketStock += 1;
        this.#events.add({
          type: "resource.deposited",
          kind: "wood",
          target: "sale",
          position: target,
        });
      } else if (depositZone === "sawmill") {
        const target = zonePosition("sawmill", campaign.step);
        this.#state.inventory.wood -= 1;
        if (campaign.step === CAMPAIGN_STEPS.sawmill) {
          campaign.sawmillWood += 1;
          if (campaign.sawmillWood >= costs.sawmillWood)
            this.#advanceCampaign(CAMPAIGN_STEPS.automation);
        } else this.#state.sawmill.wood += 1;
        this.#events.add({
          type: "resource.deposited",
          kind: "wood",
          target: "sawmill",
          position: target,
        });
      } else if (depositZone === "tool") {
        this.#state.inventory.coins -= 1;
        this.#state.payments.toolCoins += 1;
        this.#events.add({
          type: "resource.deposited",
          kind: "coin",
          target: "tool",
          position: ZONES.tool,
        });
        const cost = FOREST.toolCosts[this.#state.tool.level]!;
        if (this.#state.payments.toolCoins >= cost) {
          this.#state.payments.toolCoins = 0;
          this.#state.tool.level += 1;
          this.#events.add({
            type: "tool.upgraded",
            level: this.#state.tool.level,
          });
          if (campaign.step === CAMPAIGN_STEPS.trade)
            this.#advanceCampaign(CAMPAIGN_STEPS.sawmill);
        }
      } else if (depositZone === "worker") {
        this.#state.inventory.coins -= 1;
        this.#state.payments.workerCoins += 1;
        this.#events.add({
          type: "resource.deposited",
          kind: "coin",
          target: "worker",
          position: zonePosition("worker", campaign.step),
        });
        const cost = FOREST.workerCosts[this.#workers.length]!;
        if (this.#state.payments.workerCoins >= cost) {
          this.#state.payments.workerCoins = 0;
          this.#hireWorker();
          if (campaign.step === CAMPAIGN_STEPS.worker)
            this.#advanceCampaign(CAMPAIGN_STEPS.convoy);
        }
      } else if (depositZone === "monument") {
        this.#state.inventory.planks -= 1;
        campaign.exitPlanks += 1;
        this.#depositMonumentPlank();
        if (campaign.exitPlanks >= costs.exitPlanks)
          this.#advanceCampaign(CAMPAIGN_STEPS.departure);
      } else if (depositZone === "butcher") {
        if (campaign.step === CAMPAIGN_STEPS.wildlife) {
          this.#state.inventory.wood -= 1;
          campaign.butcherWood += 1;
          this.#events.add({
            type: "resource.deposited",
            kind: "wood",
            target: "butcher",
            position: ZONES.butcher,
          });
          if (campaign.butcherWood >= costs.butcherWood) {
            this.#state.butcher.level = 1;
            this.#advanceCampaign(CAMPAIGN_STEPS.defense);
          }
        } else if (
          this.#state.butcher.level < 3 &&
          campaign.meatSold >=
            FOREST.butcherMeatRequirements[this.#state.butcher.level]! &&
          this.#state.inventory.planks > 0 &&
          this.#state.butcher.planks <
            FOREST.butcherPlankCosts[this.#state.butcher.level]!
        ) {
          this.#state.inventory.planks -= 1;
          this.#state.butcher.planks += 1;
          this.#events.add({
            type: "resource.deposited",
            kind: "plank",
            target: "butcher",
            position: ZONES.butcher,
          });
          if (
            this.#state.butcher.planks >=
            FOREST.butcherPlankCosts[this.#state.butcher.level]!
          ) {
            this.#state.butcher.planks = 0;
            this.#state.butcher.level += 1;
            this.#completeCampaignIfReady();
          }
        } else {
          this.#state.inventory.meat -= 1;
          campaign.meatSold += 1;
          this.#events.add({
            type: "resource.deposited",
            kind: "meat",
            target: "butcher",
            position: ZONES.butcher,
          });
          this.#spawnPickups(
            "coin",
            BUTCHER_OUTPUT,
            FOREST.meatPrice +
              FOREST.butcherPriceBonuses[this.#state.butcher.level - 1]!,
            true,
          );
        }
      } else if (depositZone === "turret") {
        const level = this.#state.turret.level;
        const plankCost = FOREST.turretPlankCosts[level]!;
        if (this.#state.turret.planks < plankCost) {
          this.#state.inventory.planks -= 1;
          this.#state.turret.planks += 1;
          this.#events.add({
            type: "resource.deposited",
            kind: "plank",
            target: "turret",
            position: ZONES.turret,
          });
        } else {
          this.#state.inventory.coins -= 1;
          this.#state.turret.coins += 1;
          this.#events.add({
            type: "resource.deposited",
            kind: "coin",
            target: "turret",
            position: ZONES.turret,
          });
        }
        const coinCost = FOREST.turretCosts[level]!;
        if (
          this.#state.turret.planks >= plankCost &&
          this.#state.turret.coins >= coinCost
        ) {
          this.#state.turret.coins = 0;
          this.#state.turret.planks = 0;
          this.#state.turret.level += 1;
          this.#events.add({
            type: "turret.upgraded",
            level: this.#state.turret.level,
          });
          this.#completeCampaignIfReady();
        }
      } else {
        this.#state.inventory.planks -= 1;
        this.#state.automationProgress += 1;
        this.#events.add({
          type: "resource.deposited",
          kind: "plank",
          target: "automation",
          position: ZONES.automation,
        });
        const cost =
          this.#state.automationLevel === 0
            ? costs.automationPlanks
            : FOREST.automationCosts[this.#state.automationLevel + 1]!;
        if (this.#state.automationProgress >= cost) {
          this.#state.automationProgress = 0;
          this.#state.automationLevel += 1;
          this.#events.add({
            type: "automation.upgraded",
            level: this.#state.automationLevel,
          });
          if (campaign.step === CAMPAIGN_STEPS.automation)
            this.#advanceCampaign(CAMPAIGN_STEPS.worker);
        }
      }
      this.#depositRemaining = Math.max(
        FOREST.depositMinimumInterval,
        FOREST.depositInitialInterval *
          Math.exp(-FOREST.depositAcceleration * this.#depositDuration),
      );
    }
    if (
      this.#state.campaign.step === CAMPAIGN_STEPS.departure &&
      near(this.#state.player.position, ZONES.departure)
    ) {
      this.#advanceCampaign(CAMPAIGN_STEPS.wildlife);
      return;
    }
  }

  #findDepositZone(): DepositZone | undefined {
    const position = this.#state.player.position;
    const step = this.#state.campaign.step;
    if (
      step === CAMPAIGN_STEPS.camp &&
      near(position, ZONES.camp) &&
      this.#state.inventory.wood > 0
    )
      return "camp";
    if (
      (step === CAMPAIGN_STEPS.market || step >= CAMPAIGN_STEPS.trade) &&
      near(position, zonePosition("sale", step)) &&
      this.#state.inventory.wood > 0
    )
      return "sale";
    if (
      step >= CAMPAIGN_STEPS.sawmill &&
      near(position, zonePosition("sawmill", step)) &&
      this.#state.inventory.wood > 0
    )
      return "sawmill";
    if (
      step >= CAMPAIGN_STEPS.trade &&
      this.#state.campaign.customersServed >= campaignCosts().customers &&
      near(position, ZONES.tool) &&
      this.#state.inventory.coins > 0 &&
      this.#state.tool.level < 6
    )
      return "tool";
    if (
      step >= CAMPAIGN_STEPS.worker &&
      near(position, zonePosition("worker", step)) &&
      this.#state.inventory.coins > 0 &&
      this.#state.automationLevel >= 1 &&
      this.#workers.length < FOREST.maxWorkers
    )
      return "worker";
    if (
      step >= CAMPAIGN_STEPS.convoy &&
      near(position, ZONES.monument) &&
      this.#state.inventory.planks > 0
    )
      return "monument";
    if (
      step >= CAMPAIGN_STEPS.automation &&
      near(position, ZONES.automation) &&
      this.#state.inventory.planks > 0 &&
      this.#state.automationLevel < 3
    )
      return "automation";
    if (
      step === CAMPAIGN_STEPS.wildlife &&
      near(position, ZONES.butcher) &&
      this.#state.inventory.wood > 0
    )
      return "butcher";
    if (
      step >= CAMPAIGN_STEPS.defense &&
      near(position, ZONES.butcher) &&
      (this.#state.inventory.meat > 0 ||
        (this.#state.inventory.planks > 0 &&
          this.#state.butcher.level < 3 &&
          this.#state.campaign.meatSold >=
            FOREST.butcherMeatRequirements[this.#state.butcher.level]!))
    )
      return "butcher";
    if (
      step >= CAMPAIGN_STEPS.defense &&
      near(position, ZONES.turret) &&
      this.#state.campaign.meatSold >=
        FOREST.turretMeatRequirements[this.#state.turret.level]! &&
      ((this.#state.turret.planks <
        FOREST.turretPlankCosts[this.#state.turret.level]! &&
        this.#state.inventory.planks > 0) ||
        (this.#state.turret.planks >=
          FOREST.turretPlankCosts[this.#state.turret.level]! &&
          this.#state.inventory.coins > 0)) &&
      this.#state.turret.level < 3
    )
      return "turret";
    return undefined;
  }

  #depositMonumentPlank(): void {
    if (this.#state.monument.stage >= 3) return;
    this.#state.monument.progress += 1;
    this.#events.add({
      type: "resource.deposited",
      kind: "plank",
      target: "monument",
      position: ZONES.monument,
    });
    const cost = FOREST.monumentCosts[this.#state.monument.stage]!;
    if (this.#state.monument.progress >= cost) {
      this.#state.monument.progress = 0;
      this.#state.monument.stage += 1;
      this.#events.add({
        type: "monument.advanced",
        stage: this.#state.monument.stage,
      });
      this.#completeCampaignIfReady();
    }
  }

  #hireWorker(): void {
    const id = this.#nextEntityId++;
    this.#workers.push({
      id,
      position: { x: ZONES.worker.x, z: ZONES.worker.z },
      heading: 0,
      carriedWood: 0,
      phase: "seeking",
      actionRemaining: 0,
      path: [],
      pathIndex: 0,
      pathRetryRemaining: 0,
    });
    this.#events.add({ type: "worker.hired", count: this.#workers.length });
  }

  #updateCustomers(delta: number): void {
    const campaign = this.#state.campaign;
    if (campaign.step < CAMPAIGN_STEPS.trade) return;
    const queued = this.#customers.filter(({ phase }) => phase === "queueing");
    this.#customerSpawnRemaining -= delta;
    if (queued.length < 5 && this.#customerSpawnRemaining <= 0) {
      this.#customers.push({
        id: this.#nextEntityId++,
        position: { x: MARKET_TABLE.x - 7, z: MARKET_TABLE.z },
        heading: Math.PI / 2,
        phase: "queueing",
        serviceRemaining: 0.7,
      });
      this.#customerSpawnRemaining = 1.8;
    }
    const activeQueue = this.#customers.filter(
      ({ phase }) => phase === "queueing",
    );
    activeQueue.forEach((customer, index) => {
      const target = {
        x: MARKET_TABLE.x - 1.5 - index * 1.15,
        z: MARKET_TABLE.z,
      };
      moveTowards(customer, target, 2.4 * delta);
      customer.heading = Math.PI / 2;
    });
    const first = activeQueue[0];
    if (
      first &&
      !this.#routeThreatened(0) &&
      distance(first.position, {
        x: MARKET_TABLE.x - 1.5,
        z: MARKET_TABLE.z,
      }) < 0.15
    ) {
      first.serviceRemaining -= delta;
      if (first.serviceRemaining <= 0 && campaign.marketStock > 0) {
        campaign.marketStock -= 1;
        campaign.customersServed += 1;
        first.phase = "leaving";
        this.#spawnPickups("coin", SALE_OUTPUT, FOREST.salePrice, true);
        this.#events.add({ type: "customer.served", position: SALE_OUTPUT });
        this.#events.add({ type: "coin.produced", position: SALE_OUTPUT });
      }
    }
    for (let index = this.#customers.length - 1; index >= 0; index -= 1) {
      const customer = this.#customers[index]!;
      if (customer.phase !== "leaving") continue;
      customer.heading = -Math.PI / 2;
      if (
        moveTowards(
          customer,
          { x: MARKET_TABLE.x - 7, z: MARKET_TABLE.z - 1 },
          3 * delta,
        ) < 0.15
      )
        this.#customers.splice(index, 1);
    }
    if (
      campaign.step === CAMPAIGN_STEPS.trade &&
      campaign.customersServed >= campaignCosts().customers &&
      this.#state.tool.level >= 6
    )
      this.#advanceCampaign(CAMPAIGN_STEPS.sawmill);
  }

  #spawnAnimal(position?: Vector2, selectedRoute?: number): void {
    const route =
      selectedRoute === undefined
        ? Math.floor(this.#random.next() * BEAR_PATHS.length)
        : Math.max(0, Math.min(BEAR_PATHS.length - 1, selectedRoute));
    const path = BEAR_PATHS[route]!;
    const health =
      FOREST.bearHealth +
      this.#state.turret.level * FOREST.bearHealthPerTurretLevel;
    const id = this.#nextEntityId++;
    this.#animals.push({
      id,
      kind: "bear",
      position: position ? { ...position } : { ...path[0]! },
      heading: 0,
      health,
      maximumHealth: health,
      phase: position ? "attacking" : "approaching",
      route,
      waypoint: position ? path.length : 1,
    });
    if (position) this.#animalAttackOrigins.set(id, { ...position });
  }

  #updateAnimals(delta: number): void {
    if (this.#state.campaign.step < CAMPAIGN_STEPS.wildlife) return;
    this.#animalSpawnRemaining -= delta;
    const maximumAnimals =
      FOREST.maximumAnimalsByTurret[this.#state.turret.level]!;
    if (
      this.#animalSpawnRemaining <= 0 &&
      this.#animals.length < maximumAnimals
    ) {
      this.#spawnAnimal();
      this.#animalSpawnRemaining =
        FOREST.animalSpawnSecondsByTurret[this.#state.turret.level]!;
    }
    for (const animal of this.#animals) {
      if (animal.phase === "attacking") {
        const anchor =
          this.#animalAttackOrigins.get(animal.id) ??
          BEAR_PATHS[animal.route]!.at(-1)!;
        const attackAngle = this.#state.elapsed * 1.4 + animal.id * 1.7;
        const attackTarget = {
          x: anchor.x + Math.sin(attackAngle) * 0.55,
          z: anchor.z + Math.cos(attackAngle * 0.8) * 0.4,
        };
        animal.heading = Math.atan2(
          attackTarget.x - animal.position.x,
          attackTarget.z - animal.position.z,
        );
        moveTowards(animal, attackTarget, FOREST.bearSpeed * 0.38 * delta);
        continue;
      }
      const path = BEAR_PATHS[animal.route]!;
      const target = path[animal.waypoint];
      if (!target) {
        animal.phase = "attacking";
        this.#animalAttackOrigins.set(animal.id, { ...animal.position });
        continue;
      }
      animal.heading = Math.atan2(
        target.x - animal.position.x,
        target.z - animal.position.z,
      );
      if (moveTowards(animal, target, FOREST.bearSpeed * delta) < 0.08)
        animal.waypoint += 1;
    }
  }

  #pushPlayerFromAnimals(): void {
    const player = this.#state.player;
    for (const animal of this.#animals) {
      const separation = distance(player.position, animal.position);
      if (separation >= 1.05) continue;
      if (
        (this.#animalContactTimes.get(animal.id) ?? -Infinity) + 0.8 >
        this.#state.elapsed
      )
        continue;
      const direction =
        separation > 0.001
          ? {
              x: (player.position.x - animal.position.x) / separation,
              z: (player.position.z - animal.position.z) / separation,
            }
          : { x: -Math.sin(animal.heading), z: -Math.cos(animal.heading) };
      const target = {
        x: player.position.x + direction.x * 0.8,
        z: player.position.z + direction.z * 0.8,
      };
      if (
        canMoveTo(
          player.position,
          target,
          this.#trees,
          this.#state.campaign.step,
        )
      )
        player.position = target;
      this.#animalContactTimes.set(animal.id, this.#state.elapsed);
    }
  }

  #updateTurret(delta: number): void {
    if (this.#state.turret.level <= 0) return;
    const activeTurrets = TURRET_BUILDINGS.slice(0, this.#state.turret.level);
    activeTurrets.forEach((turret, index) => {
      this.#turretRemaining[index] = Math.max(
        0,
        this.#turretRemaining[index]! - delta,
      );
      if (this.#turretRemaining[index] > 0) return;
      const range = FOREST.turretRanges[index]!;
      const target = this.#animals
        .map((animal) => ({
          animal,
          distance: distance(animal.position, turret),
        }))
        .filter(({ distance: targetDistance }) => targetDistance <= range)
        .sort((left, right) => left.distance - right.distance)[0]?.animal;
      if (!target) return;
      this.#damageAnimal(target, FOREST.turretDamage[index]!, "turret");
      this.#turretRemaining[index] = FOREST.turretSecondsPerShot[index]!;
    });
  }

  #advanceCampaign(step: number): void {
    if (step <= this.#state.campaign.step) return;
    this.#state.campaign.step = step;
    for (const tree of this.#trees) {
      if (!isPointCleared(tree.position, step)) continue;
      tree.health = 0;
      tree.respawnRemaining = 0;
      tree.cleared = true;
    }
    this.#events.add({ type: "campaign.advanced", step });
  }

  #completeCampaign(): void {
    this.#state.campaign.completed = true;
    this.#events.add({ type: "campaign.completed" });
  }

  #completeCampaignIfReady(): void {
    if (
      this.#state.monument.stage < 3 ||
      this.#state.butcher.level < 3 ||
      this.#state.turret.level < 3
    )
      return;
    this.#completeCampaign();
  }

  #updateWorkers(delta: number): void {
    if (this.#routeThreatened(2)) return;
    const butcherLevel = Math.max(1, this.#state.butcher.level);
    const workerSpeed =
      FOREST.workerSpeed *
      (1 + FOREST.butcherWorkerSpeedBonuses[butcherLevel - 1]!);
    for (const worker of this.#workers) {
      worker.pathRetryRemaining = Math.max(
        0,
        worker.pathRetryRemaining - delta,
      );
      if (worker.phase === "seeking") {
        let tree: TreeState | undefined;
        if (worker.targetTreeId === undefined) {
          if (worker.pathRetryRemaining > 0) continue;
          tree = this.#chooseWorkerTree(worker);
          if (!tree) {
            worker.pathRetryRemaining = WORKER_PATH_RETRY_SECONDS;
            continue;
          }
        } else {
          tree = this.#trees.find(({ id }) => id === worker.targetTreeId);
        }
        if (!tree) {
          worker.targetTreeId = undefined;
          worker.path = [];
          worker.pathIndex = 0;
          continue;
        }
        if (this.#followWorkerPath(worker, workerSpeed * delta) < 1.05) {
          worker.phase = "harvesting";
          worker.actionRemaining = FOREST.workerHarvestSeconds;
        }
      } else if (worker.phase === "harvesting") {
        worker.actionRemaining -= delta;
        if (worker.actionRemaining > 0) continue;
        const tree = this.#trees.find(({ id }) => id === worker.targetTreeId);
        if (tree?.health) {
          this.#damageTree(tree, FOREST.treeHealth, "worker");
          worker.carriedWood =
            FOREST.workerCapacity +
            FOREST.butcherWorkerCapacityBonuses[butcherLevel - 1]!;
          worker.phase = "delivering";
          worker.path =
            this.#workerPath(worker.position, WORKER_DEPOT, 0.35) ?? [];
          worker.pathIndex = 0;
          worker.pathRetryRemaining = WORKER_PATH_RETRY_SECONDS;
        } else {
          worker.phase = "seeking";
          worker.targetTreeId = undefined;
        }
      } else {
        const depot = WORKER_DEPOT;
        if (this.#followWorkerPath(worker, workerSpeed * delta) >= 0.35)
          continue;
        if (this.#state.automationLevel >= 2) {
          for (let count = 0; count < worker.carriedWood; count += 1)
            this.#addConveyorItem("wood", depot, SAWMILL_BUILDING, "sawmill");
        } else {
          this.#spawnPickups("wood", depot, worker.carriedWood, true);
        }
        worker.carriedWood = 0;
        worker.phase = "seeking";
        worker.targetTreeId = undefined;
      }
    }
  }

  #followWorkerPath(worker: WorkerBody, movement: number): number {
    const destination =
      worker.phase === "delivering"
        ? WORKER_DEPOT
        : this.#trees.find(({ id }) => id === worker.targetTreeId)?.position;
    const goalRadius = worker.phase === "delivering" ? 0.35 : 1.05;
    if (
      destination &&
      !worker.path[worker.pathIndex] &&
      distance(worker.position, destination) >= goalRadius &&
      worker.pathRetryRemaining <= 0
    ) {
      worker.path =
        this.#workerPath(worker.position, destination, goalRadius) ?? [];
      worker.pathIndex = 0;
      worker.pathRetryRemaining = WORKER_PATH_RETRY_SECONDS;
    }
    const waypoint = worker.path[worker.pathIndex];
    if (waypoint && moveTowards(worker, waypoint, movement) < 0.08)
      worker.pathIndex += 1;
    return destination ? distance(worker.position, destination) : Infinity;
  }

  #workerPath(
    from: Vector2,
    to: Vector2,
    goalRadius: number,
  ): Vector2[] | undefined {
    return findPath(from, to, {
      step: 0.6,
      goalRadius,
      canOccupy: (position) =>
        canOccupyMap(position, WORKER_RADIUS, this.#state.campaign.step) &&
        blockingTrees(position, this.#trees, WORKER_RADIUS).length === 0,
    });
  }

  #chooseWorkerTree(worker: WorkerBody): TreeState | undefined {
    const reserved = new Set(
      this.#workers
        .filter((candidate) => candidate.id !== worker.id)
        .map(({ targetTreeId }) => targetTreeId)
        .filter((id): id is number => id !== undefined),
    );
    const candidates = this.#trees
      .filter(
        ({ id, health }) =>
          id >= WORKER_TREE_START_ID && health > 0 && !reserved.has(id),
      )
      .sort(
        (left, right) =>
          distance(worker.position, left.position) -
          distance(worker.position, right.position),
      );
    for (const tree of candidates.slice(0, 24)) {
      const path = this.#workerPath(worker.position, tree.position, 1.05);
      if (!path) continue;
      worker.targetTreeId = tree.id;
      worker.path = path;
      worker.pathIndex = 0;
      worker.pathRetryRemaining = 0;
      return tree;
    }
    return undefined;
  }

  #addConveyorItem(
    kind: ResourceKind,
    from: Vector2,
    to: Vector2,
    destination: ConveyorBody["destination"],
  ): void {
    this.#conveyorItems.push({
      id: this.#nextEntityId++,
      kind,
      from: { ...from },
      to: { ...to },
      progress: 0,
      destination,
    });
  }

  #updateConveyors(delta: number): void {
    for (let index = this.#conveyorItems.length - 1; index >= 0; index -= 1) {
      const item = this.#conveyorItems[index]!;
      const route =
        item.destination === "sawmill"
          ? WORKER_CONVEYOR_PATH
          : MONUMENT_CONVEYOR_PATH;
      item.progress += (delta * FOREST.conveyorSpeed) / pathLength(route);
      if (item.progress < 1) continue;
      this.#conveyorItems.splice(index, 1);
      if (item.destination === "sawmill") this.#state.sawmill.wood += 1;
      else this.#depositMonumentPlank();
    }
  }

  #updateSawmill(): void {
    if (this.#routeThreatened(1)) return;
    if (this.#state.sawmill.wood <= 0 || this.#sawmillRemaining > 0) return;
    this.#state.sawmill.wood -= 1;
    this.#sawmillRemaining =
      FOREST.sawmillSecondsPerPlank / (this.#state.monument.stage >= 3 ? 4 : 1);
    this.#events.add({ type: "sawmill.produced", position: SAWMILL_BUILDING });
    if (this.#state.automationLevel >= 3) {
      this.#addConveyorItem(
        "plank",
        SAWMILL_BUILDING,
        MONUMENT_BUILDING,
        "monument",
      );
    } else {
      this.#spawnPickups("plank", SAWMILL_OUTPUT, 1, true);
    }
  }

  #routeThreatened(route: number): boolean {
    return this.#animals.some(
      (animal) => animal.phase === "attacking" && animal.route === route,
    );
  }

  #load(save: SaveData): void {
    this.#seed = save.seed;
    this.#random.state = save.randomState;
    const state = structuredClone(save.state);
    Object.assign(this.#state.player, state.player);
    Object.assign(this.#state.inventory, state.inventory);
    this.#state.tool.level = state.tool.level;
    this.#state.tool.angle = state.tool.angle;
    Object.assign(this.#state.sawmill, state.sawmill);
    Object.assign(this.#state.monument, state.monument);
    Object.assign(this.#state.butcher, state.butcher);
    Object.assign(this.#state.turret, state.turret);
    Object.assign(this.#state.campaign, state.campaign);
    Object.assign(this.#state.payments, state.payments);
    this.#state.elapsed = state.elapsed;
    this.#state.automationLevel = state.automationLevel;
    this.#state.automationProgress = state.automationProgress;
    const savedTrees = new Map(state.trees.map((tree) => [tree.id, tree]));
    for (const tree of this.#trees) {
      const saved = savedTrees.get(tree.id);
      tree.health = saved?.health ?? FOREST.treeHealth;
      tree.respawnRemaining = saved?.respawnRemaining ?? 0;
      tree.cleared = saved?.cleared ?? false;
      if (isPointCleared(tree.position, state.campaign.step)) {
        tree.health = 0;
        tree.respawnRemaining = 0;
        tree.cleared = true;
      }
    }
    replace(
      this.#pickups,
      state.pickups.map((pickup) => ({
        ...pickup,
        velocity: { x: 0, y: 0, z: 0 },
        age: 1,
      })),
    );
    replace(
      this.#workers,
      state.workers.map((worker) => ({
        ...worker,
        actionRemaining: 0,
        path: [],
        pathIndex: 0,
        pathRetryRemaining: 0,
      })),
    );
    replace(
      this.#conveyorItems,
      state.conveyorItems.map((item) => ({
        ...item,
        destination: item.kind === "wood" ? "sawmill" : "monument",
      })),
    );
    replace(
      this.#customers,
      state.customers.map((customer) => ({
        ...customer,
        serviceRemaining: 0.7,
      })),
    );
    replace(
      this.#animals,
      state.animals.map((animal) => ({ ...animal })),
    );
    this.#animalAttackOrigins.clear();
    for (const animal of this.#animals)
      if (animal.phase === "attacking")
        this.#animalAttackOrigins.set(animal.id, { ...animal.position });
    this.#nextEntityId =
      Math.max(
        0,
        ...this.#pickups.map(({ id }) => id),
        ...this.#workers.map(({ id }) => id),
        ...this.#conveyorItems.map(({ id }) => id),
        ...this.#customers.map(({ id }) => id),
        ...this.#animals.map(({ id }) => id),
      ) + 1;
    this.#treeHitTimes.clear();
    this.#animalHitTimes.clear();
    this.#animalContactTimes.clear();
    this.#updateTools();
    this.#depositRemaining = 0;
    this.#depositDuration = 0;
    this.#depositZone = undefined;
    this.#animalSpawnRemaining = FOREST.animalSpawnSeconds;
    this.#turretRemaining.fill(0);
    this.#stepIndex = 0;
    this.#replayCommands.length = 0;
    this.#replayStart = structuredClone(save);
  }
}

function createTrees(health: number): TreeState[] {
  return FOREST_TREE_POSITIONS.map((position, index) => {
    return {
      id: index,
      position: { ...position },
      health,
      respawnRemaining: 0,
      cleared: false,
    };
  });
}

const PLAYER_RADIUS = 0.5;
const WORKER_RADIUS = 0.28;
const TREE_RADIUS = 0.4;
const AXE_LENGTH = 1.125;
const AXE_BLADE_LENGTH = 0.913;
const AXE_HANDLE_RADIUS = 0.12;
const AXE_BLADE_RADIUS = 0.16;
const WORKER_TREE_START_ID = Math.floor(FOREST_TREE_POSITIONS.length / 2);
const TREE_CELL_SIZE = 3;
const TREE_CELLS = createTreeCells();

function settledPickupPosition(
  kind: PickupKind,
  origin: Vector2,
  index: number,
): Vector2 & { y: number } {
  const offset = stackItemOffset(index);
  if (kind === "coin") {
    return {
      x: origin.x + offset.x,
      y: 0.99 + index * 0.115,
      z: origin.z + offset.z,
    };
  }
  return {
    x: origin.x + offset.x,
    y: 0.22 + index * 0.38,
    z: origin.z + offset.z,
  };
}

function distanceToSegment(point: Vector2, from: Vector2, to: Vector2): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared === 0) return distance(point, from);
  const amount = clamp(
    ((point.x - from.x) * dx + (point.z - from.z) * dz) / lengthSquared,
    0,
    1,
  );
  return Math.hypot(
    point.x - (from.x + dx * amount),
    point.z - (from.z + dz * amount),
  );
}

function isOnForestPath(position: Vector2, campaignStep: number): boolean {
  return FOREST_PATHS.some(
    ({ points, width, unlockStep }) =>
      campaignStep >= unlockStep &&
      points
        .slice(1)
        .some(
          (to, index) =>
            distanceToSegment(position, points[index]!, to) <= width / 2,
        ),
  );
}

function canMoveTo(
  from: Vector2,
  to: Vector2,
  trees: readonly TreeState[],
  campaignStep: number,
): boolean {
  if (!canOccupyStatic(to, campaignStep)) return false;
  const nextTrees = blockingTrees(to, trees);
  if (nextTrees.length === 0) return true;
  const currentBlockingTrees = blockingTrees(from, trees);
  if (currentBlockingTrees.length > 0)
    return (
      Math.min(...nextTrees.map((tree) => distance(to, tree.position))) >
      Math.min(
        ...currentBlockingTrees.map((tree) => distance(from, tree.position)),
      )
    );
  const currentTrees = new Set(currentBlockingTrees.map(({ id }) => id));
  return nextTrees.every(
    (tree) =>
      currentTrees.has(tree.id) &&
      distance(to, tree.position) > distance(from, tree.position),
  );
}

function blockingTrees(
  position: Vector2,
  trees: readonly TreeState[],
  actorRadius = PLAYER_RADIUS,
): TreeState[] {
  return nearbyTrees(position, trees, actorRadius + TREE_RADIUS).filter(
    (tree) =>
      tree.health > 0 &&
      distance(position, tree.position) < actorRadius + TREE_RADIUS,
  );
}

function createTreeCells(): Map<string, number[]> {
  const cells = new Map<string, number[]>();
  FOREST_TREE_POSITIONS.forEach((position, id) => {
    const key = treeCellKey(position.x, position.z);
    const ids = cells.get(key) ?? [];
    ids.push(id);
    cells.set(key, ids);
  });
  return cells;
}

function nearbyTrees(
  position: Vector2,
  trees: readonly TreeState[],
  radius: number,
): TreeState[] {
  const result: TreeState[] = [];
  const minimumX = Math.floor((position.x - radius) / TREE_CELL_SIZE);
  const maximumX = Math.floor((position.x + radius) / TREE_CELL_SIZE);
  const minimumZ = Math.floor((position.z - radius) / TREE_CELL_SIZE);
  const maximumZ = Math.floor((position.z + radius) / TREE_CELL_SIZE);
  for (let x = minimumX; x <= maximumX; x += 1) {
    for (let z = minimumZ; z <= maximumZ; z += 1) {
      const ids = TREE_CELLS.get(`${String(x)}:${String(z)}`) ?? [];
      for (const id of ids) {
        const tree = trees[id];
        if (tree) result.push(tree);
      }
    }
  }
  return result;
}

function treeCellKey(x: number, z: number): string {
  return `${String(Math.floor(x / TREE_CELL_SIZE))}:${String(Math.floor(z / TREE_CELL_SIZE))}`;
}

function canOccupyStatic(position: Vector2, campaignStep: number): boolean {
  return canOccupyMap(position, PLAYER_RADIUS, campaignStep);
}

function canOccupyMap(
  position: Vector2,
  radius: number,
  campaignStep: number,
): boolean {
  if (!insidePolygon(position, PLAYABLE_BOUNDARY)) return false;
  const blockedByMap = FOREST_COLLIDERS.some(
    (collider) =>
      campaignStep >= (collider.minimumStep ?? 0) &&
      campaignStep <= (collider.maximumStep ?? Number.POSITIVE_INFINITY) &&
      intersectsCollider(position, radius, collider),
  );
  if (blockedByMap) return false;
  return !PROGRESSION_GATES.some(
    ({
      from,
      to,
      width,
      minimumStep = 0,
      maximumStep = Number.POSITIVE_INFINITY,
      unlockStep,
    }) =>
      campaignStep >= minimumStep &&
      campaignStep <= maximumStep &&
      (campaignStep < unlockStep ||
        distance(position, {
          x: (from.x + to.x) / 2,
          z: (from.z + to.z) / 2,
        }) >= 3.2) &&
      intersectsCollider(position, radius, {
        shape: "rectangle",
        center: { x: (from.x + to.x) / 2, z: (from.z + to.z) / 2 },
        halfWidth: Math.abs(to.x - from.x) / 2 + width,
        halfDepth: Math.abs(to.z - from.z) / 2 + width,
      }),
  );
}

function insidePolygon(point: Vector2, polygon: readonly Vector2[]): boolean {
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
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function intersectsCollider(
  position: Vector2,
  radius: number,
  collider: MapCollider,
): boolean {
  if (collider.shape === "circle")
    return distance(position, collider.center) < radius + collider.radius;
  const closestX = clamp(
    position.x,
    collider.center.x - collider.halfWidth,
    collider.center.x + collider.halfWidth,
  );
  const closestZ = clamp(
    position.z,
    collider.center.z - collider.halfDepth,
    collider.center.z + collider.halfDepth,
  );
  return Math.hypot(position.x - closestX, position.z - closestZ) < radius;
}

function moveTowards(
  actor: { position: Vector2; heading: number },
  target: Vector2,
  amount: number,
): number {
  const dx = target.x - actor.position.x;
  const dz = target.z - actor.position.z;
  const remaining = Math.hypot(dx, dz);
  if (remaining === 0) return 0;
  actor.heading = Math.atan2(dx, dz);
  const movement = Math.min(remaining, amount);
  actor.position.x += (dx / remaining) * movement;
  actor.position.z += (dz / remaining) * movement;
  return remaining - movement;
}

function near(left: Vector2, right: Vector2, radius = 1.25): boolean {
  return distance(left, right) < radius;
}

function distance(left: Vector2, right: Vector2): number {
  return Math.hypot(left.x - right.x, left.z - right.z);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function replace<T>(target: T[], source: readonly T[]): void {
  target.splice(0, target.length, ...source);
}
