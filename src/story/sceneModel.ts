export type SceneVersion = "0.1";

export type SceneAnchor =
  | "path"
  | "door"
  | "window"
  | "light"
  | "open"
  | "none";

export interface SceneModel {
  version: SceneVersion;

  // Core emotion parameters (0..1)
  space: number;
  light: number;
  control: number;
  threat: number;
  presence: number;

  // Derived world decisions
  horizon: number; // 0..1, visibility of distance
  fog: number; // 0..1, volumetric density
  contrast: number; // 0..1
  anchor: SceneAnchor;

  // Rehearsal
  transformationLevel: number; // 0..1

  // Seed so the same params generate a stable world
  seed: number;
}

export function makeDefaultScene(seed = 1): SceneModel {
  return {
    version: "0.1",

    space: 0.6,
    light: 0.6,
    control: 0.7,
    threat: 0.2,
    presence: 0.2,

    horizon: 0.7,
    fog: 0.3,
    contrast: 0.3,
    anchor: "path",

    transformationLevel: 0.0,
    seed,
  };
}