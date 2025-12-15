import { FOOTBALL_CONFIG } from "@shared/football-config";

export interface SnapResult {
  position: number;
  snapped: boolean;
  gridPoint?: number;
}

export interface SnapXYResult {
  x: SnapResult;
  y: SnapResult;
}

export function calculateSnap(
  currentPos: number,
  gridPoints: number[],
  threshold: number
): SnapResult {
  for (const point of gridPoints) {
    if (Math.abs(currentPos - point) <= threshold) {
      return { position: point, snapped: true, gridPoint: point };
    }
  }
  return { position: currentPos, snapped: false };
}

export function getSnapGridPoints() {
  const { field } = FOOTBALL_CONFIG;
  
  const xPoints = [
    field.centerX,
    field.leftHashX,
    field.rightHashX,
    field.fieldLeft,
    field.fieldRight,
  ];
  
  const yPoints: number[] = [field.losY];
  
  for (let y = field.fieldTop; y <= field.height; y += field.pixelsPerYard * 5) {
    if (!yPoints.includes(y)) {
      yPoints.push(y);
    }
  }
  
  return { xPoints, yPoints };
}

export const SNAP_THRESHOLD = FOOTBALL_CONFIG.field.pixelsPerYard * 0.5;

export function snapPosition(
  x: number,
  y: number,
  enabled: boolean
): SnapXYResult {
  if (!enabled) {
    return {
      x: { position: x, snapped: false },
      y: { position: y, snapped: false },
    };
  }
  
  const { xPoints, yPoints } = getSnapGridPoints();
  
  return {
    x: calculateSnap(x, xPoints, SNAP_THRESHOLD),
    y: calculateSnap(y, yPoints, SNAP_THRESHOLD),
  };
}
