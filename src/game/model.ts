export interface Vector2 {
  x: number;
  z: number;
}

export type ResourceKind = "wood" | "plank" | "meat";
export type PickupKind = ResourceKind | "coin";

export type GameCommand =
  | { type: "movement.changed"; direction: Vector2 }
  | { type: "tool.upgrade-requested" }
  | {
      type: "debug.grant";
      coins?: number;
      wood?: number;
      planks?: number;
      meat?: number;
    }
  | { type: "debug.spawn-animal"; position?: Vector2; route?: number }
  | {
      type: "debug.progress";
      automation?: boolean;
      monument?: boolean;
      worker?: boolean;
      turret?: boolean;
    }
  | { type: "save.loaded"; data: SaveData };

export type GameEvent =
  | { type: "tree.hit"; position: Vector2; source: "player" | "worker" }
  | { type: "tree.destroyed"; position: Vector2 }
  | { type: "tree.regrown"; position: Vector2 }
  | {
      type: "pickup.collected";
      kind: PickupKind;
      position: Vector2;
      total: number;
    }
  | {
      type: "resource.deposited";
      kind: PickupKind;
      target: ZoneKind;
      position: Vector2;
    }
  | { type: "coin.produced"; position: Vector2 }
  | { type: "tool.upgraded"; level: number }
  | { type: "worker.hired"; count: number }
  | { type: "automation.upgraded"; level: number }
  | { type: "monument.advanced"; stage: number }
  | { type: "sawmill.produced"; position: Vector2 }
  | { type: "campaign.advanced"; step: number }
  | { type: "customer.served"; position: Vector2 }
  | { type: "animal.hit"; position: Vector2; source: "player" | "turret" }
  | { type: "animal.destroyed"; position: Vector2 }
  | { type: "turret.upgraded"; level: number }
  | { type: "monument.activated"; position: Vector2 }
  | { type: "campaign.completed" };

export type ZoneKind =
  | "camp"
  | "sale"
  | "sawmill"
  | "tool"
  | "worker"
  | "automation"
  | "monument"
  | "departure"
  | "butcher"
  | "canteen"
  | "turret";

export interface AnimalState {
  id: number;
  kind: "bear";
  position: Vector2;
  heading: number;
  health: number;
  maximumHealth: number;
  phase: "approaching" | "attacking";
  route: number;
  waypoint: number;
}

export interface WildlifeState {
  phase: "dormant" | "calm" | "warning" | "active" | "recovery";
  lane: number;
  wave: number;
  remaining: number;
  spawned: number;
  target: number;
}

export interface CustomerState {
  id: number;
  position: Vector2;
  heading: number;
  phase: "queueing" | "leaving";
}

export interface TreeState {
  id: number;
  position: Vector2;
  health: number;
  respawnRemaining: number;
  cleared: boolean;
}

export interface PickupState {
  id: number;
  kind: PickupKind;
  amount: number;
  fixed: boolean;
  position: Vector2 & { y: number };
  rotation: number;
}

export interface WorkerState {
  id: number;
  position: Vector2;
  heading: number;
  carriedWood: number;
  carriedMeat: number;
  phase:
    | "seeking"
    | "harvesting"
    | "delivering"
    | "collecting-meat"
    | "delivering-meat";
}

export interface ConveyorItemState {
  id: number;
  kind: ResourceKind;
  from: Vector2;
  to: Vector2;
  progress: number;
  destination: "sawmill" | "convoy" | "monument";
}

export interface GameState {
  elapsed: number;
  player: { position: Vector2; heading: number; trailMomentum: number };
  inventory: { coins: number; wood: number; planks: number; meat: number };
  tool: { level: number; angle: number; positions: readonly Vector2[] };
  trees: readonly TreeState[];
  pickups: readonly PickupState[];
  workers: readonly WorkerState[];
  conveyorItems: readonly ConveyorItemState[];
  customers: readonly CustomerState[];
  animals: readonly AnimalState[];
  wildlife: WildlifeState;
  campaign: {
    step: number;
    completed: boolean;
    campWood: number;
    marketWood: number;
    sawmillWood: number;
    marketStock: number;
    customersServed: number;
    exitPlanks: number;
    butcherWood: number;
    meatSold: number;
    animalsDefeated: number;
  };
  automationLevel: number;
  automationProgress: number;
  payments: { toolCoins: number; workerCoins: number };
  sawmill: { wood: number; planks: number };
  monument: { stage: number; progress: number };
  butcher: {
    level: number;
    planks: number;
    rationLevel: number;
    rations: number;
    stock: number;
  };
  turret: { level: number; coins: number; planks: number };
}

export interface SaveData {
  seed: number;
  randomState: number;
  state: GameState;
}

export interface ReplayData {
  seed: number;
  initial: SaveData;
  commands: { step: number; command: GameCommand }[];
}
