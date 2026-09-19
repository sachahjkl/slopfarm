import * as THREE from "three/webgpu";
import type {
  GameEvent,
  GameState,
  LootState,
  TreeState,
} from "../game/simulation";
import { Effects } from "../game/effects";

export class GameView {
  readonly #scene = new THREE.Scene();
  readonly #camera = new THREE.OrthographicCamera(-9, 9, 9, -9, 0.1, 100);
  readonly #renderer: THREE.WebGPURenderer;
  readonly #player = createPlayer();
  readonly #stack = new THREE.Group();
  readonly #effects: Effects;
  readonly #woodLabel: HTMLElement;
  readonly #treeViews = new Map<number, THREE.Group>();
  readonly #lootViews = new Map<number, THREE.Mesh>();
  readonly #lootPool: THREE.Mesh[] = [];
  readonly #axes: THREE.Group[] = [];
  readonly #logGeometry = new THREE.CylinderGeometry(0.16, 0.2, 0.72, 7);
  readonly #logMaterial = new THREE.MeshStandardMaterial({
    color: 0x9b592f,
    roughness: 0.9,
  });
  #stackCount = 0;

  constructor(canvas: HTMLCanvasElement, woodLabel: HTMLElement) {
    this.#woodLabel = woodLabel;
    this.#renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
    this.#renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.#renderer.shadowMap.enabled = true;
    this.#scene.background = new THREE.Color(0x91d9ef);
    this.#scene.fog = new THREE.Fog(0x91d9ef, 25, 48);
    this.#camera.position.set(13, 16, 13);
    this.#scene.add(new THREE.HemisphereLight(0xdff6ff, 0x50833c, 2.2));
    const sun = new THREE.DirectionalLight(0xfff1c4, 3.5);
    sun.position.set(-10, 18, 8);
    sun.castShadow = true;
    this.#scene.add(sun, createGround(), this.#player);
    this.#stack.position.set(0, 1.05, -0.48);
    this.#player.add(this.#stack);
    this.#effects = new Effects(this.#scene);
    this.resize();
  }

  async initialize(): Promise<void> {
    await this.#renderer.init();
  }

  resize(): void {
    const view = 9;
    const aspect = innerWidth / innerHeight;
    this.#camera.left = -view * aspect;
    this.#camera.right = view * aspect;
    this.#camera.top = view;
    this.#camera.bottom = -view;
    this.#camera.updateProjectionMatrix();
    this.#renderer.setSize(innerWidth, innerHeight, false);
  }

  render(state: GameState, events: readonly GameEvent[], delta: number): void {
    this.#syncPlayer(state);
    this.#syncTrees(state.trees);
    this.#syncAxes(state);
    this.#syncLoot(state.loot);
    this.#consumeEvents(events);
    this.#effects.update(delta);
    this.#animateStack(delta);
    this.#camera.position.x = state.player.position.x + 13;
    this.#camera.position.z = state.player.position.z + 13;
    this.#camera.lookAt(this.#player.position);
    this.#renderer.render(this.#scene, this.#camera);
  }

  #syncPlayer(state: GameState): void {
    this.#player.position.set(
      state.player.position.x,
      0,
      state.player.position.z,
    );
    this.#player.rotation.y = state.player.heading;
  }

  #syncTrees(trees: readonly TreeState[]): void {
    for (const tree of trees) {
      let view = this.#treeViews.get(tree.id);
      if (!view) {
        view = createTree();
        view.position.set(tree.position.x, 0, tree.position.z);
        this.#scene.add(view);
        this.#treeViews.set(tree.id, view);
      }
      view.visible = tree.health > 0;
      view.scale.setScalar(0.9 + Math.max(0, tree.health) * 0.035);
      view.rotation.z *= 0.82;
    }
  }

  #syncAxes(state: GameState): void {
    while (this.#axes.length < state.tool.positions.length) {
      const axe = createAxe();
      this.#scene.add(axe);
      this.#axes.push(axe);
    }
    while (this.#axes.length > state.tool.positions.length) {
      const axe = this.#axes.pop();
      if (axe) this.#scene.remove(axe);
    }
    state.tool.positions.forEach((position, index) => {
      const axe = this.#axes[index]!;
      axe.position.set(position.x, 0.9, position.z);
      const angle =
        state.tool.angle + (index / state.tool.positions.length) * Math.PI * 2;
      axe.rotation.set(Math.sin(angle * 2) * 0.12, -angle + Math.PI / 2, 0);
      axe.scale.setScalar(1 + state.tool.level * 0.045);
    });
  }

  #syncLoot(loot: readonly LootState[]): void {
    const activeIds = new Set(loot.map(({ id }) => id));
    for (const [id, view] of this.#lootViews) {
      if (activeIds.has(id)) continue;
      view.visible = false;
      this.#lootViews.delete(id);
      this.#lootPool.push(view);
    }
    for (const item of loot) {
      const view = this.#lootViews.get(item.id) ?? this.#takeLootView(item.id);
      view.position.set(item.position.x, item.position.y, item.position.z);
      view.rotation.set(item.rotation, 0, Math.PI / 2 + item.rotation);
    }
  }

  #takeLootView(id: number): THREE.Mesh {
    const view =
      this.#lootPool.pop() ??
      new THREE.Mesh(this.#logGeometry, this.#logMaterial);
    view.visible = true;
    view.castShadow = true;
    if (!view.parent) this.#scene.add(view);
    this.#lootViews.set(id, view);
    return view;
  }

  #consumeEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      if (event.type === "tool.upgraded") {
        this.#effects.burst(
          this.#player.position.clone().add(new THREE.Vector3(0, 1, 0)),
          0xffdc55,
          30,
        );
        continue;
      }
      const position = new THREE.Vector3(
        event.position.x,
        1.2,
        event.position.z,
      );
      if (event.type === "tree.hit") {
        this.#effects.burst(position, 0xb87838, 11);
        const tree = [...this.#treeViews.values()].find(
          (view) => view.position.distanceTo(position) < 1.5,
        );
        if (tree) tree.rotation.z = (Math.random() - 0.5) * 0.2;
      } else if (event.type === "tree.destroyed") {
        position.y = 2;
        this.#effects.burst(position, 0x45a84f, 24);
      } else {
        this.#addStackLog();
        this.#woodLabel.textContent = String(event.total);
        this.#effects.burst(position, 0xffd65a, 6);
      }
    }
  }

  #addStackLog(): void {
    const index = this.#stackCount++;
    const log = new THREE.Mesh(this.#logGeometry, this.#logMaterial);
    log.position.set(((index % 3) - 1) * 0.36, Math.floor(index / 3) * 0.24, 0);
    log.rotation.set(0, (index % 2) * 0.12 - 0.06, Math.PI / 2);
    log.scale.setScalar(0.01);
    log.castShadow = true;
    this.#stack.add(log);
  }

  #animateStack(delta: number): void {
    const sway =
      Math.sin(performance.now() * 0.004) *
      Math.min(0.15, this.#stackCount * 0.005);
    this.#stack.rotation.z = THREE.MathUtils.lerp(
      this.#stack.rotation.z,
      sway,
      delta * 5,
    );
    for (const log of this.#stack.children) {
      log.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, delta * 12));
    }
  }
}

function createGround(): THREE.Mesh {
  const ground = new THREE.Mesh(
    new THREE.CylinderGeometry(15, 17, 1.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x73bd4e, roughness: 1 }),
  );
  ground.position.y = -0.8;
  ground.receiveShadow = true;
  return ground;
}

function createPlayer(): THREE.Group {
  const player = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.52, 0.8, 5, 10),
    new THREE.MeshStandardMaterial({ color: 0x3a78e0, roughness: 0.8 }),
  );
  body.position.y = 1;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 16, 10),
    new THREE.MeshStandardMaterial({ color: 0xffbe82, roughness: 0.9 }),
  );
  head.position.y = 2;
  body.castShadow = head.castShadow = true;
  player.add(body, head);
  return player;
}

function createTree(): THREE.Group {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.38, 1.8, 7),
    new THREE.MeshStandardMaterial({ color: 0x8a5130, roughness: 1 }),
  );
  trunk.position.y = 0.9;
  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(1.25, 2.7, 8),
    new THREE.MeshStandardMaterial({ color: 0x247842, roughness: 0.9 }),
  );
  leaves.position.y = 2.6;
  trunk.castShadow = leaves.castShadow = true;
  tree.add(trunk, leaves);
  return tree;
}

function createAxe(): THREE.Group {
  const axe = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 1.25, 8),
    new THREE.MeshStandardMaterial({ color: 0x7b4327, roughness: 0.85 }),
  );
  handle.rotation.z = Math.PI / 2;
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.62, 0.58),
    new THREE.MeshStandardMaterial({
      color: 0xdce8e7,
      metalness: 0.65,
      roughness: 0.28,
    }),
  );
  blade.position.x = 0.58;
  handle.castShadow = blade.castShadow = true;
  axe.add(handle, blade);
  return axe;
}
