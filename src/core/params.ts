export type ParamsVersion = "0.1";

export interface DreamParams {
  version: ParamsVersion;

  // 0..1
  space: number;
  light: number;
  control: number;
  threat: number;
  presence: number;

  repetition: boolean;

  // 0..1
  transformationLevel: number;
}

export const defaultParams: DreamParams = {
  version: "0.1",
  space: 0.5,
  light: 0.6,
  control: 0.5,
  threat: 0.3,
  presence: 1.0,
  repetition: true,
  transformationLevel: 0.0,
};

export function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function normalizeParams(p: DreamParams): DreamParams {
  return {
    ...p,
    space: clamp01(p.space),
    light: clamp01(p.light),
    control: clamp01(p.control),
    threat: clamp01(p.threat),
    presence: clamp01(p.presence),
    transformationLevel: clamp01(p.transformationLevel),
  };
}