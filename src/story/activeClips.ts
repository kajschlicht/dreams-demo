import type { ActiveTimelineState, TimelineState } from "./timeline";
import { resolveTimelineState } from "./timeline";

export type ActiveClip = ActiveTimelineState & {
  weight: number;
};

export function clipWeightFromState(state: ActiveTimelineState): number {
  switch (state.phase) {
    case "introCloud":
      return 0;
    case "toObject":
      return Math.min(1, Math.max(0, state.morph));
    case "peak":
      return 1;
    case "toCloud":
      return 1 - Math.min(1, Math.max(0, state.morph));
    default:
      return 0;
  }
}

export function resolveActiveClips(
  timeline: TimelineState,
  position: number,
  visibilityThreshold = 0.001
): ActiveClip[] {
  const state = resolveTimelineState(timeline, position);
  const weight = clipWeightFromState(state);

  if (state.phase === "introCloud" || !state.objectId || weight <= visibilityThreshold) {
    return [];
  }

  return [{ ...state, weight }];
}
