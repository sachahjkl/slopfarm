import * as THREE from "three/webgpu";
import type { PickupKind } from "../game/model";
import { createToonMaterial } from "./forest-assets";

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

interface Pulse {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  life: number;
  duration: number;
  radius: number;
}

interface Transfer {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshToonMaterial>;
  from: THREE.Vector3;
  to: THREE.Vector3;
  life: number;
  duration: number;
}

export class Effects {
  readonly #scene: THREE.Scene;
  readonly #particles: Particle[] = [];
  readonly #pulses: Pulse[] = [];
  readonly #transfers: Transfer[] = [];
  readonly #geometry = new THREE.BoxGeometry(0.13, 0.13, 0.13);
  readonly #materials = new Map<number, THREE.MeshToonMaterial>();
  readonly #pool: THREE.Mesh[] = [];
  readonly #reducedMotion: () => boolean;
  readonly #maximum = 240;

  constructor(scene: THREE.Scene, reducedMotion: () => boolean = () => false) {
    this.#scene = scene;
    this.#reducedMotion = reducedMotion;
  }

  burst(position: THREE.Vector3, color: number, count = 10): void {
    const material = this.#material(color);
    const requested = this.#reducedMotion() ? Math.ceil(count * 0.3) : count;
    const available = Math.max(0, this.#maximum - this.#particles.length);
    for (let index = 0; index < Math.min(requested, available); index += 1) {
      const mesh = this.#pool.pop() ?? new THREE.Mesh(this.#geometry, material);
      mesh.material = material;
      mesh.visible = true;
      mesh.position.copy(position);
      mesh.scale.setScalar(0.5 + Math.random());
      this.#scene.add(mesh);
      this.#particles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          2 + Math.random() * 3,
          (Math.random() - 0.5) * 4,
        ),
        life: 0.45 + Math.random() * 0.35,
      });
    }
  }

  pulse(position: THREE.Vector3, color: number, radius = 0.8): void {
    if (this.#pulses.length >= 24) return;
    const duration = this.#reducedMotion() ? 0.18 : 0.32;
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.72, 1, 24), material);
    mesh.position.copy(position);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.setScalar(0.12);
    this.#scene.add(mesh);
    this.#pulses.push({ mesh, life: duration, duration, radius });
  }

  transfer(kind: PickupKind, from: THREE.Vector3, to: THREE.Vector3): void {
    if (this.#transfers.length >= 80) return;
    const color =
      kind === "coin"
        ? 0xffd447
        : kind === "plank"
          ? 0xe3ad69
          : kind === "meat"
            ? 0xc6534f
            : 0x9f5e35;
    const geometry =
      kind === "coin"
        ? new THREE.CylinderGeometry(0.28, 0.28, 0.1, 10)
        : kind === "plank"
          ? new THREE.BoxGeometry(0.55, 0.18, 0.32)
          : kind === "meat"
            ? new THREE.CapsuleGeometry(0.18, 0.35, 4, 8)
            : new THREE.BoxGeometry(0.42, 0.42, 0.42);
    const mesh = new THREE.Mesh(geometry, createToonMaterial({ color }));
    mesh.position.copy(from);
    mesh.renderOrder = 21;
    this.#scene.add(mesh);
    this.#transfers.push({
      mesh,
      from: from.clone(),
      to: to.clone(),
      life: 0.58,
      duration: 0.58,
    });
  }

  update(delta: number): void {
    for (let index = this.#particles.length - 1; index >= 0; index -= 1) {
      const particle = this.#particles[index]!;
      particle.life -= delta;
      particle.velocity.y -= 9 * delta;
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.mesh.rotation.x += delta * 8;
      particle.mesh.rotation.z += delta * 6;
      particle.mesh.scale.setScalar(Math.max(0, particle.life * 1.5));
      if (particle.life <= 0) {
        particle.mesh.visible = false;
        this.#particles.splice(index, 1);
        this.#pool.push(particle.mesh);
      }
    }
    for (let index = this.#pulses.length - 1; index >= 0; index -= 1) {
      const pulse = this.#pulses[index]!;
      pulse.life -= delta;
      const progress = 1 - Math.max(0, pulse.life) / pulse.duration;
      pulse.mesh.scale.setScalar(
        THREE.MathUtils.lerp(0.12, pulse.radius, 1 - (1 - progress) ** 3),
      );
      pulse.mesh.material.opacity = (1 - progress) * 0.8;
      if (pulse.life <= 0) {
        this.#scene.remove(pulse.mesh);
        pulse.mesh.geometry.dispose();
        pulse.mesh.material.dispose();
        this.#pulses.splice(index, 1);
      }
    }
    for (let index = this.#transfers.length - 1; index >= 0; index -= 1) {
      const transfer = this.#transfers[index]!;
      transfer.life -= delta;
      const progress = 1 - Math.max(0, transfer.life) / transfer.duration;
      const eased = 1 - (1 - progress) ** 3;
      transfer.mesh.position.lerpVectors(transfer.from, transfer.to, eased);
      transfer.mesh.position.y += Math.sin(progress * Math.PI) * 1.15;
      transfer.mesh.rotation.x += delta * 11;
      transfer.mesh.rotation.y += delta * 8;
      transfer.mesh.scale.setScalar(Math.sin(progress * Math.PI) * 0.35 + 0.9);
      if (transfer.life <= 0) {
        this.#scene.remove(transfer.mesh);
        transfer.mesh.geometry.dispose();
        transfer.mesh.material.dispose();
        this.#transfers.splice(index, 1);
      }
    }
  }

  #material(color: number): THREE.MeshToonMaterial {
    const existing = this.#materials.get(color);
    if (existing) return existing;
    const material = createToonMaterial({ color, roughness: 0.8 });
    this.#materials.set(color, material);
    return material;
  }
}
