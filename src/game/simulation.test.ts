import { describe, expect, it } from "vitest";
import { GameSimulation } from "./simulation";

describe("GameSimulation", () => {
  it("normalise les commandes de déplacement", () => {
    const game = new GameSimulation();
    game.enqueue({ type: "movement.changed", direction: { x: 10, z: 0 } });
    game.advance(1 / 60);
    expect(game.state.player.position.x).toBeCloseTo(5 / 60);
  });

  it("applique les améliorations dans l’ordre de la file", () => {
    const game = new GameSimulation();
    game.enqueue({ type: "tool.upgrade-requested" });
    game.enqueue({ type: "tool.upgrade-requested" });
    game.advance(1 / 60);
    expect(game.state.tool.level).toBe(3);
    expect(game.state.tool.positions).toHaveLength(4);
    expect(game.drainEvents()).toEqual([
      { type: "tool.upgraded", level: 2 },
      { type: "tool.upgraded", level: 3 },
    ]);
  });

  it("vide la file d’événements après lecture", () => {
    const game = new GameSimulation();
    game.enqueue({ type: "tool.upgrade-requested" });
    game.advance(1 / 60);
    expect(game.drainEvents()).toHaveLength(1);
    expect(game.drainEvents()).toEqual([]);
  });

  it("reproduit une simulation avec la même graine", () => {
    const first = new GameSimulation(42);
    const second = new GameSimulation(42);
    const command = {
      type: "movement.changed" as const,
      direction: { x: -1, z: -1 },
    };
    first.enqueue(command);
    second.enqueue(command);
    for (let index = 0; index < 600; index += 1) {
      first.advance(1 / 60);
      second.advance(1 / 60);
    }
    expect(second.state).toEqual(first.state);
    expect(second.drainEvents()).toEqual(first.drainEvents());
  });
});
