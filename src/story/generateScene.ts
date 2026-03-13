import type { DreamParams } from "../core/params";
import type { SceneModel } from "./sceneModel";
import { makeDefaultScene } from "./sceneModel";

function clamp01(v: number) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function generateSceneFromParams(
  params: DreamParams,
  seed = 1
): SceneModel {
  const s = makeDefaultScene(seed);

  // Copy core params
  s.space = clamp01(params.space);
  s.light = clamp01(params.light);
  s.control = clamp01(params.control);
  s.threat = clamp01(params.threat);
  s.presence = clamp01(params.presence);
  s.transformationLevel = clamp01(params.transformationLevel);

  // Derived world decisions
  // horizon: more space + more light + more control
  s.horizon = clamp01(0.15 + 0.55 * s.space + 0.2 * s.light + 0.1 * s.control);

  // fog: more threat + less control, but eased by light and transformation
  s.fog = clamp01(
    0.15 +
      0.65 * s.threat +
      0.25 * (1 - s.control) -
      0.25 * s.light -
      0.35 * s.transformationLevel
  );

  // contrast: threat increases contrast, light reduces, transformation reduces
  s.contrast = clamp01(
    0.1 + 0.7 * s.threat - 0.35 * s.light - 0.25 * s.transformationLevel
  );

  // anchor: simple decision for a navigational focus
  if (s.transformationLevel > 0.6) s.anchor = "open";
  else if (s.threat > 0.6) s.anchor = "door";
  else if (s.light > 0.7) s.anchor = "window";
  else s.anchor = "path";

  s.seed = seed;

  return s;
}