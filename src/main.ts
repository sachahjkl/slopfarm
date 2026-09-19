import * as THREE from "three/webgpu";
import { harvestWood, initialEconomy } from "./economy";
import "./style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const error = document.querySelector<HTMLParagraphElement>("#error")!;
const woodLabel = document.querySelector<HTMLElement>("#wood")!;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x91d9ef);
scene.fog = new THREE.Fog(0x91d9ef, 25, 48);

const camera = new THREE.OrthographicCamera(-9, 9, 9, -9, 0.1, 100);
camera.position.set(13, 16, 13);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

scene.add(new THREE.HemisphereLight(0xdff6ff, 0x50833c, 2.2));
const sun = new THREE.DirectionalLight(0xfff1c4, 3.5);
sun.position.set(-10, 18, 8);
sun.castShadow = true;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.CylinderGeometry(15, 17, 1.4, 8),
  new THREE.MeshStandardMaterial({ color: 0x73bd4e, roughness: 1 }),
);
ground.position.y = -0.8;
ground.receiveShadow = true;
scene.add(ground);

const player = new THREE.Group();
const bodyMaterial = new THREE.MeshStandardMaterial({
  color: 0x3a78e0,
  roughness: 0.8,
});
const skinMaterial = new THREE.MeshStandardMaterial({
  color: 0xffbe82,
  roughness: 0.9,
});
const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.52, 0.8, 5, 10),
  bodyMaterial,
);
body.position.y = 1;
body.castShadow = true;
const head = new THREE.Mesh(
  new THREE.SphereGeometry(0.45, 16, 10),
  skinMaterial,
);
head.position.y = 2;
head.castShadow = true;
player.add(body, head);
scene.add(player);

interface Tree {
  group: THREE.Group;
  health: number;
}
const trees: Tree[] = [];
const trunkMaterial = new THREE.MeshStandardMaterial({
  color: 0x8a5130,
  roughness: 1,
});
const leafMaterial = new THREE.MeshStandardMaterial({
  color: 0x247842,
  roughness: 0.9,
});

for (let index = 0; index < 28; index += 1) {
  const angle = (index / 28) * Math.PI * 2 + (index % 3) * 0.23;
  const radius = 5.2 + (index % 5) * 1.55;
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.38, 1.8, 7),
    trunkMaterial,
  );
  trunk.position.y = 0.9;
  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(1.25, 2.7, 8),
    leafMaterial,
  );
  leaves.position.y = 2.6;
  trunk.castShadow = leaves.castShadow = true;
  tree.add(trunk, leaves);
  tree.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  tree.rotation.y = angle;
  scene.add(tree);
  trees.push({ group: tree, health: 3 });
}

const keys = new Set<string>();
addEventListener("keydown", (event) => keys.add(event.code));
addEventListener("keyup", (event) => keys.delete(event.code));

let economy = initialEconomy();
let lastHit = 0;
const direction = new THREE.Vector3();
let previousTime = performance.now();

function updatePlayer(delta: number, time: number): void {
  direction.set(0, 0, 0);
  if (keys.has("KeyW") || keys.has("KeyZ") || keys.has("ArrowUp"))
    direction.z -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) direction.z += 1;
  if (keys.has("KeyA") || keys.has("KeyQ") || keys.has("ArrowLeft"))
    direction.x -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) direction.x += 1;
  if (direction.lengthSq() > 0) {
    direction.normalize();
    player.position.addScaledVector(direction, delta * 5);
    player.position.clamp(
      new THREE.Vector3(-12, 0, -12),
      new THREE.Vector3(12, 0, 12),
    );
    player.rotation.y = Math.atan2(direction.x, direction.z);
  }

  if (!keys.has("Space") || time - lastHit < 0.35) return;
  const target = trees.find(
    (tree) =>
      tree.group.visible &&
      tree.group.position.distanceTo(player.position) < 2.2,
  );
  if (!target) return;
  lastHit = time;
  target.health -= 1;
  target.group.scale.setScalar(0.9 + target.health * 0.035);
  if (target.health === 0) {
    target.group.visible = false;
    economy = harvestWood(economy, 3);
    woodLabel.textContent = String(economy.wood);
  }
}

function resize(): void {
  const width = innerWidth;
  const height = innerHeight;
  const view = 9;
  const aspect = width / height;
  camera.left = -view * aspect;
  camera.right = view * aspect;
  camera.top = view;
  camera.bottom = -view;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

addEventListener("resize", resize);
resize();

try {
  await renderer.init();
  void renderer.setAnimationLoop((time) => {
    const delta = Math.min((time - previousTime) / 1000, 0.05);
    previousTime = time;
    updatePlayer(delta, time / 1000);
    camera.position.x = player.position.x + 13;
    camera.position.z = player.position.z + 13;
    camera.lookAt(player.position);
    renderer.render(scene, camera);
  });
} catch (cause) {
  error.hidden = false;
  error.textContent =
    "WebGPU est indisponible. Utilise une version récente de Chrome, Edge ou Firefox.";
  console.error(cause);
}
