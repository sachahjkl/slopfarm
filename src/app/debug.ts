import type { GameSimulation } from "../game/simulation";
import type { GameView } from "../presentation/game-view";
import type { SaveStore } from "./save-store";

export interface DebugTools {
  update(delta: number): void;
}

export function createDebugTools(
  game: GameSimulation,
  view: GameView,
  saves: SaveStore,
): DebugTools {
  const panel = document.createElement("details");
  panel.id = "debug-panel";
  panel.innerHTML = `<summary>DEBUG</summary><div class="debug-actions"></div><pre></pre>`;
  const actions = panel.querySelector<HTMLDivElement>(".debug-actions")!;
  const output = panel.querySelector<HTMLPreElement>("pre")!;
  const controls: [string, () => void][] = [
    ["+100 🪙", () => game.enqueue({ type: "debug.grant", coins: 100 })],
    ["+25 🪵", () => game.enqueue({ type: "debug.grant", wood: 25 })],
    ["+25 🪚", () => game.enqueue({ type: "debug.grant", planks: 25 })],
    ["+12 🥩", () => game.enqueue({ type: "debug.grant", meat: 12 })],
    ["+🐻", () => game.enqueue({ type: "debug.spawn-animal" })],
    ["+🪓", () => game.enqueue({ type: "tool.upgrade-requested" })],
    ["+👷", () => game.enqueue({ type: "debug.progress", worker: true })],
    ["+⚙️", () => game.enqueue({ type: "debug.progress", automation: true })],
    ["+🏗️", () => game.enqueue({ type: "debug.progress", monument: true })],
    ["+🛡️", () => game.enqueue({ type: "debug.progress", turret: true })],
    ["Save", () => saves.exportSave(game.createSave())],
    ["Replay", () => saves.exportReplay(game.createReplay())],
  ];
  for (const [label, action] of controls) {
    const button = document.createElement("button");
    button.textContent = label;
    button.addEventListener("click", action);
    actions.append(button);
  }
  document.body.append(panel);
  let elapsed = 0;
  let frames = 0;
  let fps = 0;
  return {
    update(delta) {
      elapsed += delta;
      frames += 1;
      if (elapsed >= 0.5) {
        fps = Math.round(frames / elapsed);
        elapsed = 0;
        frames = 0;
      }
      if (panel.open) {
        const { state } = game;
        output.textContent = JSON.stringify(
          {
            fps,
            render: view.renderInfo,
            elapsed: Math.round(state.elapsed),
            inventory: state.inventory,
            toolLevel: state.tool.level,
            workers: state.workers.length,
            automation: [state.automationLevel, state.automationProgress],
            sawmill: state.sawmill,
            monument: state.monument,
            butcher: state.butcher,
            turret: state.turret,
            animals: state.animals.length,
            pickups: state.pickups.length,
          },
          null,
          2,
        );
      }
    },
  };
}
