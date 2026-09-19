import type { ReplayData } from "./model";
import { GameSimulation } from "./simulation";

export function runReplay(replay: ReplayData, steps?: number): GameSimulation {
  const game = new GameSimulation(replay.seed);
  game.restore(replay.initial);
  const lastCommandStep = replay.commands.at(-1)?.step ?? 0;
  const totalSteps = steps ?? lastCommandStep + 1;
  let commandIndex = 0;
  for (let step = 0; step < totalSteps; step += 1) {
    while (replay.commands[commandIndex]?.step === step) {
      game.enqueue(replay.commands[commandIndex]!.command);
      commandIndex += 1;
    }
    game.advance(1 / 60);
  }
  return game;
}
