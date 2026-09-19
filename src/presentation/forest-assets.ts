import * as THREE from "three/webgpu";
import type { BufferGeometry, Mesh } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

import adventurerUrl from "../../assets/forest/adventurer.glb?url";
import adventurerCoralUrl from "../../assets/forest/adventurer-coral.glb?url";
import adventurerLeafUrl from "../../assets/forest/adventurer-leaf.glb?url";
import axeDoubleUrl from "../../assets/forest/axe-reinforced-double.glb?url";
import axeSimpleUrl from "../../assets/forest/axe-simple.glb?url";
import coinUrl from "../../assets/forest/coin.glb?url";
import conveyorStraightUrl from "../../assets/forest/conveyor-straight.glb?url";
import logUrl from "../../assets/forest/log.glb?url";
import monument1Url from "../../assets/forest/monument-stage-1.glb?url";
import monument2Url from "../../assets/forest/monument-stage-2.glb?url";
import monument3Url from "../../assets/forest/monument-stage-3.glb?url";
import plankUrl from "../../assets/forest/plank.glb?url";
import saleUrl from "../../assets/forest/sale-bench.glb?url";
import sawmill1Url from "../../assets/forest/sawmill-tier-1.glb?url";
import sawmill2Url from "../../assets/forest/sawmill-tier-2.glb?url";
import sawmill3Url from "../../assets/forest/sawmill-tier-3.glb?url";
import sawmill4Url from "../../assets/forest/sawmill-tier-4.glb?url";
import regrowthUrl from "../../assets/forest/tree-regrowth.glb?url";
import stumpUrl from "../../assets/forest/tree-stump.glb?url";
import workerUrl from "../../assets/forest/worker.glb?url";

export interface MeshAsset {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
}

export interface ForestAssets {
  adventurer: THREE.Object3D;
  worker: THREE.Object3D;
  customers: THREE.Object3D[];
  axeSimple: THREE.Object3D;
  axeDouble: THREE.Object3D;
  conveyorStraight: THREE.Object3D;
  sale: THREE.Object3D;
  sawmills: THREE.Object3D[];
  monuments: THREE.Object3D[];
  regrowth: MeshAsset;
  stump: MeshAsset;
  resources: {
    wood: MeshAsset;
    plank: MeshAsset;
    coin: MeshAsset;
  };
}

const loader = new GLTFLoader();
const outlineMaterial = new THREE.MeshBasicMaterial({
  color: 0x2a1d16,
  side: THREE.BackSide,
  toneMapped: false,
});
const toonMaterials = new WeakMap<THREE.Material, THREE.Material>();

export const OUTLINE_SCALE = 1.018;

export function createToonMaterial(
  parameters: THREE.MeshStandardMaterialParameters,
): THREE.MeshToonMaterial {
  const toonParameters = { ...parameters } as Record<string, unknown>;
  delete toonParameters.roughness;
  delete toonParameters.metalness;
  return new THREE.MeshToonMaterial(
    toonParameters as THREE.MeshToonMaterialParameters,
  );
}

export function getOutlineMaterial(): THREE.Material {
  return outlineMaterial;
}

export async function loadForestAssets(): Promise<ForestAssets> {
  const urls = [
    adventurerUrl,
    workerUrl,
    axeSimpleUrl,
    axeDoubleUrl,
    conveyorStraightUrl,
    saleUrl,
    sawmill1Url,
    sawmill2Url,
    sawmill3Url,
    sawmill4Url,
    monument1Url,
    monument2Url,
    monument3Url,
    regrowthUrl,
    stumpUrl,
    logUrl,
    plankUrl,
    coinUrl,
    adventurerCoralUrl,
    adventurerLeafUrl,
  ] as const;
  const models = await Promise.all(urls.map((url) => loader.loadAsync(url)));
  const scenes = models.map(({ scene }) => scene);
  return {
    adventurer: flattenAsset(scenes[0]!),
    worker: flattenAsset(scenes[1]!),
    customers: scenes.slice(18, 20).map(flattenAsset),
    axeSimple: flattenAsset(scenes[2]!),
    axeDouble: flattenAsset(scenes[3]!),
    conveyorStraight: flattenAsset(scenes[4]!),
    sale: flattenAsset(scenes[5]!),
    sawmills: scenes.slice(6, 10).map(flattenAsset),
    monuments: scenes.slice(10, 13).map(flattenAsset),
    regrowth: extractMesh(scenes[13]!),
    stump: extractMesh(scenes[14]!),
    resources: {
      wood: extractMesh(scenes[15]!),
      plank: extractMesh(scenes[16]!),
      coin: extractMesh(scenes[17]!),
    },
  };
}

function flattenAsset(root: THREE.Object3D): THREE.Object3D {
  const asset = extractMesh(root);
  return new THREE.Mesh(asset.geometry, asset.material);
}

export function cloneAsset(asset: THREE.Object3D): THREE.Object3D {
  const copy = clone(asset);
  copy.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const material = child.material as THREE.Material | THREE.Material[];
      child.material = Array.isArray(material)
        ? material.map(toToonMaterial)
        : toToonMaterial(material);
      child.castShadow = false;
      child.receiveShadow = true;
    }
  });
  return copy;
}

function extractMesh(root: THREE.Object3D): MeshAsset {
  root.updateMatrixWorld(true);
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  root.traverse((child) => {
    if (!(child as { isMesh?: boolean }).isMesh) return;
    const mesh = child as Mesh;
    const geometry: BufferGeometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    geometries.push(geometry);
    materials.push(
      toToonMaterial(
        Array.isArray(mesh.material) ? mesh.material[0]! : mesh.material,
      ),
    );
  });
  if (geometries.length === 0) throw new Error("Asset GLB sans maillage.");
  const firstMaterial = materials[0]!;
  const usesSingleMaterial = materials.every(
    (material) => material === firstMaterial,
  );
  const geometry = mergeGeometries(geometries, !usesSingleMaterial);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return {
    geometry,
    material: usesSingleMaterial ? firstMaterial : materials,
  };
}

function toToonMaterial(material: THREE.Material): THREE.Material {
  if (
    material instanceof THREE.MeshBasicMaterial ||
    material instanceof THREE.MeshToonMaterial
  )
    return material;
  const cached = toonMaterials.get(material);
  if (cached) return cached;
  if (!(material instanceof THREE.MeshStandardMaterial)) return material;
  const toon = new THREE.MeshToonMaterial({
    color: material.color,
    map: material.map,
    alphaMap: material.alphaMap,
    emissive: material.emissive,
    emissiveMap: material.emissiveMap,
    emissiveIntensity: material.emissiveIntensity,
    vertexColors: material.vertexColors,
    transparent: material.transparent,
    opacity: material.opacity,
    alphaTest: material.alphaTest,
    side: material.side,
  });
  toon.name = material.name;
  toonMaterials.set(material, toon);
  return toon;
}
