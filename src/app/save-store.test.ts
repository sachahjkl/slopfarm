import { describe, expect, it } from "vitest";
import { GameSimulation } from "../game/simulation";
import { isSaveData } from "./save-store";

describe("isSaveData", () => {
  it("accepte une sauvegarde complète", () => {
    expect(isSaveData(new GameSimulation(12).createSave())).toBe(true);
  });

  it("accepte une ressource en route vers le marché", () => {
    const save = new GameSimulation(12).createSave();
    save.state.conveyorItems = [
      {
        id: 1,
        kind: "wood",
        from: { x: 6.5, z: 7 },
        to: { x: -8.1, z: 2.5 },
        progress: 0.5,
        destination: "market",
      },
    ];

    expect(isSaveData(save)).toBe(true);
  });

  it("refuse un état incomplet", () => {
    expect(isSaveData({ seed: 12, randomState: 12, state: {} })).toBe(false);
  });

  it("refuse chaque sous-état requis manquant", () => {
    for (const key of [
      "tool",
      "campaign",
      "sawmill",
      "monument",
      "customers",
      "workers",
      "pickups",
      "conveyorItems",
      "animals",
      "wildlife",
      "butcher",
      "turret",
    ]) {
      const save = new GameSimulation(12).createSave();
      Reflect.deleteProperty(
        save.state as unknown as Record<string, unknown>,
        key,
      );
      expect(isSaveData(save), key).toBe(false);
    }
  });

  it("refuse les niveaux et ressources hors limites", () => {
    const invalidSaves = [
      () => {
        const save = new GameSimulation(12).createSave();
        save.state.tool.level = 7;
        return save;
      },
      () => {
        const save = new GameSimulation(12).createSave();
        save.state.automationLevel = -1;
        return save;
      },
      () => {
        const save = new GameSimulation(12).createSave();
        save.state.butcher.level = 4;
        return save;
      },
      () => {
        const save = new GameSimulation(12).createSave();
        save.state.butcher.rationLevel = 3;
        return save;
      },
      () => {
        const save = new GameSimulation(12).createSave();
        save.state.turret.level = -1;
        return save;
      },
      () => {
        const save = new GameSimulation(12).createSave();
        save.state.inventory.meat = -1;
        return save;
      },
    ];
    for (const invalidSave of invalidSaves)
      expect(isSaveData(invalidSave())).toBe(false);
  });
});
