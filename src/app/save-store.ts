import type { ReplayData, SaveData } from "../game/simulation";

const SAVE_KEY = "slopfarm.save";

export class SaveStore {
  load(): SaveData | undefined {
    const encoded = localStorage.getItem(SAVE_KEY);
    if (!encoded) return undefined;
    try {
      const value: unknown = JSON.parse(encoded);
      return isSaveData(value) ? value : undefined;
    } catch {
      return undefined;
    }
  }

  save(data: SaveData): void {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  reset(): void {
    localStorage.removeItem(SAVE_KEY);
  }

  exportSave(data: SaveData): void {
    download("slopfarm-save.json", data);
  }

  exportReplay(data: ReplayData): void {
    download("slopfarm-replay.json", data);
  }

  async importSave(file: File): Promise<SaveData> {
    const value: unknown = JSON.parse(await file.text());
    if (!isSaveData(value)) throw new Error("Sauvegarde Slopfarm invalide.");
    this.save(value);
    return value;
  }
}

export function isSaveData(value: unknown): value is SaveData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SaveData>;
  if (
    typeof candidate.seed !== "number" ||
    typeof candidate.randomState !== "number"
  )
    return false;
  const state: unknown = candidate.state;
  if (!isRecord(state)) return false;
  const player = state.player;
  const inventory = state.inventory;
  const payments = state.payments;
  const tool = state.tool;
  const campaign = state.campaign;
  const sawmill = state.sawmill;
  const monument = state.monument;
  const butcher = state.butcher;
  const turret = state.turret;
  const wildlife = state.wildlife;
  return (
    isNonNegativeNumber(state.elapsed) &&
    isRecord(player) &&
    isVector2(player.position) &&
    isNumber(player.heading) &&
    isNumberBetween(player.trailMomentum, 0, 1) &&
    isRecord(inventory) &&
    isNonNegativeInteger(inventory.coins) &&
    isNonNegativeInteger(inventory.wood) &&
    isNonNegativeInteger(inventory.planks) &&
    isNonNegativeInteger(inventory.meat) &&
    isRecord(tool) &&
    isIntegerBetween(tool.level, 1, 6) &&
    isNumber(tool.angle) &&
    Array.isArray(tool.positions) &&
    tool.positions.every(isVector2) &&
    isRecord(campaign) &&
    isIntegerBetween(campaign.step, 0, 9) &&
    typeof campaign.completed === "boolean" &&
    isNonNegativeInteger(campaign.campWood) &&
    isNonNegativeInteger(campaign.marketWood) &&
    isNonNegativeInteger(campaign.sawmillWood) &&
    isNonNegativeInteger(campaign.marketStock) &&
    isNonNegativeInteger(campaign.customersServed) &&
    isNonNegativeInteger(campaign.exitPlanks) &&
    isNonNegativeInteger(campaign.butcherWood) &&
    isNonNegativeInteger(campaign.meatSold) &&
    isNonNegativeInteger(campaign.animalsDefeated) &&
    isIntegerBetween(state.automationLevel, 0, 3) &&
    isNonNegativeInteger(state.automationProgress) &&
    isRecord(payments) &&
    isNonNegativeInteger(payments.toolCoins) &&
    isNonNegativeInteger(payments.workerCoins) &&
    isRecord(sawmill) &&
    isNonNegativeInteger(sawmill.wood) &&
    isNonNegativeInteger(sawmill.planks) &&
    isRecord(monument) &&
    isIntegerBetween(monument.stage, 0, 3) &&
    isNonNegativeInteger(monument.progress) &&
    isRecord(butcher) &&
    isIntegerBetween(butcher.level, 0, 3) &&
    isNonNegativeInteger(butcher.planks) &&
    isIntegerBetween(butcher.rationLevel, 0, 2) &&
    isNonNegativeInteger(butcher.rations) &&
    isNonNegativeInteger(butcher.stock) &&
    isRecord(turret) &&
    isIntegerBetween(turret.level, 0, 3) &&
    isNonNegativeInteger(turret.coins) &&
    isNonNegativeInteger(turret.planks) &&
    isRecord(wildlife) &&
    (wildlife.phase === "dormant" ||
      wildlife.phase === "calm" ||
      wildlife.phase === "warning" ||
      wildlife.phase === "active" ||
      wildlife.phase === "recovery") &&
    isIntegerBetween(wildlife.lane, 0, 2) &&
    isNonNegativeInteger(wildlife.wave) &&
    isNonNegativeNumber(wildlife.remaining) &&
    isNonNegativeInteger(wildlife.spawned) &&
    isNonNegativeInteger(wildlife.target) &&
    Array.isArray(state.trees) &&
    state.trees.every(
      (tree) =>
        isRecord(tree) &&
        isNumber(tree.id) &&
        isVector2(tree.position) &&
        isNumber(tree.health) &&
        isNumber(tree.respawnRemaining) &&
        typeof tree.cleared === "boolean",
    ) &&
    Array.isArray(state.pickups) &&
    state.pickups.every(
      (pickup) =>
        isRecord(pickup) &&
        isNumber(pickup.id) &&
        (pickup.kind === "coin" ||
          pickup.kind === "wood" ||
          pickup.kind === "plank" ||
          pickup.kind === "meat") &&
        isNonNegativeInteger(pickup.amount) &&
        pickup.amount > 0 &&
        typeof pickup.fixed === "boolean" &&
        isVector3(pickup.position) &&
        isNumber(pickup.rotation),
    ) &&
    Array.isArray(state.workers) &&
    state.workers.every(
      (worker) =>
        isRecord(worker) &&
        isNumber(worker.id) &&
        isVector2(worker.position) &&
        isNumber(worker.heading) &&
        isNonNegativeInteger(worker.carriedWood) &&
        isNonNegativeInteger(worker.carriedMeat) &&
        (worker.phase === "seeking" ||
          worker.phase === "harvesting" ||
          worker.phase === "delivering" ||
          worker.phase === "collecting-meat" ||
          worker.phase === "delivering-meat"),
    ) &&
    Array.isArray(state.conveyorItems) &&
    state.conveyorItems.every(
      (item) =>
        isRecord(item) &&
        isNumber(item.id) &&
        (item.kind === "wood" || item.kind === "plank") &&
        isVector2(item.from) &&
        isVector2(item.to) &&
        isNumber(item.progress) &&
        (item.destination === "sawmill" ||
          item.destination === "market" ||
          item.destination === "convoy" ||
          item.destination === "monument"),
    ) &&
    Array.isArray(state.customers) &&
    state.customers.every(
      (customer) =>
        isRecord(customer) &&
        isNumber(customer.id) &&
        isVector2(customer.position) &&
        isNumber(customer.heading) &&
        (customer.phase === "queueing" || customer.phase === "leaving"),
    ) &&
    Array.isArray(state.animals) &&
    state.animals.every(
      (animal) =>
        isRecord(animal) &&
        isNumber(animal.id) &&
        animal.kind === "bear" &&
        isVector2(animal.position) &&
        isNumber(animal.heading) &&
        isNumber(animal.health) &&
        isNumber(animal.maximumHealth) &&
        (animal.phase === "approaching" || animal.phase === "attacking") &&
        isNumber(animal.route) &&
        isNumber(animal.waypoint),
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return isNumber(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return isNonNegativeNumber(value) && Number.isInteger(value);
}

function isNumberBetween(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return isNumber(value) && value >= minimum && value <= maximum;
}

function isIntegerBetween(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return Number.isInteger(value) && isNumberBetween(value, minimum, maximum);
}

function isVector2(value: unknown): value is { x: number; z: number } {
  return isRecord(value) && isNumber(value.x) && isNumber(value.z);
}

function isVector3(
  value: unknown,
): value is { x: number; y: number; z: number } {
  return (
    isRecord(value) &&
    isNumber(value.x) &&
    isNumber(value.y) &&
    isNumber(value.z)
  );
}

function download(name: string, value: SaveData | ReplayData): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
