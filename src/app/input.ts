import type { GameCommand, Vector2 } from "../game/simulation";

export class KeyboardInput {
  readonly #keys = new Set<string>();
  #upgradeRequests = 0;

  constructor(target: Window = window) {
    target.addEventListener("keydown", (event) => {
      this.#keys.add(event.code);
      if (event.code === "KeyU" && !event.repeat) this.#upgradeRequests += 1;
    });
    target.addEventListener("keyup", (event) => this.#keys.delete(event.code));
    target.addEventListener("blur", () => this.#keys.clear());
  }

  readCommands(): GameCommand[] {
    const commands: GameCommand[] = [
      { type: "movement.changed", direction: this.#direction() },
    ];
    while (this.#upgradeRequests > 0) {
      commands.push({ type: "tool.upgrade-requested" });
      this.#upgradeRequests -= 1;
    }
    return commands;
  }

  #direction(): Vector2 {
    const screen = { x: 0, z: 0 };
    if (
      this.#keys.has("KeyW") ||
      this.#keys.has("KeyZ") ||
      this.#keys.has("ArrowUp")
    )
      screen.z -= 1;
    if (this.#keys.has("KeyS") || this.#keys.has("ArrowDown")) screen.z += 1;
    if (
      this.#keys.has("KeyA") ||
      this.#keys.has("KeyQ") ||
      this.#keys.has("ArrowLeft")
    )
      screen.x -= 1;
    if (this.#keys.has("KeyD") || this.#keys.has("ArrowRight")) screen.x += 1;
    return {
      x: (screen.x + screen.z) * Math.SQRT1_2,
      z: (screen.z - screen.x) * Math.SQRT1_2,
    };
  }
}
