export const PIXELS_PER_OBJECT = 1200;

export const progressRef: { current: number } = { current: 0 };
const frozenProgressRef: { current: number } = { current: 0 };
const totalUnitsRef: { current: number } = { current: 1 };

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function clampTimelineUnits(units: number): number {
  return Math.max(1e-4, units);
}

export function setTimelineTotalUnits(units: number): void {
  totalUnitsRef.current = clampTimelineUnits(units);
}

export function getTimelineTotalUnits(): number {
  return clampTimelineUnits(totalUnitsRef.current);
}

export function getMaxScrollPx(totalUnits = getTimelineTotalUnits()): number {
  return clampTimelineUnits(totalUnits) * PIXELS_PER_OBJECT;
}

export function computeProgressFromScrollY(
  scrollY: number,
  totalUnits = getTimelineTotalUnits()
): number {
  const maxScroll = getMaxScrollPx(totalUnits);
  return clamp01(maxScroll <= 1e-6 ? 0 : scrollY / maxScroll);
}

export function computeSnappedProgress(progress: number): number {
  return clamp01(progress);
}

export function getEffectiveProgress(lockState: boolean): number {
  const snapped = computeSnappedProgress(progressRef.current);
  if (!lockState) {
    frozenProgressRef.current = snapped;
    return snapped;
  }
  return frozenProgressRef.current;
}
