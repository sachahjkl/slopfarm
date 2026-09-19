import { describe, expect, it } from "vitest";
import { ANIMAL_HIT_DURATION, animalHitPose } from "./animal-hit-motion";

describe("animalHitPose", () => {
  it("creates a readable recoil and squash during an impact", () => {
    const pose = animalHitPose(ANIMAL_HIT_DURATION / 2, false);

    expect(pose.recoil).toBeGreaterThan(0.4);
    expect(pose.lift).toBeGreaterThan(0.1);
    expect(pose.squash).toBeGreaterThan(0.15);
  });

  it("keeps the flash but removes movement with reduced motion", () => {
    const pose = animalHitPose(ANIMAL_HIT_DURATION * 0.8, true);

    expect(pose.flash).toBeGreaterThan(0);
    expect(pose.recoil).toBe(0);
    expect(pose.squash).toBe(0);
  });

  it("returns to the neutral pose after the impact", () => {
    expect(animalHitPose(0, false)).toEqual({
      recoil: 0,
      lift: 0,
      squash: 0,
      stagger: 0,
      flash: 0,
    });
  });
});
