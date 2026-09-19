export const ANIMAL_DEFEAT_DURATION = 0.72;

export interface AnimalDefeatPose {
  recoil: number;
  collapse: number;
  sink: number;
  opacity: number;
}

export function animalDefeatPose(remaining: number): AnimalDefeatPose {
  if (remaining <= 0)
    return { recoil: 0.42, collapse: 1, sink: 0.24, opacity: 0 };
  const progress = Math.max(
    0,
    Math.min(1, 1 - remaining / ANIMAL_DEFEAT_DURATION),
  );
  const fade = Math.max(0, Math.min(1, (progress - 0.42) / 0.58));
  return {
    recoil: Math.sin(progress * Math.PI * 0.72) * 0.42,
    collapse: smoothstep(progress),
    sink: Math.max(0, progress - 0.35) * 0.37,
    opacity: 1 - fade,
  };
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}
