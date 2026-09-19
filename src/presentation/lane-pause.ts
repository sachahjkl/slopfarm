import type { AnimalState } from "../game/model";

export function pausedProductionRoutes(
  animals: readonly Pick<AnimalState, "phase" | "route">[],
): readonly [boolean, boolean, boolean] {
  const paused: [boolean, boolean, boolean] = [false, false, false];
  for (const animal of animals)
    if (animal.phase === "attacking" && animal.route >= 0 && animal.route < 3)
      paused[animal.route] = true;
  return paused;
}
