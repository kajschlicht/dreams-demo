import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { syncElementSounds } from "../audio/elementSoundEngine";
import { selectRenderableStoryObjects, useAppStore } from "../core/store";
import type { ElementEffectType, GLBAsset } from "../data/glbLibrary";
import { registryToLibrary } from "../data/elementsRegistry";
import { resolveActiveClips } from "../story/activeClips";
import { buildTimeline } from "../story/timeline";
import { getEffectiveProgress } from "../world/scrollTimeline";
import { DustEffect } from "./effects/DustEffect";
import { RainEffect } from "./effects/RainEffect";
import { SmokeEffect } from "./effects/SmokeEffect";
import { WindEffect } from "./effects/WindEffect";

const MAX_ACTIVE_EFFECTS = 4;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function isEffectAsset(asset: GLBAsset | undefined): asset is GLBAsset & { effectType: ElementEffectType } {
  return Boolean(asset && asset.type === "effect" && asset.effectType);
}

export function ElementRenderer() {
  const lockState = useAppStore((s) => s.lockState);
  const storyObjects = useAppStore(selectRenderableStoryObjects);
  const elementsRegistry = useAppStore((s) => s.elementsRegistry);
  const library = useMemo(() => registryToLibrary(elementsRegistry), [elementsRegistry]);

  const assetsById = useMemo(() => new Map(library.map((asset) => [asset.id, asset])), [library]);

  const enabledStoryObjects = useMemo(
    () => storyObjects.filter((storyObject) => storyObject.enabled),
    [storyObjects]
  );

  const timeline = useMemo(
    () =>
      buildTimeline(
        enabledStoryObjects.map((storyObject) => ({
          id: storyObject.id,
          assetId: storyObject.assetId,
          enabled: true,
          transitionIn: storyObject.transitionIn ?? 0.1,
          stay: storyObject.stay ?? 0.5,
          transitionOut: storyObject.transitionOut ?? 0.1,
        }))
      ),
    [enabledStoryObjects]
  );

  const effectStoryObjects = useMemo(
    () =>
      enabledStoryObjects
        .filter((storyObject) => isEffectAsset(assetsById.get(storyObject.assetId)))
        .slice(0, MAX_ACTIVE_EFFECTS),
    [assetsById, enabledStoryObjects]
  );

  const activeWeightsRef = useRef<Map<string, number>>(new Map());

  useFrame(() => {
    const p = clamp01(getEffectiveProgress(lockState));
    const timelinePosition = p * timeline.totalLength;
    const activeClips = resolveActiveClips(timeline, timelinePosition);
    syncElementSounds(
      activeClips.map((clip) => ({
        objectId: clip.objectId,
        assetId: clip.assetId,
        weight: clip.weight,
      }))
    );

    const nextWeights = new Map<string, number>();
    for (const clip of activeClips) {
      nextWeights.set(clip.objectId, clip.weight);
    }
    activeWeightsRef.current = nextWeights;
  });

  const getWeight = (objectId: string): number => activeWeightsRef.current.get(objectId) ?? 0;

  if (effectStoryObjects.length === 0) {
    return null;
  }

  return (
    <group>
      {effectStoryObjects.map((storyObject) => {
        const asset = assetsById.get(storyObject.assetId);
        if (!isEffectAsset(asset)) return null;

        const size = Math.max(0.1, storyObject.param1 ?? 1);
        const offsetX = storyObject.param2 ?? 0;
        const orientationXDeg = storyObject.orientationX ?? 0;
        const orientationYDeg = storyObject.orientationY ?? 0;
        const orientationZDeg = storyObject.orientationZ ?? 0;
        const mode = clamp01(storyObject.param3 ?? 0);

        switch (asset.effectType) {
          case "smoke":
            return (
              <SmokeEffect
                key={storyObject.id}
                objectId={storyObject.id}
                getWeight={getWeight}
                size={size}
                offsetX={offsetX}
                orientationXDeg={orientationXDeg}
                orientationYDeg={orientationYDeg}
                orientationZDeg={orientationZDeg}
                mode={mode}
              />
            );
          case "dust":
            return (
              <DustEffect
                key={storyObject.id}
                objectId={storyObject.id}
                getWeight={getWeight}
                size={size}
                offsetX={offsetX}
                orientationXDeg={orientationXDeg}
                orientationYDeg={orientationYDeg}
                orientationZDeg={orientationZDeg}
                mode={mode}
              />
            );
          case "rain":
            return (
              <RainEffect
                key={storyObject.id}
                objectId={storyObject.id}
                getWeight={getWeight}
                size={size}
                offsetX={offsetX}
                orientationXDeg={orientationXDeg}
                orientationYDeg={orientationYDeg}
                orientationZDeg={orientationZDeg}
                mode={mode}
              />
            );
          case "wind":
            return (
              <WindEffect
                key={storyObject.id}
                objectId={storyObject.id}
                getWeight={getWeight}
                size={size}
                offsetX={offsetX}
                orientationXDeg={orientationXDeg}
                orientationYDeg={orientationYDeg}
                orientationZDeg={orientationZDeg}
                mode={mode}
              />
            );
          default:
            return null;
        }
      })}
    </group>
  );
}
