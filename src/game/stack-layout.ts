export interface StackItemOffset {
  x: number;
  z: number;
  rotation: number;
}

export function stackItemOffset(index: number): StackItemOffset {
  return {
    x: Math.sin(index * 12.9898) * 0.035,
    z: Math.sin(index * 78.233 + 1.7) * 0.035,
    rotation: Math.sin(index * 37.719 + 0.4) * 0.055,
  };
}
