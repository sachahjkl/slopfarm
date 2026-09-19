import * as THREE from "three/webgpu";

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

export class Effects {
  readonly #scene: THREE.Scene;
  readonly #particles: Particle[] = [];
  readonly #geometry = new THREE.BoxGeometry(0.13, 0.13, 0.13);
  readonly #materials = new Map<number, THREE.MeshStandardMaterial>();

  constructor(scene: THREE.Scene) {
    this.#scene = scene;
  }

  burst(position: THREE.Vector3, color: number, count = 10): void {
    const material = this.#material(color);
    for (let index = 0; index < count; index += 1) {
      const mesh = new THREE.Mesh(this.#geometry, material);
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
        this.#scene.remove(particle.mesh);
        this.#particles.splice(index, 1);
      }
    }
  }

  #material(color: number): THREE.MeshStandardMaterial {
    const existing = this.#materials.get(color);
    if (existing) return existing;
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    this.#materials.set(color, material);
    return material;
  }
}
