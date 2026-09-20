import { describe, expect, it } from "vitest";
import { CAMPAIGN_STEPS } from "../game/campaign";
import { FOREST } from "../game/content";
import { GameSimulation } from "../game/simulation";
import { createDebugPreset } from "./debug";

describe("createDebugPreset", () => {
  it("restaure un départ propre sans modifier la sauvegarde source", () => {
    const source = new GameSimulation().createSave();
    source.state.inventory.coins = 42;
    source.state.campaign.marketStock = 90;
    source.state.trees[0]!.health = 0;

    const preset = createDebugPreset(source, "early");

    expect(preset.state.campaign.step).toBe(CAMPAIGN_STEPS.camp);
    expect(preset.state.inventory.coins).toBe(0);
    expect(preset.state.campaign.marketStock).toBe(0);
    expect(preset.state.trees[0]!.health).toBe(FOREST.treeHealth);
    expect(source.state.inventory.coins).toBe(42);
  });

  it("crée une industrie moyenne avec une pile de marché haute", () => {
    const preset = createDebugPreset(new GameSimulation().createSave(), "mid");

    expect(preset.state.campaign.step).toBe(CAMPAIGN_STEPS.convoy);
    expect(preset.state.automationLevel).toBe(2);
    expect(preset.state.workers).toHaveLength(6);
    expect(preset.state.campaign.marketStock).toBe(120);
  });

  it("crée une usine finale complète mais non activée", () => {
    const preset = createDebugPreset(
      new GameSimulation().createSave(),
      "final",
    );

    expect(preset.state.campaign.step).toBe(CAMPAIGN_STEPS.defense);
    expect(preset.state.campaign.completed).toBe(false);
    expect(preset.state.automationLevel).toBe(3);
    expect(preset.state.workers).toHaveLength(FOREST.maxWorkers);
    expect(preset.state.monument.stage).toBe(3);
    expect(preset.state.butcher.rationLevel).toBe(2);
    expect(preset.state.turret.level).toBe(3);
  });
});
