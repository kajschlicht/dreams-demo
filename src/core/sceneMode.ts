export type SceneModeVisualSettings = {
  depth: number;
  tunnelAmount: number;
  subtleAmount: number;
  motionAmount: number;
  cloudOpacity: number;
  softness: number;
  cloudSize: number;
  motionX: number;
  motionY: number;
  motionMultiplier: number;
};

export type SceneModeAudioSettings = {
  volumeMultiplier: number;
  lowpassFrequency: number;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function triLerp(value: number, left: number, mid: number, right: number): number {
  const v = clamp01(value);
  if (v <= 0.5) {
    return lerp(left, mid, v * 2);
  }
  return lerp(mid, right, (v - 0.5) * 2);
}

export function resolveSceneModeVisualSettings(sceneModeValue: number): SceneModeVisualSettings {
  const v = clamp01(sceneModeValue);
  const depth = v <= 0.5 ? lerp(1, 2.8, v * 2) : 2.8;

  return {
    depth,
    // Slightly stronger than before to separate Enge/Weite more clearly.
    tunnelAmount: triLerp(v, 0.45, 0, -0.11),
    subtleAmount: triLerp(v, 0.15, 0.2, 0.55),
    motionAmount: triLerp(v, 0.15, 0.4, 0.65),
    cloudOpacity: triLerp(v, 0.8, 0.45, 0.35),
    softness: triLerp(v, 0.45, 0.68, 0.82),
    cloudSize: triLerp(v, 1.6, 3, 2),
    motionX: triLerp(v, 1.05, 0.12, 0.2),
    motionY: triLerp(v, 0, 0.02, 1.12),
    motionMultiplier: triLerp(v, 0.72, 0.2, 0.52),
  };
}

export function resolveSceneModeAudioSettings(sceneModeValue: number): SceneModeAudioSettings {
  const v = clamp01(sceneModeValue);
  return {
    volumeMultiplier: triLerp(v, 1.1, 1, 0.9),
    lowpassFrequency: triLerp(v, 1800, 12000, 10000),
  };
}
