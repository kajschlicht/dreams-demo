export type SceneShellParams = {
  shellFalloff: number;
  fogStrength: number;
  edgeCompression: number;
  depthOpening: number;
  shellOpacity: number;
  openness: number;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function triLerp(value: number, left: number, mid: number, right: number): number {
  const v = clamp01(value);
  if (v <= 0.5) return lerp(left, mid, v * 2);
  return lerp(mid, right, (v - 0.5) * 2);
}

export function resolveSceneShellParams(sceneModeValue: number): SceneShellParams {
  const v = clamp01(sceneModeValue);

  return {
    // Enge: faster falloff, Weite: neutral open, Leichtigkeit: soft/open falloff
    shellFalloff: triLerp(v, 2.15, 1.2, 0.86),
    // Enge is dense, Weite opens, Leichtigkeit remains open and lighter.
    fogStrength: triLerp(v, 0.92, 0.38, 0.23),
    // Enge compresses edges the most, Leichtigkeit the least.
    edgeCompression: triLerp(v, 0.34, 0.11, 0.03),
    // Weite has maximum opening, Leichtigkeit stays open but softer.
    depthOpening: triLerp(v, 0.42, 1, 0.92),
    // Subtle atmospheric shell opacity, stronger in Enge.
    shellOpacity: triLerp(v, 0.34, 0.17, 0.11),
    // Openness drives the feeling of pressure vs. air.
    openness: triLerp(v, 0.32, 1, 1.06),
  };
}

