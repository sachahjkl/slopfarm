import * as THREE from "three/webgpu";
import { FOREST } from "../game/content";
import type { TreeState, Vector2 } from "../game/simulation";
import { createToonMaterial, type MeshAsset } from "./forest-assets";

export class TreeFieldView {
  readonly #leaves: THREE.InstancedMesh;
  readonly #stumps: THREE.InstancedMesh;
  readonly #farTrunks: THREE.InstancedMesh;
  readonly #farLeaves: THREE.InstancedMesh;
  readonly #matrix = new THREE.Matrix4();
  readonly #rotation = new THREE.Quaternion();
  readonly #scale = new THREE.Vector3();
  readonly #position = new THREE.Vector3();
  readonly #wobbles = new Map<number, number>();
  readonly #lastFocus = new THREE.Vector2(Number.POSITIVE_INFINITY, 0);
  #syncRemaining = 0;
  readonly #positions = new Map<number, Vector2>();

  constructor(scene: THREE.Scene, maximum: number) {
    this.#leaves = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1.2, 9, 7),
      createToonMaterial({ color: 0x247842, roughness: 0.9 }),
      maximum,
    );
    this.#stumps = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.3, 0.38, 0.25, 7),
      createToonMaterial({ color: 0x8a5130, roughness: 1 }),
      maximum,
    );
    this.#farTrunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.27, 0.38, 1.8, 5),
      new THREE.MeshToonMaterial({ color: 0x8a5130 }),
      maximum,
    );
    this.#farLeaves = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1.15, 0),
      new THREE.MeshToonMaterial({ color: 0x4d9a4a }),
      maximum,
    );
    this.#leaves.castShadow = this.#stumps.castShadow = false;
    for (const mesh of [
      this.#leaves,
      this.#stumps,
      this.#farTrunks,
      this.#farLeaves,
    ]) {
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
    scene.add(this.#leaves, this.#stumps, this.#farTrunks, this.#farLeaves);
  }

  useAssets(regrowth: MeshAsset, stump: MeshAsset): void {
    this.#leaves.geometry = regrowth.geometry;
    this.#leaves.material = regrowth.material;
    this.#stumps.geometry = stump.geometry;
    this.#stumps.material = stump.material;
  }

  sync(trees: readonly TreeState[], delta: number, focus: Vector2): void {
    this.#syncRemaining -= delta;
    const focusMoved =
      Math.hypot(focus.x - this.#lastFocus.x, focus.z - this.#lastFocus.y) >
      0.35;
    if (this.#syncRemaining > 0 && !focusMoved) return;
    this.#syncRemaining = 0.2;
    this.#lastFocus.set(focus.x, focus.z);
    this.#positions.clear();
    let nearCount = 0;
    let farCount = 0;
    trees.forEach((tree) => {
      const dx = tree.position.x - focus.x;
      const dz = tree.position.z - focus.z;
      const distanceSquared = dx * dx + dz * dz;
      if (distanceSquared > 16 * 16) return;
      this.#positions.set(tree.id, tree.position);
      const alive = tree.health > 0;
      const growth = tree.cleared
        ? 0
        : alive
          ? 0.9 + tree.health * 0.035
          : 0.65 +
            (1 - tree.respawnRemaining / FOREST.treeRespawnSeconds) * 0.35;
      const wobble =
        (this.#wobbles.get(tree.id) ?? 0) * Math.max(0, 1 - delta * 8);
      if (Math.abs(wobble) > 0.001) this.#wobbles.set(tree.id, wobble);
      else this.#wobbles.delete(tree.id);
      this.#rotation.setFromEuler(new THREE.Euler(0, tree.id * 0.71, wobble));
      if (alive) {
        this.#position.set(tree.position.x, 0.9 * growth, tree.position.z);
        this.#scale.setScalar(growth);
        this.#matrix.compose(this.#position, this.#rotation, this.#scale);
        this.#farTrunks.setMatrixAt(farCount, this.#matrix);
        this.#position.y = 2.6 * growth;
        this.#scale.set(growth, growth * 1.2, growth);
        this.#matrix.compose(this.#position, this.#rotation, this.#scale);
        this.#farLeaves.setMatrixAt(farCount, this.#matrix);
        farCount += 1;
        return;
      }
      if (distanceSquared > 12 * 12) return;
      this.#position.set(tree.position.x, 0, tree.position.z);
      const regrowing =
        !tree.cleared &&
        tree.respawnRemaining < FOREST.treeRespawnSeconds * 0.45;
      this.#scale.setScalar(regrowing ? growth : 0);
      this.#matrix.compose(this.#position, this.#rotation, this.#scale);
      this.#leaves.setMatrixAt(nearCount, this.#matrix);
      this.#position.y = 0.12;
      const stumpScale = tree.cleared || regrowing ? 0 : growth;
      this.#scale.setScalar(stumpScale);
      this.#matrix.compose(this.#position, this.#rotation, this.#scale);
      this.#stumps.setMatrixAt(nearCount, this.#matrix);
      nearCount += 1;
    });
    this.#leaves.count = this.#stumps.count = nearCount;
    this.#leaves.instanceMatrix.needsUpdate = true;
    this.#stumps.instanceMatrix.needsUpdate = true;
    this.#farTrunks.count = this.#farLeaves.count = farCount;
    this.#farTrunks.instanceMatrix.needsUpdate = true;
    this.#farLeaves.instanceMatrix.needsUpdate = true;
  }

  hit(position: Vector2): void {
    let closestId = -1;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const [id, treePosition] of this.#positions) {
      const candidate = Math.hypot(
        treePosition.x - position.x,
        treePosition.z - position.z,
      );
      if (candidate < closestDistance) {
        closestDistance = candidate;
        closestId = id;
      }
    }
    if (closestId >= 0)
      this.#wobbles.set(closestId, (closestId % 2 === 0 ? 1 : -1) * 0.17);
  }
}
