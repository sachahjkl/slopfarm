import type { GameCommand, Vector2 } from "../game/simulation";
import { screenToWorldDirection } from "./camera-layout";

export class KeyboardInput {
  readonly #keys = new Set<string>();
  #pointerId: number | undefined;
  #pointerOrigin = { x: 0, y: 0 };
  #pointer = { x: 0, y: 0 };
  #upgradeRequests = 0;

  constructor(
    surface: HTMLElement,
    target: Window = window,
    allowDebug = false,
  ) {
    target.addEventListener("keydown", (event) => {
      this.#keys.add(event.code);
      if (allowDebug && event.code === "KeyU" && !event.repeat)
        this.#upgradeRequests += 1;
    });
    target.addEventListener("keyup", (event) => this.#keys.delete(event.code));
    target.addEventListener("blur", () => this.#keys.clear());
    surface.addEventListener("pointerdown", (event) => {
      if (this.#pointerId !== undefined) return;
      this.#pointerId = event.pointerId;
      this.#pointerOrigin = { x: event.clientX, y: event.clientY };
      this.#pointer = { ...this.#pointerOrigin };
      surface.setPointerCapture(event.pointerId);
    });
    surface.addEventListener("pointermove", (event) => {
      if (event.pointerId === this.#pointerId) {
        this.#pointer = { x: event.clientX, y: event.clientY };
      }
    });
    const release = (event: PointerEvent): void => {
      if (event.pointerId === this.#pointerId) this.#pointerId = undefined;
    };
    surface.addEventListener("pointerup", release);
    surface.addEventListener("pointercancel", release);
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
    if (this.#pointerId !== undefined) {
      const maximum = 64;
      screen.x += Math.max(
        -1,
        Math.min(1, (this.#pointer.x - this.#pointerOrigin.x) / maximum),
      );
      screen.z += Math.max(
        -1,
        Math.min(1, (this.#pointer.y - this.#pointerOrigin.y) / maximum),
      );
    }
    return screenToWorldDirection(screen);
  }
}
