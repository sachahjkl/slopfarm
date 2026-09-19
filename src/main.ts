import { KeyboardInput } from "./app/input";
import { GameSimulation } from "./game/simulation";
import { GameView } from "./presentation/game-view";
import "./style.css";

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
const error = requireElement("#error", HTMLParagraphElement);
const woodLabel = requireElement("#wood", HTMLElement);
const game = new GameSimulation();
const input = new KeyboardInput();
const view = new GameView(canvas, woodLabel);
let previousTime = performance.now();

addEventListener("resize", () => view.resize());

try {
  await view.initialize();
  function frame(time: number): void {
    const delta = Math.min((time - previousTime) / 1000, 0.1);
    previousTime = time;
    for (const command of input.readCommands()) game.enqueue(command);
    game.advance(delta);
    view.render(game.state, game.drainEvents(), delta);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
} catch (cause) {
  error.hidden = false;
  error.textContent =
    "WebGPU est indisponible. Utilise une version récente de Chrome, Edge ou Firefox.";
  console.error(cause);
}
