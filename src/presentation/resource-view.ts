import * as THREE from "three/webgpu";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type {
  ConveyorItemState,
  PickupKind,
  PickupState,
} from "../game/simulation";
import {
  MONUMENT_CONVEYOR_PATH,
  WORKER_CONVEYOR_PATH,
  pointAlongPath,
} from "../game/content";
import { stackedResourcePosition, stackItemOffset } from "../game/stack-layout";
import {
  createToonMaterial,
  getOutlineMaterial,
  type MeshAsset,
} from "./forest-assets";
import { RENDER_LAYER } from "./render-layers";
import { isSaleCoin, marketCoinPosition } from "./market-stock-layout";

export interface ResourceMeshes {
  geometries: Record<PickupKind, THREE.BufferGeometry>;
  materials: Record<PickupKind, THREE.Material | THREE.Material[]>;
}

export class ResourceView {
  readonly #meshes: Record<PickupKind, THREE.InstancedMesh>;
  readonly #outlines: Record<PickupKind, THREE.InstancedMesh>;
  readonly #matrix = new THREE.Matrix4();
  readonly #position = new THREE.Vector3();
  readonly #rotation = new THREE.Quaternion();
  readonly #scale = new THREE.Vector3(1, 1, 1);
  readonly #maximum: number;
  readonly #assetKinds = new Set<PickupKind>();

  constructor(scene: THREE.Scene, resources: ResourceMeshes, maximum = 512) {
    this.#maximum = maximum;
    this.#meshes = {
      wood: new THREE.InstancedMesh(
        resources.geometries.wood,
        resources.materials.wood,
        maximum,
      ),
      plank: new THREE.InstancedMesh(
        resources.geometries.plank,
        resources.materials.plank,
        maximum,
      ),
      coin: new THREE.InstancedMesh(
        resources.geometries.coin,
        resources.materials.coin,
        maximum,
      ),
      meat: new THREE.InstancedMesh(
        resources.geometries.meat,
        resources.materials.meat,
        maximum,
      ),
    };
    this.#outlines = {
      wood: new THREE.InstancedMesh(
        resources.geometries.wood,
        getOutlineMaterial(),
        maximum,
      ),
      plank: new THREE.InstancedMesh(
        resources.geometries.plank,
        getOutlineMaterial(),
        maximum,
      ),
      coin: new THREE.InstancedMesh(
        resources.geometries.coin,
        getOutlineMaterial(),
        maximum,
      ),
      meat: new THREE.InstancedMesh(
        resources.geometries.meat,
        getOutlineMaterial(),
        maximum,
      ),
    };
    for (const mesh of [
      ...Object.values(this.#outlines),
      ...Object.values(this.#meshes),
    ]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.renderOrder = RENDER_LAYER.resource;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
    }
  }

  useAssets(
    resources: Pick<Record<PickupKind, MeshAsset>, "wood" | "plank" | "coin">,
  ): void {
    for (const kind of ["wood", "plank", "coin"] as const) {
      this.#meshes[kind].geometry = resources[kind].geometry;
      this.#meshes[kind].material = resources[kind].material;
      this.#outlines[kind].geometry = resources[kind].geometry;
      this.#assetKinds.add(kind);
    }
  }

  sync(
    pickups: readonly PickupState[],
    conveyorItems: readonly ConveyorItemState[],
  ): void {
    const counts: Record<PickupKind, number> = {
      wood: 0,
      plank: 0,
      coin: 0,
      meat: 0,
    };
    for (const item of pickups) {
      const visibleAmount = Math.min(item.amount, this.#maximum);
      for (let index = 0; index < visibleAmount; index += 1) {
        const stacked =
          item.fixed || item.amount > 1
            ? stackedResourcePosition(item.kind, item.position, index)
            : item.position;
        const position =
          item.kind === "coin" && item.fixed && isSaleCoin(item.position)
            ? marketCoinPosition(stacked)
            : stacked;
        this.#set(
          item.kind,
          counts,
          position.x,
          position.y,
          position.z,
          item.rotation + stackItemOffset(index).rotation,
        );
      }
    }
    for (const item of conveyorItems) {
      const position = pointAlongPath(
        item.kind === "wood" ? WORKER_CONVEYOR_PATH : MONUMENT_CONVEYOR_PATH,
        item.progress,
      );
      this.#set(
        item.kind,
        counts,
        position.x,
        0.42,
        position.z,
        item.progress * 8,
      );
    }
    for (const kind of ["wood", "plank", "coin", "meat"] as const) {
      this.#meshes[kind].count = counts[kind];
      this.#meshes[kind].instanceMatrix.needsUpdate = true;
      this.#outlines[kind].count = 0;
      this.#outlines[kind].instanceMatrix.needsUpdate = true;
    }
  }

  #set(
    kind: PickupKind,
    counts: Record<PickupKind, number>,
    x: number,
    y: number,
    z: number,
    angle: number,
  ): void {
    if (counts[kind] >= this.#maximum) return;
    const index = counts[kind]++;
    this.#position.set(x, y, z);
    const usesAsset = this.#assetKinds.has(kind);
    const scale = usesAsset
      ? kind === "coin"
        ? 1.7
        : 1.25
      : kind === "coin"
        ? 1.45
        : 1.15;
    this.#scale.setScalar(scale);
    this.#rotation.setFromEuler(
      usesAsset
        ? new THREE.Euler(0, angle, 0)
        : kind === "coin"
          ? new THREE.Euler(Math.PI / 2, angle, 0)
          : new THREE.Euler(
              angle,
              0,
              kind === "wood" ? Math.PI / 2 + angle : angle * 0.2,
            ),
    );
    this.#matrix.compose(this.#position, this.#rotation, this.#scale);
    this.#meshes[kind].setMatrixAt(index, this.#matrix);
  }
}

export class CarryStackView {
  readonly #stack = new THREE.Group();
  readonly #wood: THREE.InstancedMesh;
  readonly #planks: THREE.InstancedMesh;
  readonly #meat: THREE.InstancedMesh;
  readonly #woodOutline: THREE.InstancedMesh;
  readonly #plankOutline: THREE.InstancedMesh;
  readonly #meatOutline: THREE.InstancedMesh;
  readonly #matrix = new THREE.Matrix4();
  readonly #position = new THREE.Vector3();
  readonly #rotation = new THREE.Quaternion();
  readonly #scale = new THREE.Vector3(1, 1, 1);
  #sway = 0;
  #feedbackRemaining = 0;
  constructor(player: THREE.Object3D, maximum = 512) {
    const carriedWoodGeometry = createCarriedWoodGeometry();
    const carriedPlankGeometry = createCarriedPlankGeometry();
    const carriedMeatGeometry = new THREE.CapsuleGeometry(0.13, 0.2, 3, 7);
    const carriedWoodMaterials = [
      createToonMaterial({ color: 0x9f5e35, roughness: 0.9 }),
      createToonMaterial({ color: 0xe0a864, roughness: 0.86 }),
    ];
    const carriedPlankMaterials = [
      createToonMaterial({ color: 0xe3ad69, roughness: 0.86 }),
      createToonMaterial({ color: 0x6f4932, roughness: 0.92 }),
    ];
    const carriedMeatMaterial = createToonMaterial({
      color: 0xc6534f,
      roughness: 0.88,
    });
    this.#wood = new THREE.InstancedMesh(
      carriedWoodGeometry,
      carriedWoodMaterials,
      maximum,
    );
    this.#planks = new THREE.InstancedMesh(
      carriedPlankGeometry,
      carriedPlankMaterials,
      maximum,
    );
    this.#meat = new THREE.InstancedMesh(
      carriedMeatGeometry,
      carriedMeatMaterial,
      maximum,
    );
    this.#woodOutline = new THREE.InstancedMesh(
      carriedWoodGeometry,
      getOutlineMaterial(),
      maximum,
    );
    this.#plankOutline = new THREE.InstancedMesh(
      carriedPlankGeometry,
      getOutlineMaterial(),
      maximum,
    );
    this.#meatOutline = new THREE.InstancedMesh(
      carriedMeatGeometry,
      getOutlineMaterial(),
      maximum,
    );
    this.#wood.castShadow =
      this.#planks.castShadow =
      this.#meat.castShadow =
        true;
    this.#wood.renderOrder =
      this.#planks.renderOrder =
      this.#meat.renderOrder =
        20;
    this.#wood.receiveShadow =
      this.#planks.receiveShadow =
      this.#meat.receiveShadow =
        true;
    this.#wood.frustumCulled =
      this.#planks.frustumCulled =
      this.#meat.frustumCulled =
        false;
    this.#wood.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.#planks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.#meat.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.#woodOutline.frustumCulled =
      this.#plankOutline.frustumCulled =
      this.#meatOutline.frustumCulled =
        false;
    this.#woodOutline.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.#plankOutline.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.#meatOutline.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.#stack.add(
      this.#woodOutline,
      this.#plankOutline,
      this.#meatOutline,
      this.#wood,
      this.#planks,
      this.#meat,
    );
    player.add(this.#stack);
  }

  sync(wood: number, planks: number, meat: number, delta: number): void {
    const total = wood + planks + meat;
    const targetSway =
      Math.sin(performance.now() * 0.003) * Math.min(0.018, total * 0.0004);
    this.#sway = THREE.MathUtils.lerp(this.#sway, targetSway, delta * 5);
    this.#stack.rotation.z = this.#sway;
    this.#feedbackRemaining = Math.max(0, this.#feedbackRemaining - delta);
    const feedbackProgress = this.#feedbackRemaining / 0.3;
    this.#stack.scale.setScalar(
      1 + Math.sin(feedbackProgress * Math.PI) * 0.14,
    );
    const woodVisible = Math.min(512, wood);
    const plankVisible = Math.min(512, planks);
    const meatVisible = Math.min(512, meat);
    const typeCount =
      Number(woodVisible > 0) +
      Number(plankVisible > 0) +
      Number(meatVisible > 0);
    const centers = stackCenters([
      woodVisible > 0,
      plankVisible > 0,
      meatVisible > 0,
    ]);
    this.#fill(this.#wood, woodVisible, centers[0], "wood", typeCount);
    this.#fill(this.#planks, plankVisible, centers[1], "plank", typeCount);
    this.#fill(this.#meat, meatVisible, centers[2], "meat", typeCount);
  }

  feedback(): void {
    this.#feedbackRemaining = 0.3;
  }

  #fill(
    mesh: THREE.InstancedMesh,
    count: number,
    centerX: number,
    kind: "wood" | "plank" | "meat",
    typeCount: number,
  ): void {
    const outline =
      kind === "wood"
        ? this.#woodOutline
        : kind === "plank"
          ? this.#plankOutline
          : this.#meatOutline;
    const itemScale = typeCount === 2 ? 1.02 : 1.16;
    this.#scale.setScalar(itemScale);
    for (let index = 0; index < count; index += 1) {
      const offset = stackItemOffset(index);
      this.#position.set(
        centerX + offset.x,
        0.72 + index * 0.32,
        -0.56 + offset.z,
      );
      this.#rotation.setFromEuler(new THREE.Euler(0, offset.rotation, 0));
      this.#matrix.compose(this.#position, this.#rotation, this.#scale);
      mesh.setMatrixAt(index, this.#matrix);
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    outline.count = 0;
    outline.instanceMatrix.needsUpdate = true;
  }
}

function stackCenters(active: readonly boolean[]): [number, number, number] {
  const positions =
    active.filter(Boolean).length === 3
      ? [-0.36, 0, 0.36]
      : active.filter(Boolean).length === 2
        ? [-0.21, 0.21]
        : [0];
  const result: [number, number, number] = [0, 0, 0];
  let positionIndex = 0;
  active.forEach((visible, index) => {
    if (!visible) return;
    result[index] = positions[positionIndex++] ?? 0;
  });
  return result;
}

export function createCarriedWoodGeometry(): THREE.BufferGeometry {
  const block = withoutIndex(new RoundedBoxGeometry(0.32, 0.3, 0.32, 2, 0.045));
  const endGrain = withoutIndex(
    new THREE.CylinderGeometry(0.105, 0.105, 0.018, 12),
  );
  endGrain.translate(0, 0.159, 0);
  return mergeCarriedGeometry([block, endGrain]);
}

export function createCarriedPlankGeometry(): THREE.BufferGeometry {
  const block = withoutIndex(new RoundedBoxGeometry(0.32, 0.3, 0.32, 2, 0.035));
  const straps: THREE.BufferGeometry[] = [];
  for (const x of [-0.09, 0.09]) {
    const strap = withoutIndex(new THREE.BoxGeometry(0.035, 0.018, 0.33));
    strap.translate(x, 0.159, 0);
    straps.push(strap);
  }
  return mergeCarriedGeometry([block, ...straps]);
}

function withoutIndex(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  return geometry.index ? geometry.toNonIndexed() : geometry;
}

function mergeCarriedGeometry(
  geometries: THREE.BufferGeometry[],
): THREE.BufferGeometry {
  return mergeGeometries(geometries, true);
}
