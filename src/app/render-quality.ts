export type RenderQuality = "low" | "high";

const HIGH_QUALITY_PIXEL_RATIO_LIMIT = 2;
const HIGH_QUALITY_PIXEL_BUDGET = 2_000_000;

export function renderPixelRatio(
  quality: RenderQuality,
  deviceRatio: number,
  width: number,
  height: number,
): number {
  if (quality === "low") return 1;
  const safeDeviceRatio = Math.max(1, deviceRatio);
  const cssPixels = Math.max(1, width * height);
  const budgetRatio = Math.sqrt(HIGH_QUALITY_PIXEL_BUDGET / cssPixels);
  return Math.max(
    1,
    Math.min(safeDeviceRatio, HIGH_QUALITY_PIXEL_RATIO_LIMIT, budgetRatio),
  );
}
