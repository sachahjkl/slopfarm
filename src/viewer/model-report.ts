import * as THREE from "three";

export interface ModelMetrics {
  animations: string[];
  bounds: { x: number; y: number; z: number };
  materials: number;
  meshes: number;
  nodes: number;
  triangles: number;
  vertices: number;
}

export function inspectModel(
  root: THREE.Object3D,
  animations: THREE.AnimationClip[],
): ModelMetrics {
  const materialIds = new Set<string>();
  let meshes = 0;
  let nodes = 0;
  let triangles = 0;
  let vertices = 0;

  root.traverse((node) => {
    nodes += 1;
    if (!("isMesh" in node)) return;
    const mesh = node as THREE.Mesh;
    const positionCount = mesh.geometry.attributes.position?.count ?? 0;
    meshes += 1;
    vertices += positionCount;
    triangles += mesh.geometry.index
      ? mesh.geometry.index.count / 3
      : positionCount / 3;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of materials) materialIds.add(material.uuid);
  });

  const size = new THREE.Box3()
    .setFromObject(root)
    .getSize(new THREE.Vector3());
  return {
    animations: animations.map(({ name }) => name || "Sans nom"),
    bounds: { x: size.x, y: size.y, z: size.z },
    materials: materialIds.size,
    meshes,
    nodes,
    triangles: Math.round(triangles),
    vertices,
  };
}
