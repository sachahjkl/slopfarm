export function sawmillAngularSpeed(
  automationLevel: number,
  hasQueuedWood: boolean,
): number {
  return 0.28 + automationLevel * 0.07 + (hasQueuedWood ? 0.1 : 0);
}
