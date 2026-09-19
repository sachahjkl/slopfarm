import { describe, expect, it } from "vitest";
import { sawmillAngularSpeed } from "./sawmill-motion";

describe("sawmillAngularSpeed", () => {
  it("garde la lame lisible au niveau maximal", () => {
    expect(sawmillAngularSpeed(3, true)).toBeLessThan(0.65);
  });

  it("accélère légèrement quand la scierie travaille", () => {
    expect(sawmillAngularSpeed(2, true)).toBeGreaterThan(
      sawmillAngularSpeed(2, false),
    );
  });
});
