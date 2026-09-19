export const ANIMAL_HIT_DURATION = 0.34;

export interface AnimalHitPose {
  recoil: number;
  lift: number;
  squash: number;
  stagger: number;
  flash: number;
}

export function animalHitPose(
  remaining: number,
  reducedMotion: boolean,
): AnimalHitPose {
  if (remaining <= 0)
    return { recoil: 0, lift: 0, squash: 0, stagger: 0, flash: 0 };
  const progress = Math.max(
    0,
    Math.min(1, 1 - remaining / ANIMAL_HIT_DURATION),
  );
  const impact = Math.sin(progress * Math.PI);
  if (reducedMotion)
    return {
      recoil: 0,
      lift: 0,
      squash: 0,
      stagger: 0,
      flash: (1 - progress) ** 2,
    };
  return {
    recoil: impact * 0.46,
    lift: impact * 0.16,
    squash: impact * 0.2,
    stagger: Math.sin(progress * Math.PI * 2) * (1 - progress) * 0.2,
    flash: (1 - progress) ** 2,
  };
}
