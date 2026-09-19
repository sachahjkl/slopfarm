import * as THREE from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { inspectModel, type ModelMetrics } from "./model-report";
import "./style.css";

type ElementConstructor<T extends Element> = new (...args: never[]) => T;

function find<T extends Element>(
  selector: string,
  constructor: ElementConstructor<T>,
): T {
  const result = document.querySelector(selector);
  if (!(result instanceof constructor)) {
    throw new Error(`Élément d’interface absent : ${selector}`);
  }
  return result;
}

const canvas = find("#viewer", HTMLCanvasElement);
const fileInput = find("#model-file", HTMLInputElement);
const dropZone = find("#drop-zone", HTMLLabelElement);
const metricsElement = find("#metrics", HTMLDListElement);
const animationSelect = find("#animation", HTMLSelectElement);
const feedbackInput = find("#feedback", HTMLTextAreaElement);
const status = find("#status", HTMLParagraphElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222826);
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
camera.position.set(4, 3, 5);
const renderer = new THREE.WebGPURenderer({
  canvas,
  antialias: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
const keyLight = new THREE.DirectionalLight(0xfff3d6, 2.5);
keyLight.position.set(4, 7, 5);
keyLight.castShadow = true;
scene.add(keyLight, new THREE.HemisphereLight(0xd8ecff, 0x40382f, 1.5));
const helpers = new THREE.Group();
helpers.add(
  new THREE.GridHelper(20, 20, 0x7f9189, 0x3a4541),
  new THREE.AxesHelper(2),
);
scene.add(helpers);

let currentModel: THREE.Object3D | undefined;
let currentFile = "";
let currentMetrics: ModelMetrics | undefined;
let mixer: THREE.AnimationMixer | undefined;
let animations: THREE.AnimationClip[] = [];
let objectUrl: string | undefined;
let previousTime = performance.now();

function frameModel(): void {
  if (!currentModel) return;
  const sphere = new THREE.Box3()
    .setFromObject(currentModel)
    .getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(sphere.radius, 0.1);
  controls.target.copy(sphere.center);
  camera.near = Math.max(radius / 100, 0.001);
  camera.far = radius * 100;
  camera.position
    .copy(sphere.center)
    .add(new THREE.Vector3(1, 0.7, 1).normalize().multiplyScalar(radius * 3.2));
  camera.updateProjectionMatrix();
  controls.update();
}

function disposeModel(): void {
  if (!currentModel) return;
  scene.remove(currentModel);
  currentModel.traverse((node) => {
    if (!("isMesh" in node)) return;
    const mesh = node as THREE.Mesh;
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of materials) material.dispose();
  });
}

function showMetrics(metrics: ModelMetrics): void {
  const rows: [string, string][] = [
    ["Fichier", currentFile],
    [
      "Dimensions",
      `${metrics.bounds.x.toFixed(2)} × ${metrics.bounds.y.toFixed(2)} × ${metrics.bounds.z.toFixed(2)} m`,
    ],
    ["Triangles", metrics.triangles.toLocaleString("fr-FR")],
    ["Sommets", metrics.vertices.toLocaleString("fr-FR")],
    ["Maillages", String(metrics.meshes)],
    ["Matériaux", String(metrics.materials)],
    ["Nœuds", String(metrics.nodes)],
    ["Animations", String(metrics.animations.length)],
  ];
  metricsElement.replaceChildren(
    ...rows.flatMap(([term, value]) => {
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = term;
      dd.textContent = value;
      return [dt, dd];
    }),
  );
}

function configureAnimations(gltf: GLTF): void {
  animations = gltf.animations;
  mixer =
    animations.length > 0 ? new THREE.AnimationMixer(gltf.scene) : undefined;
  animationSelect.replaceChildren(new Option("Aucune", "-1"));
  animations.forEach((clip, index) =>
    animationSelect.add(
      new Option(clip.name || `Animation ${String(index + 1)}`, String(index)),
    ),
  );
  animationSelect.disabled = animations.length === 0;
  if (animations.length > 0) {
    animationSelect.value = "0";
    mixer?.clipAction(animations[0]!).play();
  }
}

async function loadFile(file: File): Promise<void> {
  if (!file.name.toLowerCase().endsWith(".glb"))
    throw new Error("Le viewer accepte uniquement les fichiers GLB.");
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  const gltf = await new GLTFLoader().loadAsync(objectUrl);
  disposeModel();
  currentFile = file.name;
  currentModel = gltf.scene;
  currentModel.traverse((node) => {
    if ("isMesh" in node) (node as THREE.Mesh).castShadow = true;
  });
  scene.add(currentModel);
  currentMetrics = inspectModel(currentModel, gltf.animations);
  showMetrics(currentMetrics);
  configureAnimations(gltf);
  frameModel();
  status.textContent = `${file.name} est prêt pour la revue.`;
}

function download(name: string, source: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([source], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function showError(cause: unknown): void {
  status.textContent =
    cause instanceof Error ? cause.message : "Chargement impossible.";
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) void loadFile(file).catch(showError);
});
for (const name of ["dragenter", "dragover"]) {
  dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
}
for (const name of ["dragleave", "drop"]) {
  dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  });
}
dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files[0];
  if (file) void loadFile(file).catch(showError);
});
animationSelect.addEventListener("change", () => {
  mixer?.stopAllAction();
  const clip = animations[Number(animationSelect.value)];
  if (clip) mixer?.clipAction(clip).play();
});
find("#light", HTMLInputElement).addEventListener("input", (event) => {
  keyLight.intensity = Number((event.target as HTMLInputElement).value);
});
find("#grid", HTMLInputElement).addEventListener("change", (event) => {
  helpers.visible = (event.target as HTMLInputElement).checked;
});
find("#wireframe", HTMLInputElement).addEventListener("change", (event) => {
  const enabled = (event.target as HTMLInputElement).checked;
  currentModel?.traverse((node) => {
    if (!("isMesh" in node)) return;
    const mesh = node as THREE.Mesh;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of materials)
      if ("wireframe" in material) material.wireframe = enabled;
  });
});
find("#reset-camera", HTMLButtonElement).addEventListener("click", frameModel);
find("#screenshot", HTMLButtonElement).addEventListener("click", () => {
  renderer.render(scene, camera);
  canvas.toBlob((blob) => {
    if (blob)
      download(`${currentFile || "model"}-review.png`, blob, "image/png");
  });
});
find("#export-feedback", HTMLButtonElement).addEventListener("click", () => {
  if (!currentMetrics) {
    status.textContent = "Charge un modèle avant d’exporter le retour.";
    return;
  }
  const report = {
    schema: "slopfarm-model-review/v1",
    file: currentFile,
    feedback: feedbackInput.value.trim(),
    metrics: currentMetrics,
    view: {
      camera: camera.position.toArray(),
      target: controls.target.toArray(),
      wireframe: find("#wireframe", HTMLInputElement).checked,
    },
  };
  download(
    `${currentFile}-review.json`,
    JSON.stringify(report, null, 2),
    "application/json",
  );
  status.textContent =
    "Retour exporté. Envoie le JSON avec le modèle ou sa référence.";
});

function resize(): void {
  const panelWidth = innerWidth > 800 ? Math.min(390, innerWidth * 0.38) : 0;
  const width = innerWidth - panelWidth;
  const height =
    innerWidth > 800 ? innerHeight : Math.max(innerHeight * 0.48, 320);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
addEventListener("resize", resize);
resize();

await renderer.init();
void renderer.setAnimationLoop((time) => {
  mixer?.update(Math.min((time - previousTime) / 1000, 0.1));
  previousTime = time;
  controls.update();
  renderer.render(scene, camera);
});
