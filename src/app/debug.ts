import { CAMPAIGN_STEPS, campaignCosts } from "../game/campaign";
import { FOREST, ZONES } from "../game/content";
import type { SaveData, WorkerState } from "../game/model";
import type { GameSimulation } from "../game/simulation";
import type { GameView } from "../presentation/game-view";
import type { SaveStore } from "./save-store";

export interface DebugTools {
  update(delta: number): void;
}

interface DebugMetric {
  label: string;
  value: string;
  tone?: "good" | "warn";
}

export type DebugPreset = "early" | "mid" | "final";

export function createDebugTools(
  game: GameSimulation,
  view: GameView,
  saves: SaveStore,
): DebugTools {
  const parameters = new URLSearchParams(location.search);
  const requestedPreset = parameters.get("debugPreset");
  if (isDebugPreset(requestedPreset)) restorePreset(game, requestedPreset);
  const requestedZoom = Number(parameters.get("debugZoom"));
  if (Number.isFinite(requestedZoom) && requestedZoom >= 1)
    view.setDebugZoom(requestedZoom);

  const panel = document.createElement("details");
  panel.id = "debug-panel";
  panel.open = true;
  panel.innerHTML = `
    <summary>OUTILS DE MISE AU POINT</summary>
    <section><h3>États jouables</h3><div class="debug-actions" data-actions="presets"></div></section>
    <section><h3>Vue</h3><div class="debug-actions" data-actions="view"></div></section>
    <section><h3>Ressources et événements</h3><div class="debug-actions" data-actions="resources"></div></section>
    <section><h3>État courant</h3><div class="debug-metrics"></div></section>
  `;
  const presets = panel.querySelector<HTMLDivElement>(
    '[data-actions="presets"]',
  )!;
  const viewActions = panel.querySelector<HTMLDivElement>(
    '[data-actions="view"]',
  )!;
  const resources = panel.querySelector<HTMLDivElement>(
    '[data-actions="resources"]',
  )!;
  const metrics = panel.querySelector<HTMLDivElement>(".debug-metrics")!;

  addButton(presets, "Départ", () => restorePreset(game, "early"));
  addButton(presets, "Industrie moyenne", () => restorePreset(game, "mid"));
  addButton(presets, "Usine finale", () => restorePreset(game, "final"));
  addButton(presets, "Sauvegarde réelle", restoreSavedGame);

  addButton(viewActions, "Vue normale", () => view.setDebugZoom(1));
  addButton(viewActions, "Vue base", () => view.setDebugZoom(1.55));
  addButton(viewActions, "Vue globale", () => view.setDebugZoom(2.15));
  addButton(viewActions, "Centre", () => teleport(game, ZONES.camp));
  addButton(viewActions, "Marché", () => teleport(game, ZONES.sale));
  addButton(viewActions, "Industrie", () => teleport(game, ZONES.sawmill));
  addButton(viewActions, "Monument", () => teleport(game, ZONES.monument));

  const controls: [string, () => void][] = [
    ["+100 pièces", () => game.enqueue({ type: "debug.grant", coins: 100 })],
    ["+25 bois", () => game.enqueue({ type: "debug.grant", wood: 25 })],
    ["+25 planches", () => game.enqueue({ type: "debug.grant", planks: 25 })],
    ["+12 viandes", () => game.enqueue({ type: "debug.grant", meat: 12 })],
    ["Ours", () => game.enqueue({ type: "debug.spawn-animal" })],
    ["Hache +1", () => game.enqueue({ type: "tool.upgrade-requested" })],
    [
      "Ouvrier +1",
      () => game.enqueue({ type: "debug.progress", worker: true }),
    ],
    [
      "Automatisation +1",
      () => game.enqueue({ type: "debug.progress", automation: true }),
    ],
    [
      "Monument +1",
      () => game.enqueue({ type: "debug.progress", monument: true }),
    ],
    [
      "Tourelle +1",
      () => game.enqueue({ type: "debug.progress", turret: true }),
    ],
    ["Exporter sauvegarde", () => saves.exportSave(game.createSave())],
    ["Exporter replay", () => saves.exportReplay(game.createReplay())],
  ];
  for (const [label, action] of controls) addButton(resources, label, action);
  document.body.append(panel);

  let elapsed = 0;
  let frames = 0;
  let fps = 0;
  return {
    update(delta) {
      elapsed += delta;
      frames += 1;
      if (elapsed < 0.5) return;
      fps = Math.round(frames / elapsed);
      elapsed = 0;
      frames = 0;
      if (!panel.open) return;
      const { state } = game;
      const pickupAmount = state.pickups.reduce(
        (total, pickup) => total + pickup.amount,
        0,
      );
      renderMetrics(metrics, [
        { label: "FPS", value: String(fps), tone: fps >= 55 ? "good" : "warn" },
        {
          label: "Rendu",
          value: `${String(view.renderInfo.calls)} appels · ${String(view.renderInfo.triangles)} tris`,
        },
        { label: "Étape", value: String(state.campaign.step) },
        {
          label: "Automatisation",
          value: `${String(state.automationLevel)} / 3`,
        },
        { label: "Ouvriers", value: String(state.workers.length) },
        { label: "Clients", value: String(state.customers.length) },
        {
          label: "Ressources au sol",
          value: `${String(state.pickups.length)} piles · ${String(pickupAmount)} objets`,
        },
        {
          label: "Convoyeurs",
          value: `${String(state.conveyorItems.length)} objets`,
        },
        {
          label: "Scierie",
          value: `${String(state.sawmill.wood)} bois en attente`,
        },
        {
          label: "Monument",
          value: `${String(state.monument.stage)} / 3 · ${String(state.monument.progress)} planches`,
        },
        {
          label: "Défense",
          value: `${String(state.turret.level)} / 3 · ${state.wildlife.phase}`,
        },
      ]);
    },
  };
}

function addButton(
  parent: HTMLElement,
  label: string,
  action: () => void,
): void {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", action);
  parent.append(button);
}

function restorePreset(game: GameSimulation, preset: DebugPreset): void {
  document.documentElement.dataset.debugPreset = preset;
  game.restore(createDebugPreset(game.createSave(), preset));
}

export function createDebugPreset(
  source: SaveData,
  preset: DebugPreset,
): SaveData {
  const save = structuredClone(source);
  resetDynamicState(save);
  if (preset === "early") {
    save.state.campaign.step = CAMPAIGN_STEPS.camp;
    save.state.player.position = { ...ZONES.camp };
  } else if (preset === "mid") {
    applyEstablishedBase(save, CAMPAIGN_STEPS.convoy, 2, 6);
    save.state.monument.stage = 0;
    save.state.campaign.exitPlanks = Math.floor(campaignCosts().exitPlanks / 2);
  } else {
    applyEstablishedBase(save, CAMPAIGN_STEPS.defense, 3, FOREST.maxWorkers);
    save.state.monument = { stage: 3, progress: 0 };
    save.state.butcher = {
      level: 3,
      planks: 0,
      rationLevel: 2,
      rations: 0,
      stock: 18,
    };
    save.state.turret = { level: 3, coins: 0, planks: 0 };
    save.state.campaign.meatSold = 48;
  }
  return save;
}

function restoreSavedGame(): void {
  const url = new URL(location.href);
  url.searchParams.delete("debugPreset");
  url.searchParams.delete("debugZoom");
  location.assign(url);
}

function isDebugPreset(value: string | null): value is DebugPreset {
  return value === "early" || value === "mid" || value === "final";
}

function applyEstablishedBase(
  save: SaveData,
  step: number,
  automation: number,
  workers: number,
): void {
  const costs = campaignCosts();
  save.state.campaign = {
    ...save.state.campaign,
    step,
    campWood: costs.campWood,
    marketWood: costs.marketWood,
    sawmillWood: costs.sawmillWood,
    marketStock: 120,
    customersServed: 40,
    exitPlanks: 0,
  };
  save.state.player.position = { x: 0, z: 0 };
  save.state.inventory = { coins: 100, wood: 80, planks: 80, meat: 20 };
  save.state.tool.level = 6;
  save.state.automationLevel = automation;
  save.state.sawmill.wood = 30;
  save.state.workers = createWorkers(workers);
}

function resetDynamicState(save: SaveData): void {
  save.state.elapsed = 0;
  save.state.player = {
    position: { ...ZONES.camp },
    heading: 0,
    trailMomentum: 0,
  };
  save.state.campaign = {
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
  };
  save.state.inventory = { coins: 0, wood: 0, planks: 0, meat: 0 };
  save.state.payments = { toolCoins: 0, workerCoins: 0 };
  save.state.tool.level = 1;
  save.state.tool.angle = 0;
  save.state.trees = save.state.trees.map((tree) => ({
    ...tree,
    health: FOREST.treeHealth,
    respawnRemaining: 0,
    cleared: false,
  }));
  save.state.automationLevel = 0;
  save.state.automationProgress = 0;
  save.state.sawmill = { wood: 0, planks: 0 };
  save.state.monument = { stage: 0, progress: 0 };
  save.state.butcher = {
    level: 0,
    planks: 0,
    rationLevel: 0,
    rations: 0,
    stock: 0,
  };
  save.state.turret = { level: 0, coins: 0, planks: 0 };
  save.state.workers = [];
  save.state.pickups = [];
  save.state.conveyorItems = [];
  save.state.customers = [];
  save.state.animals = [];
  save.state.wildlife = {
    phase: "dormant",
    lane: 0,
    wave: 0,
    remaining: 0,
    spawned: 0,
    target: 0,
  };
}

function createWorkers(count: number): WorkerState[] {
  return Array.from({ length: count }, (_, index) => ({
    id: 9000 + index,
    position: {
      x: ZONES.worker.x + (index % 3) * 0.45,
      z: ZONES.worker.z + Math.floor(index / 3) * 0.45,
    },
    heading: 0,
    carriedWood: 0,
    carriedMeat: 0,
    phase: "seeking" as const,
  }));
}

function teleport(
  game: GameSimulation,
  position: { x: number; z: number },
): void {
  game.state.player.position = { ...position };
}

function renderMetrics(parent: HTMLElement, values: DebugMetric[]): void {
  parent.replaceChildren(
    ...values.map(({ label, value, tone }) => {
      const metric = document.createElement("div");
      metric.className = `debug-metric${tone ? ` is-${tone}` : ""}`;
      const name = document.createElement("span");
      name.textContent = label;
      const result = document.createElement("strong");
      result.textContent = value;
      metric.append(name, result);
      return metric;
    }),
  );
}
