export interface ScreenPoint {
  x: number;
  y: number;
}

export function clampOverlayPosition(
  point: ScreenPoint,
  overlay: { width: number; height: number },
  viewport: { width: number; height: number },
  padding = 12,
): ScreenPoint {
  const halfWidth = overlay.width / 2;
  return {
    x: Math.max(
      padding + halfWidth,
      Math.min(viewport.width - padding - halfWidth, point.x),
    ),
    y: Math.max(
      padding + overlay.height,
      Math.min(viewport.height - padding, point.y),
    ),
  };
}
