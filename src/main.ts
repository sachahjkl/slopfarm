import { KeyboardInput } from "./app/input";
import { SaveStore } from "./app/save-store";
import { SettingsPanel } from "./app/settings";
import { SoundFeedback } from "./app/sound";
import { GameSimulation } from "./game/simulation";
import { GameView } from "./presentation/game-view";
import { registerSW } from "virtual:pwa-register";
import "./style.css";
import "./panel-theme.css";

registerSW({ immediate: true });

type ElementConstructor<T extends Element> = new (...args: never[]) => T;

function requireElement<T extends Element>(
  selector: string,
  constructor: ElementConstructor<T>,
): T {
  const element = document.querySelector(selector);
  if (!(element instanceof constructor))
    throw new Error(`Élément d’interface absent : ${selector}`);
  return element;
}

const canvas = requireElement("#game", HTMLCanvasElement);
const loadingScreen = requireElement("#loading-screen", HTMLElement);
const error = requireElement("#error", HTMLParagraphElement);
const woodLabel = requireElement("#wood", HTMLElement);
const planksLabel = requireElement("#planks", HTMLElement);
const coinsLabel = requireElement("#coins", HTMLElement);
const meatLabel = requireElement("#meat", HTMLElement);
const toolLabel = requireElement("#tool-level", HTMLElement);
const workersLabel = requireElement("#workers", HTMLElement);
const automationLabel = requireElement("#automation", HTMLElement);
const monumentLabel = requireElement("#monument", HTMLElement);
const toolCostLabel = requireElement("#tool-cost", HTMLElement);
const workerCostLabel = requireElement("#worker-cost", HTMLElement);
const automationCostLabel = requireElement("#automation-cost", HTMLElement);
const monumentCostLabel = requireElement("#monument-cost", HTMLElement);
const hud = requireElement("#hud", HTMLElement);
const brandToggle = requireElement("#brand-toggle", HTMLButtonElement);
const objectiveLabel = requireElement("#objective", HTMLElement);
const objectiveDetailLabel = requireElement("#objective-detail", HTMLElement);
const objectiveHistory = requireElement("#objective-history", HTMLOListElement);
const objectivePanel = requireElement("#instructions", HTMLElement);
const objectiveJournalToggle = requireElement(
  "#objective-journal-toggle",
  HTMLButtonElement,
);
brandToggle.addEventListener("click", () => {
  const retracted = hud.classList.toggle("is-brand-retracted");
  brandToggle.setAttribute("aria-expanded", String(!retracted));
  brandToggle.setAttribute(
    "aria-label",
    retracted
      ? "Déployer le panneau Slopfarm"
      : "Rétracter le panneau Slopfarm",
  );
});
objectiveJournalToggle.addEventListener("click", () => {
  const open = objectivePanel.classList.toggle("journal-open");
  objectiveJournalToggle.setAttribute("aria-expanded", String(open));
});
const saves = new SaveStore();
const saved = saves.load();
const game = new GameSimulation(saved?.seed);
if (saved) {
  game.restore(saved);
}
const settings = new SettingsPanel(
  requireElement("#settings-dialog", HTMLDialogElement),
  game,
  saves,
);
const view = new GameView(
  canvas,
  {
    coins: coinsLabel,
    wood: woodLabel,
    planks: planksLabel,
    meat: meatLabel,
    tool: toolLabel,
    workers: workersLabel,
    automation: automationLabel,
    monument: monumentLabel,
    toolCost: toolCostLabel,
    workerCost: workerCostLabel,
    automationCost: automationCostLabel,
    monumentCost: monumentCostLabel,
    objective: objectiveLabel,
    objectiveDetail: objectiveDetailLabel,
    objectiveHistory,
  },
  settings.feedback,
);
const sound = new SoundFeedback(settings.feedback);
let debugTools: { update(delta: number): void } | undefined;
if (import.meta.env.DEV) {
  void import("./app/debug").then(({ createDebugTools }) => {
    debugTools = createDebugTools(game, view, saves);
  });
}
let previousTime = performance.now();
let saveRemaining = 5;

addEventListener("resize", () => view.resize());

try {
  await view.initialize();
  const input = new KeyboardInput(view.canvas, window, import.meta.env.DEV);
  view.render(game.state, [], 0);
  loadingScreen.classList.add("is-hidden");
  function frame(time: number): void {
    const delta = Math.min((time - previousTime) / 1000, 0.1);
    previousTime = time;
    for (const command of input.readCommands()) game.enqueue(command);
    game.advance(delta);
    const events = game.drainEvents();
    sound.consume(events);
    sound.update(game.state, delta);
    view.render(game.state, events, delta);
    debugTools?.update(delta);
    saveRemaining -= delta;
    if (saveRemaining <= 0) {
      saves.save(game.createSave());
      saveRemaining = 5;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
} catch (cause) {
  loadingScreen.classList.add("is-hidden");
  error.hidden = false;
  error.textContent =
    "Le jeu n’a pas pu charger ses modèles ou son moteur graphique.";
  console.error(cause);
}
