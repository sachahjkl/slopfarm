import * as THREE from "three/webgpu";
import { WebGLRenderer } from "three";
import { CAMERA_OFFSET } from "../app/camera-layout";
import { renderPixelRatio } from "../app/render-quality";
import {
  BUTCHER_BUILDING,
  FOREST,
  MARKET_CONVEYOR_PATH,
  MARKET_CONVEYOR_ELEVATION,
  MARKET_TABLE,
  MONUMENT_BUILDING,
  MONUMENT_CONVEYOR_PATH,
  SAWMILL_BUILDING,
  SAWMILL_OUTPUT,
  TURRET_BUILDINGS,
  WORKER_DEPOT,
  WORKER_CONVEYOR_PATH,
  ZONES,
  toolOrbitRadius,
  zonePosition,
} from "../game/content";
import { CAMPAIGN_STEPS, campaignCosts } from "../game/campaign";
import {
  FOREST_AREAS,
  FOREST_BOUNDARY,
  FOREST_DECORATIONS,
  FOREST_FENCES,
  FOREST_PATHS,
  FOREST_RIDGE_POSITIONS,
  FOREST_TRAIL_BARRIERS,
  FOREST_TREE_POSITIONS,
  FOREST_YARDS,
  PROGRESSION_GATES,
} from "../game/forest-map";
import type { GameEvent, GameState, ZoneKind } from "../game/simulation";
import { Effects } from "./effects";
import { stackItemOffset } from "../game/stack-layout";
import { isGateApproached } from "./gate-activity";
import {
  cloneAsset,
  createToonMaterial,
  loadForestAssets,
  type ForestAssets,
} from "./forest-assets";
import {
  CarryStackView,
  createCarriedPlankGeometry,
  createCarriedWoodGeometry,
  ResourceView,
} from "./resource-view";
import { TreeFieldView } from "./tree-field-view";
import { objectiveHistoryEntry } from "./objective-journal";
import { sawmillAngularSpeed } from "./sawmill-motion";
import { ANIMAL_HIT_DURATION, animalHitPose } from "./animal-hit-motion";
import { clampOverlayPosition } from "./service-overlay";
import { RENDER_LAYER } from "./render-layers";
import { pausedProductionRoutes } from "./lane-pause";
import {
  ANIMAL_DEFEAT_DURATION,
  animalDefeatPose,
} from "./animal-defeat-motion";

export interface HudElements {
  coins: HTMLElement;
  wood: HTMLElement;
  planks: HTMLElement;
  meat: HTMLElement;
  tool: HTMLElement;
  workers: HTMLElement;
  automation: HTMLElement;
  monument: HTMLElement;
  toolCost: HTMLElement;
  workerCost: HTMLElement;
  automationCost: HTMLElement;
  monumentCost: HTMLElement;
  objective: HTMLElement;
  objectiveDetail: HTMLElement;
  objectiveHistory: HTMLOListElement;
}

export interface VisualSettings {
  reducedMotion: boolean;
  quality: "low" | "high";
}

interface ServiceSign {
  padCanvas: HTMLCanvasElement;
  padTexture: THREE.CanvasTexture;
  color: number;
  key: string;
}

interface ServiceSignData {
  title: string;
  level: string;
  current:
    | "wood"
    | "coin"
    | "plank"
    | "meat"
    | "tool"
    | "worker"
    | "gear"
    | "monument";
  detail: string;
  progress: number;
}

const SERVICE_ICON_FILES: Record<ServiceSignData["current"], string> = {
  wood: "wood.svg",
  coin: "coin.svg",
  plank: "plank.svg",
  meat: "meat.svg",
  tool: "tool.svg",
  worker: "worker.svg",
  gear: "gear.svg",
  monument: "monument.svg",
};
const SERVICE_ICON_IMAGES = new Map<
  ServiceSignData["current"],
  HTMLImageElement
>();

async function loadUiArt(): Promise<void> {
  const font = document.fonts.load("900 58px Figtree");
  const icons = Object.entries(SERVICE_ICON_FILES).map(
    ([kind, file]) =>
      new Promise<void>((resolve) => {
        const image = new Image();
        image.onload = (): void => resolve();
        image.onerror = (): void => resolve();
        image.src = `${import.meta.env.BASE_URL}art/icons/${file}`;
        SERVICE_ICON_IMAGES.set(kind as ServiceSignData["current"], image);
      }),
  );
  await Promise.all([font, ...icons]);
}

export class GameView {
  readonly #scene = new THREE.Scene();
  readonly #world = createGround();
  readonly #camera = new THREE.OrthographicCamera(-9, 9, 9, -9, 0.1, 100);
  readonly #sun = new THREE.DirectionalLight(0xfff1c4, 3.5);
  readonly #sunTarget = new THREE.Object3D();
  #canvas: HTMLCanvasElement;
  #renderer: THREE.WebGPURenderer | WebGLRenderer;
  readonly #player = createPlayer();
  readonly #effects: Effects;
  readonly #hud: HudElements;
  readonly #workerViews = new Map<number, THREE.Group>();
  readonly #customerViews = new Map<number, THREE.Group>();
  readonly #animalViews = new Map<number, THREE.Group>();
  readonly #pendingRemovedAnimalViews: THREE.Group[] = [];
  readonly #defeatedAnimalViews: {
    view: THREE.Group;
    remaining: number;
    position: { x: number; z: number };
  }[] = [];
  readonly #serviceSigns = new Map<ZoneKind, ServiceSign>();
  readonly #serviceMarkers = new Map<ZoneKind, THREE.Group>();
  readonly #serviceBubble = createServiceBubble();
  readonly #progressionGates: {
    view: THREE.Group;
    minimumStep: number;
    maximumStep?: number;
    unlockStep: number;
  }[] = [];
  readonly #axes: THREE.Group[] = [];
  readonly #axeRig = new THREE.Group();
  readonly #speedTrailMaterial = new THREE.MeshBasicMaterial({
    color: 0xffe784,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  readonly #speedTrails = createSpeedTrails(this.#speedTrailMaterial);
  readonly #treeField: TreeFieldView;
  readonly #resourceView: ResourceView;
  readonly #carryStack: CarryStackView;
  readonly #monument = createMonument();
  readonly #conveyors = new THREE.Group();
  readonly #industryProps = new THREE.Group();
  readonly #sawmillPallet = createSawmillPallet();
  readonly #workerDock = createWorkerDock();
  readonly #customerQueue = createCustomerQueue();
  readonly #marketStock = createMarketStock();
  readonly #baseStations = createBaseStations();
  readonly #butcherBuilding = createButcherBuilding();
  readonly #turretBuildings = TURRET_BUILDINGS.map(() =>
    createTurretBuilding(),
  );
  readonly #lanePauseIndicators = [
    createLaneIndicator(MARKET_TABLE, "!  EN PAUSE", 0xffb347),
    createLaneIndicator(SAWMILL_BUILDING, "!  EN PAUSE", 0xffb347),
    createLaneIndicator(WORKER_DEPOT, "!  EN PAUSE", 0xffb347),
  ];
  readonly #laneWarningIndicators = [
    createLaneIndicator(MARKET_TABLE, "!  ATTAQUE IMMINENTE", 0xf06a52),
    createLaneIndicator(SAWMILL_BUILDING, "!  ATTAQUE IMMINENTE", 0xf06a52),
    createLaneIndicator(WORKER_DEPOT, "!  ATTAQUE IMMINENTE", 0xf06a52),
  ];
  readonly #saleBuilding = new THREE.Group();
  readonly #sawmillBuilding = createBuilding(0xd98442, 1.8, 1.35);
  readonly #sawmillMotion = createSawmillMotion();
  readonly #monumentMotion = createMonumentMotion();
  readonly #monumentBeacon = createMonumentBeacon();
  readonly #geometries = {
    wood: createCarriedWoodGeometry(),
    plank: createCarriedPlankGeometry(),
    coin: new THREE.CylinderGeometry(0.24, 0.24, 0.09, 16),
    meat: new THREE.CapsuleGeometry(0.18, 0.32, 4, 8),
  };
  readonly #materials = {
    wood: [
      createToonMaterial({ color: 0x9f5e35, roughness: 0.9 }),
      createToonMaterial({ color: 0xe0a864, roughness: 0.86 }),
    ],
    plank: [
      createToonMaterial({ color: 0xe3ad69, roughness: 0.86 }),
      createToonMaterial({ color: 0x6f4932, roughness: 0.92 }),
    ],
    coin: createToonMaterial({
      color: 0xffce3a,
      metalness: 0.45,
      roughness: 0.3,
    }),
    meat: createToonMaterial({ color: 0xc6534f, roughness: 0.86 }),
  };
  #shownAutomation = -1;
  #shownMonument = -1;
  #shownMarketStock = -1;
  #shownCampaignStep = -1;
  #campaignStepShownAt = 0;
  #shownObjective = "";
  #objectiveShownAt = 0;
  #quality: "low" | "high";
  readonly #settings: VisualSettings;
  #celebrationDurationRemaining = 0;
  #celebrationBurstRemaining = 0;
  #assets: ForestAssets | undefined;
  #monumentMixer: THREE.AnimationMixer | undefined;
  #lastPlayerPosition = { x: 0, z: 0 };
  #playerMotion = 0;
  #debugZoom = 1;

  constructor(
    canvas: HTMLCanvasElement,
    hud: HudElements,
    settings: VisualSettings,
  ) {
    this.#canvas = canvas;
    this.#hud = hud;
    this.#settings = settings;
    this.#quality = settings.quality;
    const forceWebGL =
      new URLSearchParams(location.search).has("webgl") ||
      !("gpu" in navigator);
    this.#renderer = forceWebGL
      ? new WebGLRenderer({ canvas, antialias: true })
      : new THREE.WebGPURenderer({ canvas, antialias: true });
    this.#configureRenderer();
    this.#scene.background = new THREE.Color(0x35563a);
    this.#scene.fog = new THREE.FogExp2(0x527a59, 0.022);
    this.#camera.position.set(
      CAMERA_OFFSET.x,
      CAMERA_OFFSET.y,
      CAMERA_OFFSET.z,
    );
    this.#scene.add(new THREE.HemisphereLight(0xdff6ff, 0x50833c, 2.2));
    this.#sun.position.set(-10, 18, 8);
    this.#sun.castShadow = false;
    this.#sun.shadow.mapSize.set(2048, 2048);
    this.#sun.shadow.bias = -0.0004;
    this.#sun.shadow.normalBias = 0.025;
    this.#sun.shadow.camera.left = -18;
    this.#sun.shadow.camera.right = 18;
    this.#sun.shadow.camera.top = 18;
    this.#sun.shadow.camera.bottom = -18;
    this.#sun.shadow.camera.near = 1;
    this.#sun.shadow.camera.far = 60;
    this.#sun.target = this.#sunTarget;
    this.#scene.add(this.#sun, this.#sunTarget, this.#world, this.#player);
    this.#player.add(this.#speedTrails, this.#axeRig);
    const resources = {
      geometries: this.#geometries,
      materials: this.#materials,
    };
    this.#treeField = new TreeFieldView(
      this.#scene,
      FOREST_TREE_POSITIONS.length,
    );
    this.#resourceView = new ResourceView(this.#scene, resources);
    this.#carryStack = new CarryStackView(this.#player);
    this.#effects = new Effects(this.#scene, () => settings.reducedMotion);
    document.body.append(this.#serviceBubble);
    this.#createBase();
    this.resize();
  }

  get renderInfo(): { calls: number; triangles: number } {
    return {
      calls: this.#renderer.info.render.calls,
      triangles: this.#renderer.info.render.triangles,
    };
  }

  get canvas(): HTMLCanvasElement {
    return this.#canvas;
  }

  setDebugZoom(multiplier: number): void {
    this.#debugZoom = THREE.MathUtils.clamp(multiplier, 1, 2.5);
    this.resize();
  }

  async initialize(): Promise<void> {
    await this.#initializeRenderer();
    const [, assets] = await Promise.all([loadUiArt(), loadForestAssets()]);
    for (const sign of this.#serviceSigns.values()) sign.key = "";
    this.#assets = assets;
    this.#applyAssets(assets);
  }

  async #initializeRenderer(): Promise<void> {
    if (!(this.#renderer instanceof THREE.WebGPURenderer)) return;
    try {
      await this.#renderer.init();
    } catch (cause) {
      console.warn("WebGPU indisponible. Bascule vers WebGL.", cause);
      await this.#renderer.dispose();
      const replacement = this.#canvas.cloneNode(false) as HTMLCanvasElement;
      this.#canvas.replaceWith(replacement);
      this.#canvas = replacement;
      this.#renderer = new WebGLRenderer({
        canvas: replacement,
        antialias: true,
      });
      this.#configureRenderer();
      this.resize();
    }
  }

  #configureRenderer(): void {
    this.#renderer.setPixelRatio(
      renderPixelRatio(
        this.#quality,
        devicePixelRatio,
        innerWidth,
        innerHeight,
      ),
    );
    this.#renderer.shadowMap.enabled = false;
  }

  #applyAssets(assets: ForestAssets): void {
    const playerVisual = this.#player.getObjectByName("player-visual");
    if (playerVisual) {
      playerVisual.clear();
      playerVisual.add(cloneAsset(assets.adventurer));
      playerVisual.traverse((child) => {
        child.renderOrder = RENDER_LAYER.player;
      });
    }
    this.#saleBuilding.clear();
    for (const sale of assets.sales) {
      const tier = cloneAsset(sale);
      tier.visible = false;
      this.#saleBuilding.add(tier);
    }
    this.#saleBuilding.position.y = 0;
    this.#industryProps.clear();
    const industryLayout = [
      {
        asset: assets.industry.rack,
        position: { x: 7.15, z: 1.35 },
        rotation: 0,
        automation: 1,
        step: CAMPAIGN_STEPS.automation,
      },
      {
        asset: assets.industry.buffer,
        position: { x: 7.25, z: -0.75 },
        rotation: 0,
        automation: 2,
        step: CAMPAIGN_STEPS.worker,
      },
      {
        asset: assets.industry.sorter,
        position: { x: 8.8, z: 5 },
        rotation: Math.PI / 2,
        automation: 3,
        step: CAMPAIGN_STEPS.convoy,
      },
      {
        asset: assets.industry.crane,
        position: { x: 6.65, z: -3.15 },
        rotation: 0,
        automation: 3,
        step: CAMPAIGN_STEPS.convoy,
      },
      {
        asset: assets.industry.dock,
        position: { x: -2.8, z: -8.65 },
        rotation: Math.PI,
        automation: 3,
        step: CAMPAIGN_STEPS.convoy,
      },
      {
        asset: assets.sales[1]!,
        position: { x: -6.2, z: 0.85 },
        rotation: 0,
        automation: 2,
        step: CAMPAIGN_STEPS.worker,
      },
      {
        asset: assets.sales[2]!,
        position: { x: -6.2, z: 4.05 },
        rotation: Math.PI,
        automation: 3,
        step: CAMPAIGN_STEPS.convoy,
      },
    ] as const;
    for (const definition of industryLayout) {
      const view = cloneAsset(definition.asset);
      view.position.set(definition.position.x, 0, definition.position.z);
      view.rotation.y = definition.rotation;
      view.userData.minimumAutomation = definition.automation;
      view.userData.minimumStep = definition.step;
      this.#industryProps.add(view);
    }
    this.#treeField.useAssets(assets.regrowth, assets.stump);
    this.#resourceView.useAssets(assets.resources);
    this.#shownAutomation = -1;
    this.#shownMonument = -1;
    for (const axe of this.#axes) this.#axeRig.remove(axe);
    this.#axes.length = 0;
    for (const view of this.#workerViews.values()) this.#scene.remove(view);
    this.#workerViews.clear();
    for (const view of this.#customerViews.values()) this.#scene.remove(view);
    this.#customerViews.clear();
    for (const view of this.#animalViews.values()) this.#scene.remove(view);
    this.#animalViews.clear();
  }

  resize(): void {
    const aspect = innerWidth / innerHeight;
    const portrait = aspect < 0.8;
    const view = (portrait ? 7.8 : 5.8) * this.#debugZoom;
    this.#camera.left = -view * aspect;
    this.#camera.right = view * aspect;
    this.#camera.top = view;
    this.#camera.bottom = -view;
    this.#camera.updateProjectionMatrix();
    this.#renderer.setPixelRatio(
      renderPixelRatio(
        this.#quality,
        devicePixelRatio,
        innerWidth,
        innerHeight,
      ),
    );
    this.#renderer.setSize(innerWidth, innerHeight, false);
  }

  render(state: GameState, events: readonly GameEvent[], delta: number): void {
    this.#syncQuality();
    this.#syncPlayer(state, delta);
    this.#treeField.sync(state.trees, delta, state.player.position);
    this.#syncAxes(state);
    this.#resourceView.sync(state.pickups, state.conveyorItems);
    this.#syncWorkers(state);
    this.#syncCustomers(state);
    this.#syncAnimals(state, delta);
    this.#syncBase(state);
    this.#syncServiceSigns(state);
    this.#animateBase(state, delta);
    this.#syncHud(state);
    this.#consumeEvents(events);
    this.#effects.update(delta);
    this.#celebrationDurationRemaining = Math.max(
      0,
      this.#celebrationDurationRemaining - delta,
    );
    this.#celebrationBurstRemaining -= delta;
    if (
      this.#celebrationDurationRemaining > 0 &&
      this.#celebrationBurstRemaining <= 0
    ) {
      const position = new THREE.Vector3(
        MONUMENT_BUILDING.x + (Math.random() - 0.5) * 5,
        3 + Math.random() * 5,
        MONUMENT_BUILDING.z + (Math.random() - 0.5) * 4,
      );
      const colors = [0xffdc55, 0x66e0ff, 0xff7d9e, 0x8cff8c];
      this.#effects.burst(
        position,
        colors[Math.floor(Math.random() * colors.length)]!,
        24,
      );
      this.#celebrationBurstRemaining = 0.32;
    }
    this.#carryStack.sync(
      state.inventory.wood,
      state.inventory.planks,
      state.inventory.meat,
      delta,
    );
    this.#camera.position.x = state.player.position.x + CAMERA_OFFSET.x;
    this.#camera.position.y = CAMERA_OFFSET.y;
    this.#camera.position.z = state.player.position.z + CAMERA_OFFSET.z;
    this.#camera.lookAt(this.#player.position);
    this.#sun.position.set(
      state.player.position.x - 10,
      18,
      state.player.position.z + 8,
    );
    this.#sunTarget.position.set(
      state.player.position.x,
      0,
      state.player.position.z,
    );
    this.#sunTarget.updateMatrixWorld();
    this.#syncServiceBubble(state);
    this.#renderer.render(this.#scene, this.#camera);
  }

  #syncQuality(): void {
    if (this.#quality === this.#settings.quality) return;
    this.#quality = this.#settings.quality;
    this.#renderer.setPixelRatio(
      renderPixelRatio(
        this.#quality,
        devicePixelRatio,
        innerWidth,
        innerHeight,
      ),
    );
    this.#renderer.shadowMap.enabled = false;
    this.#renderer.setSize(innerWidth, innerHeight, false);
  }

  #createBase(): void {
    for (const [kind, position] of Object.entries(ZONES) as [
      ZoneKind,
      { x: number; z: number },
    ][]) {
      const marker = createServiceMarker(
        kind,
        ZONE_LABELS[kind],
        zoneColor(kind),
      );
      marker.group.position.set(position.x, 0.06, position.z);
      marker.group.userData.kind = kind;
      this.#serviceSigns.set(kind, marker.sign);
      this.#serviceMarkers.set(kind, marker.group);
      this.#scene.add(marker.group);
    }
    this.#saleBuilding.position.set(MARKET_TABLE.x, 0, MARKET_TABLE.z);
    this.#saleBuilding.rotation.y = Math.PI / 2;
    this.#sawmillBuilding.position.set(
      SAWMILL_BUILDING.x,
      0.68,
      SAWMILL_BUILDING.z,
    );
    this.#monument.position.set(MONUMENT_BUILDING.x, 0, MONUMENT_BUILDING.z);
    this.#butcherBuilding.position.set(
      BUTCHER_BUILDING.x,
      0,
      BUTCHER_BUILDING.z,
    );
    this.#turretBuildings.forEach((turret, index) => {
      const position = TURRET_BUILDINGS[index]!;
      turret.position.set(position.x, 0, position.z);
    });
    this.#sawmillMotion.position.set(
      SAWMILL_BUILDING.x,
      1.35,
      SAWMILL_BUILDING.z,
    );
    this.#monumentMotion.position.set(
      MONUMENT_BUILDING.x,
      1.4,
      MONUMENT_BUILDING.z,
    );
    this.#monumentBeacon.position.set(
      MONUMENT_BUILDING.x,
      0,
      MONUMENT_BUILDING.z,
    );
    this.#scene.add(
      this.#saleBuilding,
      this.#sawmillBuilding,
      this.#sawmillMotion,
      this.#monument,
      this.#monumentMotion,
      this.#monumentBeacon,
      this.#conveyors,
      this.#industryProps,
      this.#butcherBuilding,
      ...this.#turretBuildings,
      ...this.#lanePauseIndicators,
      ...this.#laneWarningIndicators,
    );
    this.#sawmillPallet.position.set(SAWMILL_OUTPUT.x, 0, SAWMILL_OUTPUT.z);
    this.#workerDock.position.set(WORKER_DEPOT.x, 0, WORKER_DEPOT.z);
    this.#scene.add(
      this.#sawmillPallet,
      this.#workerDock,
      this.#customerQueue,
      this.#marketStock,
      this.#baseStations,
    );
    this.#marketStock.position.set(MARKET_TABLE.x, 0, MARKET_TABLE.z);
    for (const gate of PROGRESSION_GATES) {
      const view = createGate(
        Math.hypot(gate.to.x - gate.from.x, gate.to.z - gate.from.z),
      );
      view.position.set(
        (gate.from.x + gate.to.x) / 2,
        0,
        (gate.from.z + gate.to.z) / 2,
      );
      if (gate.from.x === gate.to.x) view.rotation.y = Math.PI / 2;
      const localNormal = {
        x: Math.sin(view.rotation.y),
        z: Math.cos(view.rotation.y),
      };
      view.userData.openDirection =
        view.position.x * localNormal.x + view.position.z * localNormal.z >= 0
          ? 1
          : -1;
      this.#progressionGates.push({
        view,
        minimumStep: gate.minimumStep ?? 0,
        maximumStep: gate.maximumStep,
        unlockStep: gate.unlockStep,
      });
      this.#scene.add(view);
    }
  }

  #syncPlayer(state: GameState, delta: number): void {
    this.#player.position.set(
      state.player.position.x,
      0,
      state.player.position.z,
    );
    this.#player.rotation.y = state.player.heading;
    this.#axeRig.position.set(0, 0, 0);
    this.#axeRig.rotation.y = -state.player.heading;
    const moved =
      Math.hypot(
        state.player.position.x - this.#lastPlayerPosition.x,
        state.player.position.z - this.#lastPlayerPosition.z,
      ) > 0.001;
    this.#playerMotion += moved ? delta * 11 : delta * 3;
    const visual = this.#player.getObjectByName("player-visual");
    if (visual) {
      visual.position.y = moved
        ? Math.abs(Math.sin(this.#playerMotion)) * 0.09
        : 0;
      visual.rotation.z = moved ? Math.sin(this.#playerMotion) * 0.035 : 0;
    }
    this.#speedTrails.visible = state.player.trailMomentum > 0.04 && moved;
    this.#speedTrailMaterial.opacity =
      (0.28 + state.player.trailMomentum * 0.62) *
      (0.88 + Math.sin(this.#playerMotion * 2) * 0.12);
    this.#speedTrails.scale.set(
      0.8 + state.player.trailMomentum * 0.5,
      1,
      0.75 + state.player.trailMomentum * 0.9,
    );
    this.#lastPlayerPosition = { ...state.player.position };
  }

  #syncAxes(state: GameState): void {
    while (this.#axes.length < state.tool.positions.length) {
      const axe = createAxe(
        state.tool.level >= 4,
        state.tool.level >= 4
          ? this.#assets?.axeDouble
          : this.#assets?.axeSimple,
      );
      this.#axeRig.add(axe);
      this.#axes.push(axe);
    }
    while (this.#axes.length > state.tool.positions.length) {
      const axe = this.#axes.pop();
      if (axe) this.#axeRig.remove(axe);
    }
    const radius = toolOrbitRadius(state.tool.level);
    state.tool.positions.forEach((_position, index) => {
      const axe = this.#axes[index]!;
      const isDouble = state.tool.level >= 4;
      if (axe.userData.double !== isDouble) {
        this.#axeRig.remove(axe);
        this.#axes[index] = createAxe(
          state.tool.level >= 4,
          state.tool.level >= 4
            ? this.#assets?.axeDouble
            : this.#assets?.axeSimple,
        );
        this.#axeRig.add(this.#axes[index]);
      }
      const current = this.#axes[index]!;
      const angle =
        state.tool.angle + (index / state.tool.positions.length) * Math.PI * 2;
      current.position.set(
        Math.cos(angle) * radius,
        0.9,
        Math.sin(angle) * radius,
      );
      AXE_ORIENTATION.makeBasis(
        AXE_TANGENT_DIRECTION.set(-Math.sin(angle), 0, Math.cos(angle)),
        AXE_RADIAL_DIRECTION.set(Math.cos(angle), 0, Math.sin(angle)),
        AXE_UP_DIRECTION,
      );
      current.quaternion.setFromRotationMatrix(AXE_ORIENTATION);
      current.scale.setScalar(1 + state.tool.level * 0.045);
    });
  }

  #syncWorkers(state: GameState): void {
    const workers = state.workers;
    const activeIds = new Set(workers.map(({ id }) => id));
    for (const [id, view] of this.#workerViews) {
      if (!activeIds.has(id)) {
        this.#scene.remove(view);
        this.#workerViews.delete(id);
      }
    }
    for (const worker of workers) {
      let view = this.#workerViews.get(worker.id);
      if (!view) {
        view = createWorker(this.#assets?.worker);
        this.#scene.add(view);
        this.#workerViews.set(worker.id, view);
      }
      view.position.set(worker.position.x, 0, worker.position.z);
      view.rotation.y = worker.heading;
      const visual = view.getObjectByName("customer-visual");
      if (visual) {
        const phase = state.elapsed * 10 + worker.id;
        visual.position.y =
          worker.phase === "harvesting" ? 0 : Math.abs(Math.sin(phase)) * 0.07;
        visual.rotation.z =
          worker.phase === "harvesting"
            ? Math.sin(state.elapsed * 14) * 0.16
            : Math.sin(phase) * 0.025;
      }
      const woodLoad = view.getObjectByName("worker-wood-load");
      if (woodLoad) woodLoad.visible = worker.carriedWood > 0;
      const meatLoad = view.getObjectByName("worker-meat-load");
      if (meatLoad) meatLoad.visible = worker.carriedMeat > 0;
    }
  }

  #syncCustomers(state: GameState): void {
    const activeIds = new Set(state.customers.map(({ id }) => id));
    for (const [id, view] of this.#customerViews) {
      if (activeIds.has(id)) continue;
      this.#scene.remove(view);
      this.#customerViews.delete(id);
    }
    for (const customer of state.customers) {
      let view = this.#customerViews.get(customer.id);
      if (!view) {
        const variants = this.#assets?.customers ?? [];
        const asset = variants[customer.id % Math.max(1, variants.length)];
        view = createCustomer(asset);
        view.scale.setScalar(0.86 + (customer.id % 3) * 0.05);
        this.#scene.add(view);
        this.#customerViews.set(customer.id, view);
      }
      view.position.set(customer.position.x, 0, customer.position.z);
      view.rotation.y = customer.heading;
      const visual = view.getObjectByName("customer-visual");
      if (visual)
        visual.position.y =
          Math.abs(Math.sin(state.elapsed * 8 + customer.id)) * 0.05;
    }
  }

  #syncAnimals(state: GameState, delta: number): void {
    this.#updateDefeatedAnimals(delta);
    const activeIds = new Set(state.animals.map(({ id }) => id));
    for (const [id, view] of this.#animalViews) {
      if (activeIds.has(id)) continue;
      view.visible = false;
      this.#pendingRemovedAnimalViews.push(view);
      this.#animalViews.delete(id);
    }
    for (const animal of state.animals) {
      let view = this.#animalViews.get(animal.id);
      if (!view) {
        view = createBear();
        this.#scene.add(view);
        this.#animalViews.set(animal.id, view);
      }
      const hitRemaining = Math.max(
        0,
        Number(view.userData.hitRemaining ?? 0) - delta,
      );
      view.userData.hitRemaining = hitRemaining;
      const hitPose = animalHitPose(hitRemaining, this.#settings.reducedMotion);
      const hitDirection = view.userData.hitDirection as
        | { x: number; z: number }
        | undefined;
      view.position.set(
        animal.position.x + (hitDirection?.x ?? 0) * hitPose.recoil,
        hitPose.lift,
        animal.position.z + (hitDirection?.z ?? 0) * hitPose.recoil,
      );
      view.rotation.y = animal.heading;
      const visual = view.getObjectByName("animal-visual");
      if (visual) {
        const phase = state.elapsed * (animal.phase === "attacking" ? 9 : 6);
        visual.position.y = Math.abs(Math.sin(phase + animal.id)) * 0.08;
        visual.rotation.x =
          animal.phase === "attacking" ? Math.sin(phase) * 0.12 : 0;
        visual.rotation.z = hitPose.stagger;
        visual.scale.set(
          1 + hitPose.squash * 0.55,
          1 - hitPose.squash,
          1 + hitPose.squash * 0.45,
        );
      }
      const hitMaterials = view.userData.hitMaterials as
        | THREE.MeshToonMaterial[]
        | undefined;
      for (const material of hitMaterials ?? []) {
        material.emissive.setHex(0xffd9b8);
        material.emissiveIntensity = hitPose.flash * 1.8;
      }
      const health = view.getObjectByName("animal-health");
      if (health)
        health.scale.x = Math.max(0.04, animal.health / animal.maximumHealth);
    }
    this.#turretBuildings.forEach((turret, index) => {
      if (!turret.visible) return;
      const position = TURRET_BUILDINGS[index]!;
      const turretTarget = state.animals
        .filter(
          (animal) =>
            Math.hypot(
              animal.position.x - position.x,
              animal.position.z - position.z,
            ) <= FOREST.turretRange,
        )
        .sort(
          (left, right) =>
            Math.hypot(
              left.position.x - position.x,
              left.position.z - position.z,
            ) -
            Math.hypot(
              right.position.x - position.x,
              right.position.z - position.z,
            ),
        )[0];
      if (turretTarget)
        turret.rotation.y = Math.atan2(
          turretTarget.position.x - position.x,
          turretTarget.position.z - position.z,
        );
    });
    const pausedRoutes = pausedProductionRoutes(state.animals);
    this.#laneWarningIndicators.forEach((indicator, route) => {
      indicator.visible =
        state.wildlife.phase === "warning" && state.wildlife.lane === route;
      if (!indicator.visible) return;
      const motion = this.#settings.reducedMotion
        ? 0
        : Math.sin(state.elapsed * 4 + route) * 0.08;
      indicator.position.y = motion;
      indicator.scale.setScalar(
        this.#settings.reducedMotion
          ? 1
          : 0.96 + Math.sin(state.elapsed * 4 + route) * 0.04,
      );
    });
    this.#lanePauseIndicators.forEach((indicator, route) => {
      indicator.visible = pausedRoutes[route] ?? false;
      if (!indicator.visible) return;
      const motion = this.#settings.reducedMotion
        ? 0
        : Math.sin(state.elapsed * 6 + route) * 0.08;
      indicator.position.y = motion;
      indicator.scale.setScalar(
        this.#settings.reducedMotion
          ? 1
          : 0.96 + Math.sin(state.elapsed * 6 + route) * 0.04,
      );
    });
  }

  #syncServiceSigns(state: GameState): void {
    for (const [kind, sign] of this.#serviceSigns) {
      const data = serviceSignData(kind, state);
      const key = JSON.stringify(data);
      if (key === sign.key) continue;
      sign.key = key;
      drawZonePad(sign.padCanvas, sign.color, data, kind);
      sign.padTexture.needsUpdate = true;
    }
  }

  #syncServiceBubble(state: GameState): void {
    let occupied: ZoneKind | undefined;
    let nearestDistance = 1.25;
    for (const [kind, marker] of this.#serviceMarkers) {
      if (!marker.visible || kind === "departure") continue;
      const distance = Math.hypot(
        state.player.position.x - marker.position.x,
        state.player.position.z - marker.position.z,
      );
      if (distance > nearestDistance) continue;
      occupied = kind;
      nearestDistance = distance;
    }
    if (!occupied) {
      this.#serviceBubble.hidden = true;
      return;
    }
    const data = serviceSignData(occupied, state);
    const key = `${zoneAction(occupied)} · ${data.title}|${data.detail}`;
    if (this.#serviceBubble.dataset.key !== key) {
      this.#serviceBubble.dataset.key = key;
      this.#serviceBubble.replaceChildren();
      const action = document.createElement("small");
      action.textContent = `${zoneAction(occupied)} · ${data.title}`;
      const detail = document.createElement("strong");
      detail.textContent = data.detail;
      this.#serviceBubble.append(action, detail);
    }
    this.#serviceBubble.hidden = false;
    this.#camera.updateMatrixWorld();
    const projected = new THREE.Vector3(
      state.player.position.x,
      2.65,
      state.player.position.z,
    ).project(this.#camera);
    const desired = {
      x: ((projected.x + 1) / 2) * innerWidth,
      y: ((1 - projected.y) / 2) * innerHeight - 14,
    };
    const bounds = this.#serviceBubble.getBoundingClientRect();
    const position = clampOverlayPosition(
      desired,
      { width: bounds.width || 240, height: bounds.height || 72 },
      { width: innerWidth, height: innerHeight },
    );
    this.#serviceBubble.style.left = `${String(position.x)}px`;
    this.#serviceBubble.style.top = `${String(position.y)}px`;
  }

  #syncBase(state: GameState): void {
    const step = state.campaign.step;
    if (step !== this.#shownCampaignStep) {
      this.#shownCampaignStep = step;
      this.#campaignStepShownAt = state.elapsed;
    }
    const buildProgress = THREE.MathUtils.smoothstep(
      THREE.MathUtils.clamp(
        (state.elapsed - this.#campaignStepShownAt) / 0.8,
        0,
        1,
      ),
      0,
      1,
    );
    this.#world.traverse((child) => {
      const unlockStep: unknown = child.userData.unlockStep;
      const maximumStep: unknown = child.userData.maximumStep;
      if (typeof unlockStep === "number")
        child.visible =
          step >= unlockStep &&
          (typeof maximumStep !== "number" || step <= maximumStep);
      const buildAnimated: unknown = child.userData.buildAnimated;
      if (buildAnimated === true)
        child.scale.y = unlockStep === step ? buildProgress : 1;
    });
    for (const child of this.#baseStations.children) {
      child.visible = step >= Number(child.userData.minimumStep ?? 1);
      child.scale.y =
        Number(child.userData.minimumStep ?? 1) === step ? buildProgress : 1;
    }
    this.#saleBuilding.visible = step >= CAMPAIGN_STEPS.trade;
    this.#saleBuilding.children.forEach((tier, index) => {
      const shownTier = Math.max(0, state.automationLevel - 1);
      tier.visible = index === shownTier;
    });
    this.#saleBuilding.scale.setScalar(
      step === CAMPAIGN_STEPS.trade ? buildProgress : 1,
    );
    this.#customerQueue.visible = step >= CAMPAIGN_STEPS.trade;
    this.#marketStock.visible = step >= CAMPAIGN_STEPS.trade;
    if (state.campaign.marketStock !== this.#shownMarketStock) {
      this.#shownMarketStock = state.campaign.marketStock;
      syncMarketStock(this.#marketStock, state.campaign.marketStock);
    }
    this.#sawmillBuilding.visible = step >= CAMPAIGN_STEPS.automation;
    this.#sawmillBuilding.scale.setScalar(
      step === CAMPAIGN_STEPS.automation ? buildProgress : 1,
    );
    this.#sawmillPallet.visible = step >= CAMPAIGN_STEPS.automation;
    for (const prop of this.#industryProps.children)
      prop.visible =
        state.automationLevel >= Number(prop.userData.minimumAutomation) &&
        step >= Number(prop.userData.minimumStep);
    this.#workerDock.visible = step >= CAMPAIGN_STEPS.convoy;
    this.#monument.visible = step >= CAMPAIGN_STEPS.convoy;
    this.#butcherBuilding.visible = step >= CAMPAIGN_STEPS.wildlife;
    this.#turretBuildings.forEach((turret, index) => {
      turret.visible = index < state.turret.level;
      turret.scale.setScalar(1);
    });
    for (const { view, minimumStep, maximumStep, unlockStep } of this
      .#progressionGates) {
      view.visible = step >= minimumStep && step <= (maximumStep ?? Infinity);
      if (!view.visible) continue;
      view.scale.y = minimumStep === step ? buildProgress : 1;
      const unlocked = step >= unlockStep;
      const nearby = isGateApproached(
        { x: view.position.x, z: view.position.z },
        state.player.position,
        state.workers,
      );
      const left = view.getObjectByName("gate-left");
      const right = view.getObjectByName("gate-right");
      const opening = unlocked && nearby ? Math.PI * 0.48 : 0;
      const storedDirection: unknown = view.userData.openDirection;
      const openDirection =
        typeof storedDirection === "number" ? storedDirection : 1;
      if (left)
        left.rotation.y = THREE.MathUtils.lerp(
          left.rotation.y,
          -opening * openDirection,
          0.14,
        );
      if (right)
        right.rotation.y = THREE.MathUtils.lerp(
          right.rotation.y,
          opening * openDirection,
          0.14,
        );
      const lock = view.getObjectByName("gate-lock");
      if (lock) lock.visible = !unlocked;
    }
    for (const [kind, marker] of this.#serviceMarkers) {
      marker.visible = serviceVisible(kind, state);
      if (marker.visible) {
        const position = zonePosition(kind, step);
        marker.position.set(position.x, 0.06, position.z);
      }
    }
    if (state.automationLevel !== this.#shownAutomation) {
      this.#shownAutomation = state.automationLevel;
      const sawmillAsset = this.#assets?.sawmills[state.automationLevel];
      if (sawmillAsset) {
        replaceContents(this.#sawmillBuilding, sawmillAsset);
        this.#sawmillBuilding.position.y = 0;
      } else
        this.#sawmillBuilding.scale.setScalar(1 + state.automationLevel * 0.13);
      this.#conveyors.clear();
      if (state.automationLevel >= 2) {
        const workerConveyor = createConveyor(
          WORKER_CONVEYOR_PATH,
          this.#assets?.conveyorStraight,
        );
        workerConveyor.name = "worker-conveyor";
        this.#conveyors.add(workerConveyor);
      }
      if (state.automationLevel >= 3) {
        const marketConveyor = createConveyor(
          MARKET_CONVEYOR_PATH,
          this.#assets?.conveyorStraight,
          MARKET_CONVEYOR_ELEVATION,
        );
        marketConveyor.name = "market-conveyor";
        this.#conveyors.add(marketConveyor);
        const monumentConveyor = createConveyor(
          MONUMENT_CONVEYOR_PATH,
          this.#assets?.conveyorStraight,
        );
        monumentConveyor.name = "monument-conveyor";
        this.#conveyors.add(monumentConveyor);
      }
    }
    const workerConveyor = this.#conveyors.getObjectByName("worker-conveyor");
    if (workerConveyor) workerConveyor.visible = step >= CAMPAIGN_STEPS.worker;
    const monumentConveyor =
      this.#conveyors.getObjectByName("monument-conveyor");
    const marketConveyor = this.#conveyors.getObjectByName("market-conveyor");
    if (marketConveyor) marketConveyor.visible = step >= CAMPAIGN_STEPS.convoy;
    if (monumentConveyor)
      monumentConveyor.visible = step >= CAMPAIGN_STEPS.convoy;
    if (state.monument.stage !== this.#shownMonument) {
      this.#shownMonument = state.monument.stage;
      this.#monumentMixer = undefined;
      const monumentAsset = this.#assets?.monuments[state.monument.stage - 1];
      if (monumentAsset) {
        this.#monument.clear();
        this.#monument.scale.setScalar(1);
        const monumentView = cloneAsset(monumentAsset.object);
        this.#monument.add(monumentView);
        this.#monumentMixer = new THREE.AnimationMixer(monumentView);
        for (const animation of monumentAsset.animations)
          this.#monumentMixer.clipAction(animation).play();
      } else
        this.#monument.children.forEach((child, index) => {
          child.visible = index <= state.monument.stage;
        });
    }
  }

  #animateBase(state: GameState, delta: number): void {
    const flame = this.#baseStations.getObjectByName("campfire-flame");
    if (flame) {
      flame.scale.y = 0.9 + Math.sin(state.elapsed * 11) * 0.13;
      flame.position.x = Math.sin(state.elapsed * 7) * 0.05;
      flame.rotation.y += delta * 1.8;
    }
    this.#sawmillMotion.visible =
      state.campaign.step >= CAMPAIGN_STEPS.automation;
    if (this.#sawmillMotion.visible)
      this.#sawmillMotion.rotation.z -=
        delta *
        sawmillAngularSpeed(state.automationLevel, state.sawmill.wood > 0);
    this.#monumentMotion.visible = state.monument.stage > 0;
    this.#monumentMixer?.update(delta);
    this.#monumentMotion.rotation.y +=
      delta * (0.35 + state.monument.stage * 0.25);
    this.#monumentBeacon.visible = this.#celebrationDurationRemaining > 0;
    if (this.#monumentBeacon.visible) {
      this.#monumentBeacon.rotation.y += delta * 0.8;
      const pulse = 1 + Math.sin(state.elapsed * 8) * 0.08;
      this.#monumentBeacon.scale.set(pulse, 1, pulse);
    }
  }

  #syncHud(state: GameState): void {
    this.#hud.coins.textContent = String(state.inventory.coins);
    this.#hud.wood.textContent = String(state.inventory.wood);
    this.#hud.planks.textContent = String(state.inventory.planks);
    this.#hud.meat.textContent = String(state.inventory.meat);
    this.#hud.meat.parentElement?.classList.toggle(
      "is-hidden",
      state.campaign.step < CAMPAIGN_STEPS.departure &&
        state.inventory.meat === 0,
    );
    this.#hud.tool.textContent = String(state.tool.level);
    this.#hud.workers.textContent = String(state.workers.length);
    this.#hud.automation.textContent = `${String(state.automationLevel)}/3`;
    this.#hud.monument.textContent = `${String(state.monument.stage)}/3`;
    this.#hud.toolCost.textContent =
      state.tool.level >= 6
        ? "✓"
        : `${String(FOREST.toolCosts[state.tool.level])} 🪙`;
    this.#hud.workerCost.textContent =
      state.automationLevel === 0
        ? "🔒"
        : state.workers.length >= FOREST.maxWorkers
          ? "✓"
          : `${String(FOREST.workerCosts[state.workers.length])} 🪙`;
    this.#hud.automationCost.textContent =
      state.automationLevel >= 3
        ? "✓"
        : `${String(FOREST.automationCosts[state.automationLevel + 1]! - state.automationProgress)} 🪚`;
    this.#hud.monumentCost.textContent =
      state.monument.stage >= 3
        ? "✓"
        : `${String(FOREST.monumentCosts[state.monument.stage]! - state.monument.progress)} 🪚`;
    const objective = selectObjective(state);
    const objectiveKey = `${String(state.campaign.step)}:${objective.icon}`;
    const panel = this.#hud.objective.parentElement?.parentElement;
    if (panel && objectiveKey !== this.#shownObjective) {
      if (this.#shownObjective) {
        const entry = document.createElement("li");
        entry.textContent = objectiveHistoryEntry(
          {
            icon: this.#hud.objective.textContent,
            detail: this.#hud.objectiveDetail.textContent,
          },
          objective,
        );
        this.#hud.objectiveHistory.prepend(entry);
        while (this.#hud.objectiveHistory.children.length > 8)
          this.#hud.objectiveHistory.lastElementChild?.remove();
      }
      this.#shownObjective = objectiveKey;
      this.#objectiveShownAt = state.elapsed;
      panel.classList.remove("is-docking", "is-compact", "journal-open");
      panel.classList.add("is-entering");
    }
    this.#hud.objective.textContent = objective.icon;
    this.#hud.objectiveDetail.textContent = objective.detail;
    if (panel) panel.title = `${objective.icon} — ${objective.detail}`;
    if (panel) {
      const age = state.elapsed - this.#objectiveShownAt;
      const stage =
        age >= 4.4 ? "is-compact" : age >= 4 ? "is-docking" : "is-entering";
      if (!panel.classList.contains(stage)) {
        panel.classList.remove("is-entering", "is-docking", "is-compact");
        panel.classList.add(stage);
      }
    }
  }

  #consumeEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      if (event.type === "monument.activated") {
        this.#celebrationDurationRemaining = 6;
        this.#celebrationBurstRemaining = 0;
        const position = new THREE.Vector3(
          event.position.x,
          0.08,
          event.position.z,
        );
        this.#effects.pulse(position, 0xffdc55, 4.5);
        this.#effects.burst(position.clone().setY(3), 0x66e0ff, 48);
        continue;
      }
      if (
        event.type === "tool.upgraded" ||
        event.type === "worker.hired" ||
        event.type === "automation.upgraded" ||
        event.type === "monument.advanced" ||
        event.type === "turret.upgraded" ||
        event.type === "campaign.advanced"
      ) {
        this.#effects.burst(
          this.#player.position.clone().add(new THREE.Vector3(0, 1, 0)),
          0xffdc55,
          30,
        );
        this.#effects.pulse(
          this.#player.position.clone().setY(0.08),
          0xffdc55,
          1.5,
        );
        continue;
      }
      if (event.type === "campaign.completed") continue;
      const position = new THREE.Vector3(
        event.position.x,
        1.2,
        event.position.z,
      );
      if (event.type === "tree.hit") {
        this.#effects.burst(
          position,
          0xb87838,
          event.source === "player" ? 11 : 6,
        );
        this.#treeField.hit(event.position);
      } else if (event.type === "tree.destroyed") {
        position.y = 2;
        this.#effects.burst(position, 0x45a84f, 24);
        this.#effects.pulse(position.clone().setY(0.08), 0x78c693, 1.15);
      } else if (event.type === "animal.hit") {
        this.#effects.burst(
          position,
          event.source === "turret" ? 0x9bd5dd : 0xe4845f,
          9,
        );
        this.#effects.pulse(
          position.clone().setY(0.08),
          event.source === "turret" ? 0x9bd5dd : 0xf0a07b,
          0.7,
        );
        this.#registerAnimalHit(event.position, event.source);
      } else if (event.type === "animal.destroyed") {
        this.#effects.burst(position, 0xf0a07b, 10);
        this.#startAnimalDefeat(event.position);
      } else if (event.type === "pickup.collected") {
        const pickupTarget = this.#player.position
          .clone()
          .add(new THREE.Vector3(0, 1.8, -0.25));
        this.#effects.transfer(
          event.kind,
          position.clone().setY(0.45),
          pickupTarget,
        );
        this.#carryStack.feedback();
        this.#effects.burst(
          position,
          event.kind === "coin"
            ? 0xffd63d
            : event.kind === "plank"
              ? 0xe7ae68
              : event.kind === "meat"
                ? 0xd65a55
                : 0xa66a39,
          6,
        );
        this.#effects.pulse(
          position.clone().setY(0.08),
          event.kind === "coin"
            ? 0xf6cc55
            : event.kind === "plank"
              ? 0xedc483
              : event.kind === "meat"
                ? 0xed7770
                : 0xa9683f,
          0.55,
        );
      } else if (event.type === "sawmill.produced") {
        this.#effects.burst(position, 0xf0b86e, 9);
        this.#effects.pulse(position.clone().setY(0.08), 0x9bc1bd, 0.8);
      } else if (event.type === "customer.served") {
        this.#effects.burst(position, 0xf6cc55, 8);
        this.#effects.pulse(position.clone().setY(0.08), 0xf6cc55, 0.7);
      } else if (
        event.type === "resource.deposited" ||
        event.type === "coin.produced"
      ) {
        if (event.type === "resource.deposited") {
          this.#effects.transfer(
            event.kind,
            this.#player.position
              .clone()
              .add(new THREE.Vector3(0, 1.75, -0.65)),
            position.clone().setY(0.35),
          );
          this.#carryStack.feedback();
        }
        this.#effects.burst(position, 0xffdc55, 4);
        this.#effects.pulse(position.clone().setY(0.08), 0xf6cc55, 0.65);
      }
    }
    for (const view of this.#pendingRemovedAnimalViews)
      this.#scene.remove(view);
    this.#pendingRemovedAnimalViews.length = 0;
  }

  #startAnimalDefeat(position: { x: number; z: number }): void {
    let targetIndex = -1;
    let targetDistance = 1.5;
    this.#pendingRemovedAnimalViews.forEach((view, index) => {
      const distance = Math.hypot(
        view.position.x - position.x,
        view.position.z - position.z,
      );
      if (distance >= targetDistance) return;
      targetIndex = index;
      targetDistance = distance;
    });
    const [matched] =
      targetIndex >= 0
        ? this.#pendingRemovedAnimalViews.splice(targetIndex, 1)
        : [];
    const view = matched ?? createBear();
    if (!matched) this.#scene.add(view);
    view.visible = true;
    view.position.set(position.x, 0, position.z);
    view.getObjectByName("animal-health")!.visible = false;
    const healthBack = view.getObjectByName("animal-health-back");
    if (healthBack) healthBack.visible = false;
    this.#defeatedAnimalViews.push({
      view,
      remaining: ANIMAL_DEFEAT_DURATION,
      position: { ...position },
    });
  }

  #updateDefeatedAnimals(delta: number): void {
    for (
      let index = this.#defeatedAnimalViews.length - 1;
      index >= 0;
      index -= 1
    ) {
      const defeated = this.#defeatedAnimalViews[index]!;
      defeated.remaining = Math.max(0, defeated.remaining - delta);
      const pose = animalDefeatPose(defeated.remaining);
      const direction = defeated.view.userData.hitDirection as
        | { x: number; z: number }
        | undefined;
      defeated.view.position.set(
        defeated.position.x + (direction?.x ?? 0) * pose.recoil,
        -pose.sink,
        defeated.position.z + (direction?.z ?? 0) * pose.recoil,
      );
      const visual = defeated.view.getObjectByName("animal-visual");
      if (visual) {
        visual.rotation.x = pose.collapse * 1.05;
        visual.rotation.z = pose.collapse * 0.18;
        visual.scale.set(1 + pose.collapse * 0.12, 1 - pose.collapse * 0.42, 1);
      }
      setObjectOpacity(defeated.view, pose.opacity);
      if (defeated.remaining > 0) continue;
      this.#scene.remove(defeated.view);
      this.#defeatedAnimalViews.splice(index, 1);
    }
  }

  #registerAnimalHit(
    position: { x: number; z: number },
    source: "player" | "turret",
  ): void {
    let target: THREE.Group | undefined;
    let targetDistance = 1.2;
    const candidates = [
      ...this.#animalViews.values(),
      ...this.#pendingRemovedAnimalViews,
    ];
    for (const view of candidates) {
      const distance = Math.hypot(
        view.position.x - position.x,
        view.position.z - position.z,
      );
      if (distance > targetDistance) continue;
      target = view;
      targetDistance = distance;
    }
    if (!target) return;
    let attacker = this.#player.position;
    if (source === "turret") {
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const turret of this.#turretBuildings) {
        if (!turret.visible) continue;
        const distance = Math.hypot(
          turret.position.x - position.x,
          turret.position.z - position.z,
        );
        if (distance >= nearestDistance) continue;
        attacker = turret.position;
        nearestDistance = distance;
      }
    }
    const dx = position.x - attacker.x;
    const dz = position.z - attacker.z;
    const length = Math.hypot(dx, dz) || 1;
    target.userData.hitDirection = { x: dx / length, z: dz / length };
    target.userData.hitRemaining = ANIMAL_HIT_DURATION;
  }
}

const AXE_RADIAL_DIRECTION = new THREE.Vector3();
const AXE_TANGENT_DIRECTION = new THREE.Vector3();
const AXE_UP_DIRECTION = new THREE.Vector3(0, 1, 0);
const AXE_ORIENTATION = new THREE.Matrix4();

function createGround(): THREE.Group {
  const world = new THREE.Group();
  const grassTexture = createArtTexture("textures/grass.png", 0.25);
  const groveTexture = createArtTexture("textures/grove.png", 0.25);
  const yardTexture = createArtTexture("textures/yard.png", 0.25);
  const industrialYardTexture = createArtTexture(
    "textures/industrial-yard.png",
    0.22,
  );
  const pathTexture = createArtTexture("textures/path.png", 0.25);
  const pathEdgeTexture = createArtTexture("textures/path-edge.png", 0.25);
  const outerGround = new THREE.Mesh(
    new THREE.BoxGeometry(90, 1.4, 90),
    createToonMaterial({ color: 0x35563a, roughness: 1 }),
  );
  outerGround.position.y = -0.76;
  outerGround.receiveShadow = true;
  const ground = createArea(
    FOREST_BOUNDARY,
    createToonMaterial({ map: grassTexture, roughness: 1 }),
    -0.04,
  );
  world.add(outerGround, ground);
  const boundaryMaterial = createToonMaterial({
    color: 0x2f4930,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  world.add(
    createPathRibbon(
      [...FOREST_BOUNDARY, FOREST_BOUNDARY[0]!],
      1.1,
      boundaryMaterial,
      -0.025,
    ),
  );
  world.add(
    createPathRibbon(
      [...FOREST_BOUNDARY, FOREST_BOUNDARY[0]!],
      4.5,
      new THREE.MeshBasicMaterial({
        color: 0xa8cf9a,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      0.08,
    ),
  );

  for (const area of FOREST_AREAS) {
    world.add(
      createArea(
        area.points,
        createToonMaterial({
          map: groveTexture,
          roughness: 1,
          side: THREE.DoubleSide,
        }),
        0,
      ),
    );
  }

  for (const yard of FOREST_YARDS) {
    const surfaceTexture =
      yard.unlockStep >= CAMPAIGN_STEPS.automation
        ? industrialYardTexture
        : yardTexture;
    const yardView = new THREE.Group();
    yardView.userData.unlockStep = yard.unlockStep;
    yardView.add(
      createArea(
        yard.points,
        createToonMaterial({
          map: surfaceTexture,
          roughness: 1,
          side: THREE.DoubleSide,
        }),
        0.024,
      ),
    );
    world.add(yardView);
  }

  const pathMaterial = createToonMaterial({
    map: pathTexture,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  const pathEdgeMaterial = createToonMaterial({
    map: pathEdgeTexture,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  for (const { points, width, unlockStep, surface } of FOREST_PATHS) {
    const market = surface === "market";
    const path = market
      ? createCustomerTrail(points)
      : createPath(points, width, pathMaterial, pathEdgeMaterial);
    path.userData.unlockStep = unlockStep;
    world.add(path);
  }

  const fenceMaterial = createToonMaterial({
    color: 0x9a6a3f,
    roughness: 1,
  });
  for (const { from, to, minimumStep, maximumStep } of FOREST_FENCES) {
    const fence = createFence(from, to, fenceMaterial);
    fence.userData.unlockStep = minimumStep ?? 0;
    fence.userData.maximumStep = maximumStep;
    fence.userData.buildAnimated = true;
    world.add(fence);
  }
  const barrierMaterial = createToonMaterial({ color: 0x765035 });
  for (const barrier of FOREST_TRAIL_BARRIERS) {
    const view = createTrailBarrier(barrier.from, barrier.to, barrierMaterial);
    view.userData.unlockStep = barrier.minimumStep;
    view.userData.buildAnimated = true;
    world.add(view);
  }
  world.add(createBoundaryRidge());
  world.add(createDecorations());
  return world;
}

function createArea(
  points: readonly { x: number; z: number }[],
  material: THREE.Material,
  y: number,
): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(points[0]!.x, points[0]!.z);
  for (const point of points.slice(1)) shape.lineTo(point.x, point.z);
  shape.closePath();
  const area = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  area.rotation.x = Math.PI / 2;
  area.position.y = y;
  area.receiveShadow = true;
  return area;
}

function createPath(
  points: readonly { x: number; z: number }[],
  width: number,
  material: THREE.Material,
  edgeMaterial: THREE.Material,
): THREE.Group {
  const path = new THREE.Group();
  path.add(
    createPathRibbon(points, width + 0.55, edgeMaterial, 0.012),
    createPathRibbon(points, width, material, 0.016),
  );
  return path;
}

function createCustomerTrail(
  points: readonly { x: number; z: number }[],
): THREE.Group {
  const trail = new THREE.Group();
  const geometry = new THREE.RingGeometry(0.12, 0.25, 18);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    color: 0xfff8dc,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -20,
    polygonOffsetUnits: -20,
  });
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    const count = Math.max(1, Math.floor(length / 0.9));
    for (let dot = 0; dot < count; dot += 1) {
      const amount = (dot + 0.5) / count;
      const marker = new THREE.Mesh(geometry, material);
      marker.position.set(
        THREE.MathUtils.lerp(from.x, to.x, amount),
        0.18,
        THREE.MathUtils.lerp(from.z, to.z, amount),
      );
      marker.renderOrder = 3;
      trail.add(marker);
    }
  }
  return trail;
}

function createPathRibbon(
  points: readonly { x: number; z: number }[],
  width: number,
  material: THREE.Material,
  y: number,
): THREE.Mesh {
  const firstSource = points[0]!;
  const lastSource = points.at(-1)!;
  const closed =
    firstSource.x === lastSource.x && firstSource.z === lastSource.z;
  const ribbonPoints = points.map((point) => ({ ...point }));
  if (!closed && ribbonPoints.length > 1) {
    const first = ribbonPoints[0]!;
    const next = ribbonPoints[1]!;
    const length = Math.hypot(next.x - first.x, next.z - first.z) || 1;
    first.x += ((next.x - first.x) / length) * (width / 2);
    first.z += ((next.z - first.z) / length) * (width / 2);
  }
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let distance = 0;
  for (let index = 0; index < ribbonPoints.length; index += 1) {
    const point = ribbonPoints[index]!;
    const previous = ribbonPoints[Math.max(0, index - 1)]!;
    const next = ribbonPoints[Math.min(ribbonPoints.length - 1, index + 1)]!;
    if (index > 0)
      distance += Math.hypot(point.x - previous.x, point.z - previous.z);
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const segmentLength = Math.hypot(dx, dz) || 1;
    const offsetX = (-(dz / segmentLength) * width) / 2;
    const offsetZ = ((dx / segmentLength) * width) / 2;
    positions.push(
      point.x + offsetX,
      0,
      point.z + offsetZ,
      point.x - offsetX,
      0,
      point.z - offsetZ,
    );
    uvs.push(0, distance, width, distance);
    if (index === 0) continue;
    const start = (index - 1) * 2;
    indices.push(start, start + 2, start + 1, start + 2, start + 3, start + 1);
  }
  const first = ribbonPoints[0]!;
  const last = ribbonPoints.at(-1)!;
  if (!closed) {
    for (const point of [first, last]) {
      const centerIndex = positions.length / 3;
      positions.push(point.x, 0, point.z);
      uvs.push(width / 2, 0);
      for (let segment = 0; segment <= 20; segment += 1) {
        const angle = (segment / 20) * Math.PI * 2;
        const x = Math.cos(angle) * (width / 2);
        const z = Math.sin(angle) * (width / 2);
        positions.push(point.x + x, 0, point.z + z);
        uvs.push(x + width / 2, z + width / 2);
        if (segment > 0)
          indices.push(
            centerIndex,
            centerIndex + segment,
            centerIndex + segment + 1,
          );
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const ribbon = new THREE.Mesh(geometry, material);
  ribbon.position.y = y;
  ribbon.receiveShadow = true;
  return ribbon;
}

const ART_TEXTURES = new Map<string, THREE.Texture>();

function createArtTexture(file: string, repeat = 1): THREE.Texture {
  const key = `${file}:${String(repeat)}`;
  const existing = ART_TEXTURES.get(key);
  if (existing) return existing;
  const texture = new THREE.TextureLoader().load(
    `${import.meta.env.BASE_URL}art/${file}`,
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 4;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  ART_TEXTURES.set(key, texture);
  return texture;
}

function createDecorations(): THREE.Group {
  const group = new THREE.Group();
  const geometries = {
    bush: new THREE.DodecahedronGeometry(0.58, 0),
    flowers: new THREE.ConeGeometry(0.25, 0.42, 7),
    rock: new THREE.DodecahedronGeometry(0.46, 0),
  };
  const materials = {
    bush: createToonMaterial({ color: 0x3f873d, roughness: 1 }),
    flowers: createToonMaterial({
      color: 0xf3b64f,
      emissive: 0x6d3d0c,
      emissiveIntensity: 0.12,
      roughness: 0.85,
    }),
    rock: createToonMaterial({ color: 0x829080, roughness: 1 }),
  };
  for (const decoration of FOREST_DECORATIONS) {
    const mesh = new THREE.Mesh(
      geometries[decoration.kind],
      materials[decoration.kind],
    );
    mesh.position.set(
      decoration.position.x,
      decoration.kind === "flowers" ? 0.21 : 0.35 * decoration.scale,
      decoration.position.z,
    );
    mesh.rotation.y = decoration.rotation;
    if (decoration.kind === "bush")
      mesh.scale.set(
        decoration.scale,
        decoration.scale * 0.72,
        decoration.scale * 1.08,
      );
    else if (decoration.kind === "rock")
      mesh.scale.set(
        decoration.scale * 1.25,
        decoration.scale * 0.72,
        decoration.scale,
      );
    else mesh.scale.setScalar(decoration.scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

function createBoundaryRidge(): THREE.InstancedMesh {
  const ridge = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    createToonMaterial({ color: 0x667067, roughness: 1 }),
    FOREST_RIDGE_POSITIONS.length,
  );
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  FOREST_RIDGE_POSITIONS.forEach((point, index) => {
    const height = 1.5 + ((index * 17) % 9) * 0.16;
    position.set(point.x, height * 0.52 - 0.12, point.z);
    rotation.setFromEuler(
      new THREE.Euler(index * 0.19, index * 0.73, index * 0.11),
    );
    scale.set(0.85 + (index % 4) * 0.1, height, 0.9 + (index % 3) * 0.12);
    matrix.compose(position, rotation, scale);
    ridge.setMatrixAt(index, matrix);
  });
  ridge.receiveShadow = false;
  ridge.castShadow = false;
  ridge.instanceMatrix.needsUpdate = true;
  return ridge;
}

function createFence(
  from: { x: number; z: number },
  to: { x: number; z: number },
  material: THREE.Material,
): THREE.Group {
  const group = new THREE.Group();
  const length = Math.hypot(to.x - from.x, to.z - from.z);
  const posts = Math.max(2, Math.ceil(length / 0.42));
  const geometry = new THREE.CylinderGeometry(0.18, 0.23, 2.15, 7);
  const fence = new THREE.InstancedMesh(geometry, material, posts + 1);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let index = 0; index <= posts; index += 1) {
    const amount = index / posts;
    position.set(
      THREE.MathUtils.lerp(from.x, to.x, amount),
      1.05 + (index % 2) * 0.08,
      THREE.MathUtils.lerp(from.z, to.z, amount),
    );
    scale.set(1, index % 2 === 0 ? 1 : 1.07, 1);
    matrix.compose(position, rotation, scale);
    fence.setMatrixAt(index, matrix);
  }
  fence.instanceMatrix.needsUpdate = true;
  group.add(fence);
  return group;
}

function createTrailBarrier(
  from: { x: number; z: number },
  to: { x: number; z: number },
  material: THREE.Material,
): THREE.Group {
  const group = new THREE.Group();
  const length = Math.hypot(to.x - from.x, to.z - from.z);
  const center = new THREE.Vector3(
    (from.x + to.x) / 2,
    0.28,
    (from.z + to.z) / 2,
  );
  const direction = new THREE.Vector3(
    to.x - from.x,
    0,
    to.z - from.z,
  ).normalize();
  const rotation = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction,
  );
  for (const offset of [-0.2, 0.2]) {
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, length, 7),
      material,
    );
    log.position.copy(center);
    log.position.y += offset;
    log.quaternion.copy(rotation);
    group.add(log);
  }
  return group;
}

function createPlayer(): THREE.Group {
  const player = new THREE.Group();
  const visual = new THREE.Group();
  visual.name = "player-visual";
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.52, 0.8, 5, 10),
    createToonMaterial({ color: 0x3a78e0, roughness: 0.8 }),
  );
  body.position.y = 1;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 16, 10),
    createToonMaterial({ color: 0xffbe82, roughness: 0.9 }),
  );
  head.position.y = 2;
  const bag = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.85, 0.35),
    createToonMaterial({ color: 0x87512f, roughness: 1 }),
  );
  bag.position.set(0, 1.15, -0.52);
  body.castShadow = head.castShadow = bag.castShadow = true;
  body.renderOrder = head.renderOrder = bag.renderOrder = RENDER_LAYER.player;
  visual.add(body, head, bag);
  player.add(visual);
  return player;
}

function createAxe(double: boolean, asset?: THREE.Object3D): THREE.Group {
  const axe = new THREE.Group();
  axe.userData.double = double;
  if (asset) {
    axe.add(cloneAsset(asset));
    axe.traverse((child) => {
      child.renderOrder = RENDER_LAYER.player;
    });
    return axe;
  }
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 1.25, 8),
    createToonMaterial({ color: 0x7b4327, roughness: 0.85 }),
  );
  const material = createToonMaterial({
    color: double ? 0xffe26a : 0xdce8e7,
    metalness: 0.65,
    roughness: 0.28,
  });
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.34, 0.14),
    material,
  );
  blade.position.set(0.3, 0.5, 0);
  blade.rotation.z = -0.18;
  axe.add(handle, blade);
  if (double) {
    const second = blade.clone();
    second.position.x = -0.3;
    second.rotation.z = 0.18;
    axe.add(second);
  }
  axe.traverse((child) => {
    if ("castShadow" in child) (child as THREE.Mesh).castShadow = true;
    child.renderOrder = RENDER_LAYER.player;
  });
  return axe;
}

function createWorker(asset?: THREE.Object3D): THREE.Group {
  const worker = new THREE.Group();
  const visual = new THREE.Group();
  visual.name = "worker-visual";
  if (asset) visual.add(cloneAsset(asset));
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.33, 0.48, 4, 8),
    createToonMaterial({ color: 0xf0a33c, roughness: 0.85 }),
  );
  body.position.y = 0.65;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    createToonMaterial({ color: 0xffbe82, roughness: 0.9 }),
  );
  head.position.y = 1.35;
  const woodLoad = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.55, 0.35),
    createToonMaterial({ color: 0x9b592f, roughness: 1 }),
  );
  woodLoad.position.set(0, 0.85, -0.38);
  body.visible = head.visible = !asset;
  woodLoad.name = "worker-wood-load";
  const meatLoad = new THREE.Group();
  meatLoad.name = "worker-meat-load";
  for (const x of [-0.2, 0, 0.2]) {
    const meat = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 7, 5),
      createToonMaterial({ color: 0xbd4f43, roughness: 0.9 }),
    );
    meat.position.set(x, 0.88 + Math.abs(x) * 0.45, -0.42);
    meatLoad.add(meat);
  }
  visual.add(body, head, woodLoad, meatLoad);
  worker.add(visual);
  return worker;
}

function createBear(): THREE.Group {
  const bear = new THREE.Group();
  const visual = new THREE.Group();
  visual.name = "animal-visual";
  const fur = createToonMaterial({ color: 0x6a432d, roughness: 1 });
  const muzzle = createToonMaterial({ color: 0xb8875e, roughness: 1 });
  bear.userData.hitMaterials = [fur, muzzle];
  const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 0), fur);
  body.position.y = 0.7;
  body.scale.set(0.9, 1.05, 1.25);
  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 0), fur);
  head.position.set(0, 1.12, 0.48);
  const nose = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), muzzle);
  nose.position.set(0, 1.05, 0.82);
  for (const x of [-0.27, 0.27]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.14, 7, 5), fur);
    ear.position.set(x, 1.45, 0.42);
    visual.add(ear);
  }
  for (const x of [-0.32, 0.32]) {
    for (const z of [-0.36, 0.4]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.16, 0.48, 6),
        fur,
      );
      leg.position.set(x, 0.28, z);
      visual.add(leg);
    }
  }
  visual.add(body, head, nose);
  const healthBack = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x3a211b }),
  );
  healthBack.name = "animal-health-back";
  healthBack.position.set(0, 1.75, 0);
  healthBack.rotation.x = -Math.PI / 4;
  const health = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 0.065),
    new THREE.MeshBasicMaterial({ color: 0xe85d4f }),
  );
  health.name = "animal-health";
  health.position.set(-0.5, 1.75, -0.01);
  health.rotation.x = -Math.PI / 4;
  health.geometry.translate(0.5, 0, 0);
  bear.add(visual, healthBack, health);
  return bear;
}

function createCustomer(asset?: THREE.Object3D): THREE.Group {
  const customer = new THREE.Group();
  const visual = new THREE.Group();
  visual.name = "customer-visual";
  if (asset) visual.add(cloneAsset(asset));
  else {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3, 0.45, 4, 8),
      createToonMaterial({ color: 0xdc8162, roughness: 0.85 }),
    );
    body.position.y = 0.65;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 10, 8),
      createToonMaterial({ color: 0xffc693, roughness: 0.9 }),
    );
    head.position.y = 1.28;
    visual.add(body, head);
  }
  const bubbleCanvas = document.createElement("canvas");
  bubbleCanvas.width = bubbleCanvas.height = 96;
  const context = bubbleCanvas.getContext("2d")!;
  context.fillStyle = "#fff4d6";
  context.strokeStyle = "#30271e";
  context.lineWidth = 7;
  context.beginPath();
  context.arc(48, 44, 35, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = "#f6cc55";
  context.beginPath();
  context.arc(48, 44, 20, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = "#6f4932";
  context.font = "900 27px Figtree, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("$", 48, 44);
  const texture = new THREE.CanvasTexture(bubbleCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const bubble = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true }),
  );
  bubble.position.y = 2;
  bubble.scale.set(0.72, 0.72, 1);
  customer.add(visual, bubble);
  return customer;
}

function createSawmillMotion(): THREE.Group {
  const motion = new THREE.Group();
  const blade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.64, 0.64, 0.08, 18),
    createToonMaterial({
      color: 0xd8e1dc,
      metalness: 0.55,
      roughness: 0.35,
    }),
  );
  blade.rotation.x = Math.PI / 2;
  blade.castShadow = true;
  const accentMaterial = createToonMaterial({
    color: 0x6f4932,
    roughness: 0.7,
  });
  for (const rotation of [0, Math.PI / 2]) {
    const accent = new THREE.Mesh(
      new THREE.BoxGeometry(1.02, 0.07, 0.1),
      accentMaterial,
    );
    accent.position.z = 0.055;
    accent.rotation.z = rotation;
    motion.add(accent);
  }
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.14, 12),
    accentMaterial,
  );
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.08;
  motion.add(blade, hub);
  motion.visible = false;
  return motion;
}

function createMonumentMotion(): THREE.Group {
  const motion = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.09, 8, 24),
    createToonMaterial({
      color: 0xffd35c,
      emissive: 0x8a5a16,
      emissiveIntensity: 0.35,
      metalness: 0.4,
      roughness: 0.35,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.castShadow = true;
  motion.add(ring);
  motion.visible = false;
  return motion;
}

function createMonumentBeacon(): THREE.Group {
  const beacon = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.55, 16, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x66e0ff,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  beam.position.y = 8;
  const crown = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.1, 8, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffdc55,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  crown.rotation.x = Math.PI / 2;
  crown.position.y = 3.8;
  beacon.add(beam, crown);
  beacon.visible = false;
  return beacon;
}

function replaceContents(target: THREE.Group, asset: THREE.Object3D): void {
  target.clear();
  target.scale.setScalar(1);
  target.add(cloneAsset(asset));
}

const ZONE_LABELS: Record<ZoneKind, string> = {
  camp: "CAMP",
  sale: "VENTE",
  sawmill: "SCIERIE",
  tool: "OUTILS",
  worker: "OUVRIERS",
  automation: "AUTOMATISATION",
  monument: "CHANTIER",
  departure: "DÉPART",
  butcher: "BOUCHERIE",
  canteen: "RATIONS",
  turret: "DÉFENSE",
};

function createServiceMarker(
  kind: ZoneKind,
  label: string,
  color: number,
): { group: THREE.Group; sign: ServiceSign } {
  const marker = new THREE.Group();
  const padData = createZonePadTexture(kind, label, color);
  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 2.1),
    new THREE.MeshBasicMaterial({
      map: padData.texture,
      alphaTest: 0.05,
      depthWrite: false,
      depthTest: false,
    }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.1;
  pad.renderOrder = RENDER_LAYER.serviceZone;
  marker.add(pad);
  return {
    group: marker,
    sign: {
      padCanvas: padData.canvas,
      padTexture: padData.texture,
      color,
      key: "",
    },
  };
}

function createZonePadTexture(
  kind: ZoneKind,
  label: string,
  color: number,
): { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  drawZonePad(
    canvas,
    color,
    {
      title: label,
      level: "",
      current: kind === "worker" ? "worker" : "gear",
      detail: "",
      progress: 0,
    },
    kind,
  );
  return { canvas, texture };
}

function drawZonePad(
  canvas: HTMLCanvasElement,
  color: number,
  data: ServiceSignData,
  kind: ZoneKind,
): void {
  const context = canvas.getContext("2d")!;
  const colorHex = `#${color.toString(16).padStart(6, "0")}`;
  const progress = THREE.MathUtils.clamp(data.progress, 0, 1);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineJoin = "round";
  context.beginPath();
  context.roundRect(42, 42, 428, 428, 58);
  context.fillStyle = "#30271ecc";
  context.fill();
  context.save();
  context.clip();
  context.fillStyle = "#fff4d622";
  context.fillRect(42, 42, 428, 428);
  const fillHeight = 428 * progress;
  context.fillStyle = `${colorHex}e8`;
  context.fillRect(42, 470 - fillHeight, 428, fillHeight);
  context.strokeStyle = "#fff4d638";
  context.lineWidth = 5;
  for (const amount of [0.25, 0.5, 0.75]) {
    const y = 470 - 428 * amount;
    context.beginPath();
    context.moveTo(54, y);
    context.lineTo(458, y);
    context.stroke();
  }
  context.restore();
  context.beginPath();
  context.roundRect(42, 42, 428, 428, 58);
  context.strokeStyle = "#30271e";
  context.lineWidth = 38;
  context.stroke();
  context.strokeStyle = "#fff4d6";
  context.lineWidth = 18;
  context.stroke();

  const action = zoneAction(kind);
  drawOutlinedText(
    context,
    action,
    256,
    122,
    "900 58px Figtree, sans-serif",
    "#fff4d6",
  );
  const image = SERVICE_ICON_IMAGES.get(data.current);
  if (image?.complete && image.naturalWidth > 0)
    context.drawImage(image, 181, 178, 150, 150);
  else drawServiceIcon(context, data.current, 256, 253, colorHex);
  drawOutlinedText(
    context,
    data.level || data.title,
    256,
    398,
    "900 52px Figtree, sans-serif",
    "#fff4d6",
  );
}

function createServiceBubble(): HTMLDivElement {
  const bubble = document.createElement("div");
  bubble.className = "service-cost-bubble";
  bubble.setAttribute("role", "status");
  bubble.setAttribute("aria-live", "polite");
  bubble.hidden = true;
  return bubble;
}

function serviceSignData(kind: ZoneKind, state: GameState): ServiceSignData {
  const campaign = state.campaign;
  const costs = campaignCosts();
  if (kind === "camp")
    return {
      title: "CAMP",
      level: "FONDATIONS",
      current: "wood",
      detail: `${String(Math.max(0, costs.campWood - campaign.campWood))} BOIS RESTANTS`,
      progress: campaign.campWood / costs.campWood,
    };
  if (kind === "sale") return saleSignData(state);
  if (kind === "sawmill") return sawmillSignData(state);
  if (kind === "tool") {
    const complete = state.tool.level >= 6;
    const unlocked = campaign.customersServed >= costs.customers;
    const cost = complete ? 0 : FOREST.toolCosts[state.tool.level]!;
    return {
      title: "HACHES",
      level: unlocked ? `NIV. ${String(state.tool.level)} / 6` : "VERROUILLÉ",
      current: "tool",
      detail: complete
        ? "NIVEAU MAXIMUM"
        : !unlocked
          ? "TERMINER LES VENTES"
          : `${String(Math.max(0, cost - state.payments.toolCoins))} PIÈCES RESTANTES`,
      progress: complete ? 1 : unlocked ? state.payments.toolCoins / cost : 0,
    };
  }
  if (kind === "worker") {
    const complete = state.workers.length >= FOREST.maxWorkers;
    const cost = complete ? 0 : FOREST.workerCosts[state.workers.length]!;
    let detail = `${String(Math.max(0, cost - state.payments.workerCoins))} PIÈCES RESTANTES`;
    let progress = Math.min(1, state.payments.workerCoins / cost);
    if (state.automationLevel === 0) {
      detail = "CHAÎNE NIV. 1 REQUISE";
      progress = 0;
    } else if (complete) {
      detail = "ÉQUIPE COMPLÈTE";
      progress = 1;
    }
    return {
      title: "OUVRIERS",
      level: `${String(state.workers.length)} / ${String(FOREST.maxWorkers)}`,
      current: "worker",
      detail,
      progress,
    };
  }
  if (kind === "automation") {
    const complete = state.automationLevel >= 3;
    const cost = complete
      ? 0
      : state.automationLevel === 0
        ? costs.automationPlanks
        : FOREST.automationCosts[state.automationLevel + 1]!;
    return {
      title: "CHAÎNE",
      level: `NIV. ${String(state.automationLevel)} / 3`,
      current: "gear",
      detail: complete
        ? "NIVEAU MAXIMUM"
        : `${String(Math.max(0, cost - state.automationProgress))} PLANCHES RESTANTES`,
      progress: complete ? 1 : state.automationProgress / cost,
    };
  }
  if (kind === "butcher") {
    const building = campaign.step === CAMPAIGN_STEPS.wildlife;
    const complete = state.butcher.level >= 3;
    const meatRequirement =
      FOREST.butcherMeatRequirements[state.butcher.level] ?? 0;
    const plankCost = FOREST.butcherPlankCosts[state.butcher.level] ?? 0;
    const meatReady = campaign.meatSold >= meatRequirement;
    const stock = ` · STOCK ${String(state.butcher.stock)}`;
    return {
      title: "BOUCHERIE",
      level: building
        ? "CONSTRUCTION"
        : `NIV. ${String(state.butcher.level)} / 3`,
      current: building ? "wood" : !meatReady || complete ? "meat" : "plank",
      detail: building
        ? `${String(campaign.butcherWood)} / ${String(costs.butcherWood)} BOIS`
        : complete
          ? `NIVEAU MAXIMUM${stock}`
          : `${String(campaign.meatSold)} / ${String(meatRequirement)} VIANDES · ${String(state.butcher.planks)} / ${String(plankCost)} PLANCHES${stock}`,
      progress: building
        ? campaign.butcherWood / costs.butcherWood
        : complete
          ? 1
          : meatReady
            ? 0.5 + (state.butcher.planks / plankCost) * 0.5
            : (campaign.meatSold / meatRequirement) * 0.5,
    };
  }
  if (kind === "canteen") {
    const complete = state.butcher.rationLevel >= 2;
    const locked = state.butcher.rationLevel >= state.butcher.level;
    const cost = complete ? 0 : FOREST.rationCosts[state.butcher.rationLevel]!;
    return {
      title: "RATIONS",
      level: `NIV. ${String(state.butcher.rationLevel)} / 2`,
      current: "meat",
      detail: complete
        ? `RATIONS MAXIMALES · STOCK ${String(state.butcher.stock)}`
        : locked
          ? `BOUCHERIE NIV. ${String(state.butcher.rationLevel + 1)} REQUISE`
          : `${String(Math.max(0, cost - state.butcher.rations))} VIANDES RESTANTES · STOCK ${String(state.butcher.stock)}`,
      progress: complete
        ? 1
        : locked
          ? state.butcher.rationLevel / 2
          : state.butcher.rations / cost,
    };
  }
  if (kind === "turret") {
    const complete = state.turret.level >= 3;
    const coinCost = complete ? 0 : FOREST.turretCosts[state.turret.level]!;
    const plankCost = complete
      ? 0
      : FOREST.turretPlankCosts[state.turret.level]!;
    const meatRequirement = complete
      ? 0
      : FOREST.turretMeatRequirements[state.turret.level]!;
    const meatReady = campaign.meatSold >= meatRequirement;
    const planksReady = state.turret.planks >= plankCost;
    return {
      title: "TOURELLES",
      level: `NIV. ${String(state.turret.level)} / 3`,
      current: planksReady ? "coin" : "plank",
      detail: complete
        ? "DÉFENSE MAXIMALE"
        : `${String(campaign.meatSold)} / ${String(meatRequirement)} VIANDES · ${String(state.turret.planks)} / ${String(plankCost)} PLANCHES · ${String(state.turret.coins)} / ${String(coinCost)} PIÈCES`,
      progress: complete
        ? 1
        : !meatReady
          ? campaign.meatSold / meatRequirement / 3
          : planksReady
            ? 2 / 3 + state.turret.coins / coinCost / 3
            : 1 / 3 + state.turret.planks / plankCost / 3,
    };
  }
  if (kind === "departure") return departureSignData(state);
  return monumentSignData(state);
}

function saleSignData(state: GameState): ServiceSignData {
  const campaign = state.campaign;
  const costs = campaignCosts();
  if (campaign.step === CAMPAIGN_STEPS.market)
    return {
      title: "VENTE",
      level: "CONSTRUCTION",
      current: "wood",
      detail: `${String(Math.max(0, costs.marketWood - campaign.marketWood))} BOIS RESTANTS`,
      progress: campaign.marketWood / costs.marketWood,
    };
  return {
    title: "VENTE",
    level: "COMPTOIR",
    current: "wood",
    detail: `${String(campaign.marketStock)} EN STOCK · ${String(campaign.customersServed)} CLIENTS`,
    progress: Math.min(1, campaign.customersServed / costs.customers),
  };
}

function sawmillSignData(state: GameState): ServiceSignData {
  const campaign = state.campaign;
  const costs = campaignCosts();
  if (campaign.step === CAMPAIGN_STEPS.sawmill)
    return {
      title: "SCIERIE",
      level: "CONSTRUCTION",
      current: "wood",
      detail: `${String(Math.max(0, costs.sawmillWood - campaign.sawmillWood))} BOIS RESTANTS`,
      progress: campaign.sawmillWood / costs.sawmillWood,
    };
  return {
    title: "SCIERIE",
    level: "PRODUCTION",
    current: "wood",
    detail: `${String(state.sawmill.wood)} BÛCHES EN ATTENTE`,
    progress: Math.min(1, state.sawmill.wood / 10),
  };
}

function departureSignData(state: GameState): ServiceSignData {
  return {
    title: "DÉPART",
    level: state.campaign.completed ? "BASE TERMINÉE" : "LISIÈRE",
    current: "monument",
    detail: state.campaign.completed
      ? "LA FORÊT CONTINUE"
      : "EXPLORE LA LISIÈRE",
    progress: 1,
  };
}

function monumentSignData(state: GameState): ServiceSignData {
  if (state.campaign.step === CAMPAIGN_STEPS.convoy) {
    const cost = campaignCosts().exitPlanks;
    return {
      title: "CHARGER",
      level: "CONVOI",
      current: "plank",
      detail: `${String(Math.max(0, cost - state.campaign.exitPlanks))} PLANCHES RESTANTES`,
      progress: Math.min(1, state.campaign.exitPlanks / cost),
    };
  }
  if (state.monument.stage < 3) {
    const cost = FOREST.monumentCosts[state.monument.stage]!;
    return {
      title: "CONSTRUIRE",
      level: `PALIER ${String(state.monument.stage + 1)} / 3`,
      current: "plank",
      detail: `${String(Math.max(0, cost - state.monument.progress))} PLANCHES RESTANTES`,
      progress: state.monument.progress / cost,
    };
  }
  return {
    title: state.campaign.completed ? "ACTIF" : "ACTIVER",
    level: "MONUMENT FINAL",
    current: "monument",
    detail: state.campaign.completed
      ? "BASE INDUSTRIELLE EN MARCHE"
      : "REVIENS SUR LA PLATEFORME",
    progress: state.campaign.completed ? 1 : 0.98,
  };
}

function drawOutlinedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: CanvasTextAlign = "center",
): void {
  context.font = font;
  context.textAlign = align;
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.strokeStyle = "#24170f";
  const fontSize = Number.parseFloat(/\d+/.exec(font)?.[0] ?? "32");
  context.lineWidth = Math.max(1.5, fontSize * 0.032);
  context.strokeText(text, x, y, 570);
  context.fillStyle = color;
  context.fillText(text, x, y, 570);
}

function drawServiceIcon(
  context: CanvasRenderingContext2D,
  kind: ServiceSignData["current"],
  x: number,
  y: number,
  color: string,
): void {
  context.save();
  context.translate(x, y);
  const image = SERVICE_ICON_IMAGES.get(kind);
  if (color !== "#080706" && image?.complete && image.naturalWidth > 0) {
    context.drawImage(image, -48, -48, 96, 96);
    context.restore();
    return;
  }
  context.fillStyle = color;
  const outline = color === "#080706" ? "#fff4cf" : "#24170f";
  context.strokeStyle = outline;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 9;
  if (kind === "coin") {
    context.beginPath();
    context.arc(0, 0, 34, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else if (kind === "wood") {
    context.roundRect(-42, -18, 84, 36, 18);
    context.fill();
    context.stroke();
    context.fillStyle = "#fff0bf77";
    context.beginPath();
    context.arc(-31, 0, 9, 0, Math.PI * 2);
    context.fill();
  } else if (kind === "plank") {
    context.rotate(-0.16);
    context.roundRect(-48, -14, 96, 28, 7);
    context.fill();
    context.stroke();
  } else if (kind === "tool") {
    context.rotate(-0.55);
    context.strokeStyle = outline;
    context.lineWidth = 20;
    context.beginPath();
    context.moveTo(-36, 34);
    context.lineTo(34, -34);
    context.stroke();
    context.strokeStyle = color;
    context.lineWidth = 11;
    context.stroke();
    context.strokeStyle = outline;
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(18, -42);
    context.lineTo(48, -12);
    context.lineTo(25, 5);
    context.closePath();
    context.fill();
    context.stroke();
  } else if (kind === "worker") {
    context.beginPath();
    context.arc(0, -24, 19, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.roundRect(-29, 0, 58, 48, 18);
    context.fill();
    context.stroke();
  } else if (kind === "gear") {
    context.lineWidth = 17;
    context.strokeStyle = outline;
    context.beginPath();
    context.arc(0, 0, 28, 0, Math.PI * 2);
    context.stroke();
    context.lineWidth = 9;
    context.strokeStyle = color;
    context.stroke();
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2;
      context.lineWidth = 17;
      context.strokeStyle = outline;
      context.beginPath();
      context.moveTo(Math.cos(angle) * 30, Math.sin(angle) * 30);
      context.lineTo(Math.cos(angle) * 43, Math.sin(angle) * 43);
      context.stroke();
      context.lineWidth = 9;
      context.strokeStyle = color;
      context.stroke();
    }
  } else {
    context.fillRect(-40, 22, 80, 20);
    context.strokeRect(-40, 22, 80, 20);
    context.fillRect(-29, -5, 58, 28);
    context.strokeRect(-29, -5, 58, 28);
    context.beginPath();
    context.moveTo(-20, -5);
    context.lineTo(0, -45);
    context.lineTo(20, -5);
    context.closePath();
    context.fill();
    context.stroke();
  }
  context.restore();
}

function createBaseStations(): THREE.Group {
  const stations = new THREE.Group();
  const stone = createToonMaterial({
    color: 0x8f8b78,
    roughness: 1,
  });
  const wood = createToonMaterial({
    color: 0xa9683f,
    roughness: 0.9,
  });
  const ember = createToonMaterial({
    color: 0xf29d49,
    emissive: 0x8a3515,
    emissiveIntensity: 0.55,
    roughness: 0.8,
  });

  const camp = new THREE.Group();
  camp.userData.minimumStep = 1;
  camp.position.set(-2.3, 0, -1.5);
  for (let index = 0; index < 8; index += 1) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.19, 0), stone);
    const angle = (index / 8) * Math.PI * 2;
    rock.position.set(Math.cos(angle) * 0.72, 0.16, Math.sin(angle) * 0.72);
    camp.add(rock);
  }
  for (const rotation of [-0.75, 0.75]) {
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.17, 1.1, 7),
      wood,
    );
    log.position.y = 0.24;
    log.rotation.set(Math.PI / 2, 0, rotation);
    camp.add(log);
  }
  const flame = new THREE.Group();
  flame.name = "campfire-flame";
  const outerFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.46, 1.05, 7),
    ember,
  );
  outerFlame.position.y = 0.72;
  const innerFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.25, 0.72, 7),
    createToonMaterial({
      color: 0xffe784,
      emissive: 0xf29d49,
      emissiveIntensity: 1.2,
      roughness: 0.7,
    }),
  );
  innerFlame.position.set(0.05, 0.65, -0.03);
  const sideFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.55, 6),
    ember,
  );
  sideFlame.position.set(-0.28, 0.5, 0.08);
  sideFlame.rotation.z = 0.24;
  flame.add(outerFlame, innerFlame, sideFlame);
  camp.add(flame);
  stations.add(camp);

  const toolRack = new THREE.Group();
  toolRack.userData.minimumStep = 3;
  toolRack.position.set(ZONES.tool.x, 0, ZONES.tool.z);
  for (const x of [-0.65, 0.65]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 1.7, 7),
      wood,
    );
    post.position.set(x, 0.85, 0);
    toolRack.add(post);
  }
  const rack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.16, 0.24), wood);
  rack.position.y = 1.25;
  toolRack.add(rack);
  stations.add(toolRack);

  const automationBench = new THREE.Group();
  automationBench.userData.minimumStep = 5;
  automationBench.position.set(ZONES.automation.x, 0, ZONES.automation.z);
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.22, 1), wood);
  bench.position.y = 0.82;
  automationBench.add(bench);
  for (const x of [-0.55, 0.55]) {
    const gear = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.1, 7, 12),
      createToonMaterial({ color: 0x9bc1bd, roughness: 0.55 }),
    );
    gear.position.set(x, 1.15, 0);
    gear.rotation.x = Math.PI / 2;
    automationBench.add(gear);
  }
  stations.add(automationBench);

  setStockShadows(stations);
  return stations;
}

function createSawmillPallet(): THREE.Group {
  const pallet = new THREE.Group();
  const wood = createToonMaterial({
    color: 0xc47f43,
    roughness: 1,
  });
  const darkWood = createToonMaterial({
    color: 0x74452f,
    roughness: 1,
  });
  for (const x of [-0.6, -0.3, 0, 0.3, 0.6]) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 1.1), wood);
    slat.position.set(x, 0.22, 0);
    pallet.add(slat);
  }
  for (const x of [-0.55, 0.55]) {
    const runner = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.22, 0.95),
      darkWood,
    );
    runner.position.set(x, 0.1, 0);
    pallet.add(runner);
  }
  setStockShadows(pallet);
  return pallet;
}

function createButcherBuilding(): THREE.Group {
  const building = new THREE.Group();
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.85, 0.75),
    createToonMaterial({ color: 0x9b513d, roughness: 0.9 }),
  );
  counter.position.y = 0.43;
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(2.15, 0.12, 1.15),
    createToonMaterial({ color: 0xf0d6a0, roughness: 0.92 }),
  );
  canopy.position.y = 1.65;
  for (const x of [-0.85, 0.85]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, 1.55, 6),
      createToonMaterial({ color: 0x633d2a, roughness: 1 }),
    );
    post.position.set(x, 0.86, 0);
    building.add(post);
  }
  building.add(counter, canopy);
  return building;
}

function createTurretBuilding(): THREE.Group {
  const turret = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.68, 0.65, 8),
    createToonMaterial({ color: 0x596d70, metalness: 0.2, roughness: 0.72 }),
  );
  base.position.y = 0.33;
  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.4, 0.4, 8),
    createToonMaterial({ color: 0x8aa2a0, metalness: 0.25, roughness: 0.62 }),
  );
  head.position.y = 0.82;
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.12, 0.9, 7),
    createToonMaterial({ color: 0x39494b, metalness: 0.35, roughness: 0.55 }),
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.88, 0.5);
  turret.add(base, head, barrel);
  return turret;
}

function createLaneIndicator(
  position: { x: number; z: number },
  text: string,
  color: number,
): THREE.Group {
  const indicator = new THREE.Group();
  indicator.position.set(position.x, 0, position.z);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.8,
    depthTest: false,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.9, 32), material);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  ring.renderOrder = RENDER_LAYER.serviceZone - 1;

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext("2d")!;
  drawOutlinedText(
    context,
    text,
    256,
    48,
    "900 34px Figtree, sans-serif",
    "#ffd37a",
  );
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  label.position.y = 2.45;
  label.scale.set(3.4, 0.72, 1);
  label.renderOrder = RENDER_LAYER.serviceZone - 1;
  indicator.add(ring, label);
  indicator.visible = false;
  return indicator;
}

function createWorkerDock(): THREE.Group {
  const dock = new THREE.Group();
  const metal = createToonMaterial({
    color: 0x398f91,
    metalness: 0.18,
    roughness: 0.7,
  });
  const belt = createToonMaterial({
    color: 0x30271e,
    roughness: 0.8,
  });
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.22, 1.5), metal);
  base.position.y = 0.24;
  const surface = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.08, 1.24), belt);
  surface.position.y = 0.4;
  dock.add(base, surface);
  for (const x of [-1.02, 1.02]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.42, 1.52), metal);
    rail.position.set(x, 0.5, 0);
    dock.add(rail);
  }
  setStockShadows(dock);
  return dock;
}

function createCustomerQueue(): THREE.Group {
  const queue = new THREE.Group();
  const dark = new THREE.MeshBasicMaterial({
    color: 0x30271e,
    side: THREE.DoubleSide,
  });
  const cream = new THREE.MeshBasicMaterial({
    color: 0xfff4d6,
    side: THREE.DoubleSide,
  });
  for (let index = 0; index < 6; index += 1) {
    const outline = new THREE.Mesh(
      new THREE.RingGeometry(0.31, 0.43, 20),
      dark,
    );
    const spot = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.38, 20), cream);
    const x = MARKET_TABLE.x - 1.5 - index * 1.15;
    const z = MARKET_TABLE.z;
    outline.position.set(x, 0.055, z);
    spot.position.set(x, 0.06, z);
    outline.rotation.x = spot.rotation.x = -Math.PI / 2;
    queue.add(outline, spot);
  }
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, -0.35);
  arrowShape.lineTo(0.3, 0.2);
  arrowShape.lineTo(0.1, 0.14);
  arrowShape.lineTo(0.1, 0.42);
  arrowShape.lineTo(-0.1, 0.42);
  arrowShape.lineTo(-0.1, 0.14);
  arrowShape.lineTo(-0.3, 0.2);
  arrowShape.closePath();
  const arrow = new THREE.Mesh(new THREE.ShapeGeometry(arrowShape), cream);
  arrow.rotation.x = -Math.PI / 2;
  arrow.position.set(MARKET_TABLE.x - 0.85, 0.065, MARKET_TABLE.z);
  arrow.rotation.z = -Math.PI / 2;
  queue.add(arrow);
  queue.visible = false;
  return queue;
}

function createMarketStock(): THREE.InstancedMesh {
  const geometry = createCarriedWoodGeometry();
  const stock = new THREE.InstancedMesh(
    geometry,
    [
      createToonMaterial({ color: 0x9f5e35, roughness: 0.9 }),
      createToonMaterial({ color: 0xe0a864, roughness: 0.86 }),
    ],
    128,
  );
  stock.castShadow = true;
  stock.receiveShadow = true;
  stock.frustumCulled = false;
  stock.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  stock.count = 0;
  return stock;
}

function syncMarketStock(stock: THREE.InstancedMesh, amount: number): void {
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const count = Math.min(128, amount);
  for (let index = 0; index < count; index += 1) {
    const offset = stackItemOffset(index);
    position.set(0.35 + offset.x, 1.14 + index * 0.3, -0.42 + offset.z);
    rotation.setFromEuler(new THREE.Euler(0, offset.rotation, 0));
    matrix.compose(position, rotation, scale);
    stock.setMatrixAt(index, matrix);
  }
  stock.count = count;
  stock.instanceMatrix.needsUpdate = true;
}

function setStockShadows(group: THREE.Group): void {
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
}

function setObjectOpacity(object: THREE.Object3D, opacity: number): void {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.Sprite))
      return;
    const material = child.material as THREE.Material | THREE.Material[];
    const materials = Array.isArray(material) ? material : [material];
    for (const material of materials) {
      material.transparent = opacity < 1;
      material.opacity = opacity;
    }
  });
}

function zoneColor(kind: ZoneKind): number {
  return {
    camp: 0x78c693,
    sale: 0xffd447,
    sawmill: 0xe78942,
    tool: 0x79b8ff,
    worker: 0xf29d49,
    automation: 0xbb7bed,
    monument: 0x65d68b,
    departure: 0xf6cc55,
    butcher: 0xd65a55,
    canteen: 0xe2a15a,
    turret: 0x78a8bd,
  }[kind];
}

function serviceVisible(kind: ZoneKind, state: GameState): boolean {
  const step = state.campaign.step;
  if (kind === "camp") return step === CAMPAIGN_STEPS.camp;
  if (kind === "sale") return step >= CAMPAIGN_STEPS.market;
  if (kind === "tool") return step >= CAMPAIGN_STEPS.trade;
  if (kind === "sawmill") return step >= CAMPAIGN_STEPS.sawmill;
  if (kind === "automation") return step >= CAMPAIGN_STEPS.automation;
  if (kind === "worker") return step >= CAMPAIGN_STEPS.worker;
  if (kind === "monument") return step >= CAMPAIGN_STEPS.convoy;
  if (kind === "butcher") return step >= CAMPAIGN_STEPS.wildlife;
  if (kind === "canteen") return step >= CAMPAIGN_STEPS.defense;
  if (kind === "turret") return step >= CAMPAIGN_STEPS.defense;
  return step === CAMPAIGN_STEPS.departure;
}

function zoneAction(kind: ZoneKind): string {
  if (kind === "departure") return "PARTIR";
  if (kind === "sale" || kind === "sawmill" || kind === "camp")
    return "DÉPOSER";
  if (kind === "tool" || kind === "worker" || kind === "turret")
    return "ACHETER";
  if (kind === "butcher") return "DÉPOSER";
  if (kind === "canteen") return "PRÉPARER";
  return "CONSTRUIRE";
}

function selectObjective(state: GameState): { icon: string; detail: string } {
  const campaign = state.campaign;
  const costs = campaignCosts();
  if (campaign.step === CAMPAIGN_STEPS.camp)
    return {
      icon: "CONSTRUIS TON CAMP",
      detail: `${String(campaign.campWood)} / ${String(costs.campWood)} bois`,
    };
  if (campaign.step === CAMPAIGN_STEPS.market)
    return {
      icon: "CONSTRUIS LE COMPTOIR",
      detail: `${String(campaign.marketWood)} / ${String(costs.marketWood)} bois`,
    };
  if (
    campaign.step === CAMPAIGN_STEPS.trade &&
    campaign.customersServed < costs.customers
  )
    return {
      icon: "APPROVISIONNE LE COMPTOIR",
      detail: `${String(campaign.customersServed)} / ${String(costs.customers)} clients`,
    };
  if (campaign.step === CAMPAIGN_STEPS.trade) {
    const cost = FOREST.toolCosts[state.tool.level]!;
    return {
      icon: "AMÉLIORE TES HACHES",
      detail: `${String(state.payments.toolCoins)} / ${String(cost)} pièces déposées`,
    };
  }
  if (campaign.step === CAMPAIGN_STEPS.sawmill)
    return {
      icon: "LA PORTE EST OUVERTE · CONSTRUIS LA SCIERIE",
      detail: `${String(campaign.sawmillWood)} / ${String(costs.sawmillWood)} bois`,
    };
  if (campaign.step === CAMPAIGN_STEPS.automation)
    return {
      icon: "PRODUIS DES PLANCHES · MONTE LA CHAÎNE",
      detail: `${String(state.automationProgress)} / ${String(costs.automationPlanks)} planches`,
    };
  if (campaign.step === CAMPAIGN_STEPS.worker)
    return {
      icon: "ENGAGE TON PREMIER BÛCHERON",
      detail: `${String(state.payments.workerCoins)} / ${String(FOREST.workerCosts[0])} pièces déposées`,
    };
  if (campaign.step === CAMPAIGN_STEPS.convoy)
    return {
      icon: "CHARGE LE CONVOI",
      detail: `${String(campaign.exitPlanks)} / ${String(costs.exitPlanks)} planches`,
    };
  if (campaign.step === CAMPAIGN_STEPS.departure)
    return {
      icon: "LA LISIÈRE EST OUVERTE",
      detail: "Explore la limite de la forêt",
    };
  if (campaign.step === CAMPAIGN_STEPS.wildlife)
    return {
      icon: "CONSTRUIS LA BOUCHERIE",
      detail: `${String(campaign.butcherWood)} / ${String(costs.butcherWood)} bois`,
    };
  if (campaign.step === CAMPAIGN_STEPS.defense) {
    const availableRationLevel = Math.min(2, state.butcher.level);
    if (
      state.butcher.rationLevel < availableRationLevel &&
      state.turret.level < state.butcher.level &&
      campaign.meatSold < FOREST.turretMeatRequirements[state.turret.level]!
    )
      return {
        icon: "CHOISIS L’USAGE DE LA VIANDE",
        detail: "Vends-la pour la défense ou prépare des rations",
      };
    if (
      state.turret.level < state.butcher.level &&
      campaign.meatSold < FOREST.turretMeatRequirements[state.turret.level]!
    )
      return {
        icon: "APPROVISIONNE LA BOUCHERIE",
        detail: "Vends assez de viande pour débloquer la défense",
      };
    if (state.turret.level < state.butcher.level)
      return {
        icon: "RENFORCE LA DÉFENSE",
        detail: `Améliore les tourelles au niveau ${String(state.butcher.level)}`,
      };
    if (state.butcher.level < 3) {
      const meatRequirement =
        FOREST.butcherMeatRequirements[state.butcher.level]!;
      return campaign.meatSold < meatRequirement
        ? {
            icon: "DÉVELOPPE LA BOUCHERIE",
            detail: "Vends de la viande pour débloquer son amélioration",
          }
        : {
            icon: "AMÉLIORE LA BOUCHERIE",
            detail: "Dépose des planches à la boucherie",
          };
    }
    if (state.turret.level < 3)
      return {
        icon: "RENFORCE LA DÉFENSE",
        detail: "Améliore les tourelles jusqu’au niveau 3",
      };
    if (state.butcher.rationLevel < 2)
      return {
        icon: "PRÉPARE DES RATIONS",
        detail: "Consacre de la viande aux ouvriers",
      };
    if (state.monument.stage < 3)
      return {
        icon: "CONSTRUIS LE MONUMENT",
        detail: `${String(state.monument.progress)} / ${String(FOREST.monumentCosts[state.monument.stage])} planches`,
      };
    if (!campaign.completed)
      return {
        icon: "REJOINS LE MONUMENT",
        detail: "Entre sur la plateforme pour activer la base",
      };
  }
  return campaign.completed
    ? {
        icon: "TA BASE EST ÉTABLIE",
        detail: "Continue à produire et à agrandir la forêt",
      }
    : { icon: "DÉFENDS LA BASE", detail: "Repousse les ours" };
}

function createSpeedTrails(material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [-0.18, 0, 0.22, 0.18, 0, 0.22, 0, 0, -0.28],
      3,
    ),
  );
  geometry.computeVertexNormals();
  for (let index = 0; index < 3; index += 1) {
    const trail = new THREE.Mesh(geometry, material);
    trail.position.set((index - 1) * 0.28, 0.035, -0.7 - index * 0.3);
    trail.scale.setScalar(1 - index * 0.16);
    group.add(trail);
  }
  group.visible = false;
  return group;
}

function createBuilding(
  color: number,
  width: number,
  height: number,
): THREE.Group {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, width * 0.78),
    createToonMaterial({ color, roughness: 0.85 }),
  );
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(width * 0.72, 0.65, 4),
    createToonMaterial({ color: 0x6d392d, roughness: 0.9 }),
  );
  roof.position.y = height * 0.5 + 0.3;
  roof.rotation.y = Math.PI / 4;
  base.castShadow = roof.castShadow = true;
  group.add(base, roof);
  return group;
}

function createMonument(): THREE.Group {
  const group = new THREE.Group();
  const colors = [0x384b54, 0x4f7180, 0xe0a93f, 0x72dca2];
  colors.forEach((color, index) => {
    const part = new THREE.Mesh(
      index === 0
        ? new THREE.CylinderGeometry(1.2, 1.5, 0.55, 10)
        : new THREE.TorusGeometry(0.75 - index * 0.08, 0.14, 8, 18),
      createToonMaterial({
        color,
        metalness: 0.35,
        roughness: 0.5,
      }),
    );
    part.position.y = index === 0 ? 0.28 : 0.65 + index * 0.48;
    if (index > 0) part.rotation.x = Math.PI / 2;
    part.castShadow = true;
    part.visible = index === 0;
    group.add(part);
  });
  return group;
}

function createConveyor(
  points: readonly { x: number; z: number }[],
  asset?: THREE.Object3D,
  elevation = 0,
): THREE.Group {
  const group = new THREE.Group();
  for (let index = 1; index < points.length; index += 1)
    group.add(createConveyorSegment(points[index - 1]!, points[index]!, asset));
  if (elevation > 0) {
    const supports = createToonMaterial({ color: 0xd99a35, roughness: 0.78 });
    for (const point of points.slice(1, -1)) {
      const support = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, elevation + 0.3, 0.2),
        supports,
      );
      support.position.set(point.x, -(elevation + 0.3) / 2 + 0.12, point.z);
      support.castShadow = true;
      group.add(support);
    }
    group.position.y = elevation;
  }
  return group;
}

function createConveyorSegment(
  from: { x: number; z: number },
  to: { x: number; z: number },
  asset?: THREE.Object3D,
): THREE.Group {
  const group = new THREE.Group();
  const length = Math.hypot(to.x - from.x, to.z - from.z);
  const angle = Math.atan2(to.x - from.x, to.z - from.z);
  if (asset) {
    const count = Math.max(1, Math.ceil(length / 2));
    const segmentLength = length / count;
    for (let index = 0; index < count; index += 1) {
      const amount = (index + 0.5) / count;
      const segment = cloneAsset(asset);
      segment.position.set(
        THREE.MathUtils.lerp(from.x, to.x, amount),
        0,
        THREE.MathUtils.lerp(from.z, to.z, amount),
      );
      segment.rotation.y = angle;
      segment.scale.z = segmentLength / 2;
      group.add(segment);
    }
    return group;
  }
  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.24, length),
    createToonMaterial({ color: 0x3f4e51, roughness: 0.75 }),
  );
  belt.position.set((from.x + to.x) / 2, 0.2, (from.z + to.z) / 2);
  belt.rotation.y = angle;
  group.add(belt);
  return group;
}

function createGate(length: number): THREE.Group {
  const gate = new THREE.Group();
  const halfLength = length / 2;
  const wood = createToonMaterial({
    color: 0x8f5436,
    roughness: 1,
  });
  const metal = createToonMaterial({
    color: 0x3f4e51,
    metalness: 0.45,
    roughness: 0.45,
  });
  for (const side of [-1, 1]) {
    const leaf = new THREE.Group();
    leaf.name = side < 0 ? "gate-left" : "gate-right";
    leaf.position.x = side * halfLength;
    const logCount = Math.max(2, Math.ceil(halfLength / 0.46));
    for (let index = 0; index < logCount; index += 1) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.24, 2.05, 7),
        wood,
      );
      post.position.set(-side * (0.25 + index * 0.46), 1.02, 0);
      post.castShadow = true;
      leaf.add(post);
    }
    for (const y of [0.48, 1.52]) {
      const hinge = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.16, 0.42),
        metal,
      );
      hinge.position.set(0, y, 0);
      leaf.add(hinge);
    }
    const handle = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 8, 6),
      createToonMaterial({ color: 0xf6cc55, roughness: 0.4 }),
    );
    handle.position.set(-side * (halfLength - 0.3), 1.05, -0.26);
    leaf.add(handle);
    gate.add(leaf);
  }
  const lock = new THREE.Mesh(
    new THREE.TorusGeometry(0.35, 0.12, 8, 16, Math.PI),
    createToonMaterial({
      color: 0xffcf3c,
      metalness: 0.4,
      roughness: 0.35,
    }),
  );
  lock.position.set(0, 1.2, -0.18);
  lock.name = "gate-lock";
  gate.add(lock);
  return gate;
}
