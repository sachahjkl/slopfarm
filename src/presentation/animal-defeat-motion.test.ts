import { describe, expect, it } from "vitest";
import {
  ANIMAL_DEFEAT_DURATION,
  animalDefeatPose,
} from "./animal-defeat-motion";

describe("animalDefeatPose", () => {
  it("collapses before fading away", () => {
    const early = animalDefeatPose(ANIMAL_DEFEAT_DURATION * 0.7);
    const late = animalDefeatPose(ANIMAL_DEFEAT_DURATION * 0.15);

    expect(early.collapse).toBeGreaterThan(0);
    expect(early.opacity).toBe(1);
    expect(late.opacity).toBeLessThan(0.5);
    expect(late.sink).toBeGreaterThan(0);
  });

  it("finishes fully transparent", () => {
    expect(animalDefeatPose(0).opacity).toBe(0);
  });
});
