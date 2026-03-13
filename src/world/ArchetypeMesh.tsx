import { useEffect, useMemo } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import type { GLTF } from "three-stdlib";
import { GLTFLoader } from "three-stdlib";
import { selectRenderableStoryObjects, useAppStore } from "../core/store";
import { registryToLibrary } from "../data/elementsRegistry";
import { resolveObjectTransform } from "../story/applyObjectTransform";
import { resolveActiveClips } from "../story/activeClips";
import { buildTimeline } from "../story/timeline";
import { resolveSceneModeVisualSettings } from "../core/sceneMode";
import {
  ARCHETYPES,
  ARCHETYPE_URLS,
  clamp01,
  smoothstep,
  subtleDepthOffset,
  type ArchetypeId,
} from "./morphTimeline";
import { debugControls } from "./debugControls";
import { getEffectiveProgress } from "./scrollTimeline";

const STAGE_WIDTH = 14;
const STAGE_HEIGHT = 8;
const STAGE_CENTER_X = 0;
const STAGE_CENTER_Y = 0.8;
const STAGE_CENTER_Z = 0;

type PreparedScene = {
  root: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  baseX: number;
  baseY: number;
  baseZ: number;
  baseRotationX: number;
  baseRotationY: number;
  baseRotationZ: number;
  baseScale: number;
  mixer: THREE.AnimationMixer | null;
};

type StoryGLBBinding = {
  archetypeId: ArchetypeId;
  scale: number;
  offsetX: number;
  orientationXDeg: number;
  orientationYDeg: number;
  orientationZDeg: number;
};

function pickDefaultAnimation(animations: THREE.AnimationClip[]): THREE.AnimationClip | null {
  if (animations.length === 0) return null;
  const preferredIdle = animations.find((clip) => /^idle(?:[_\s-]?\d+)?$/i.test(clip.name));
  if (preferredIdle) return preferredIdle;

  const locomotion = animations.find((clip) => /walk|run|gallop|cycle|loop/i.test(clip.name));
  if (locomotion) return locomotion;

  const genericIdle = animations.find(
    (clip) => /idle/i.test(clip.name) && !/hit|react|death|attack|jump|fall/i.test(clip.name)
  );
  if (genericIdle) return genericIdle;

  return animations[0];
}

function prepareScene(source: THREE.Object3D, animations: THREE.AnimationClip[]): PreparedScene {
  const root = source.clone(true) as THREE.Group;
  const materials: THREE.MeshStandardMaterial[] = [];

  const bbox = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  bbox.getCenter(center);
  bbox.getSize(size);

  const scale = Math.min(STAGE_WIDTH / Math.max(size.x, 1e-5), STAGE_HEIGHT / Math.max(size.y, 1e-5));
  root.scale.setScalar(scale);
  root.position.set(
    STAGE_CENTER_X - center.x * scale,
    STAGE_CENTER_Y - center.y * scale,
    STAGE_CENTER_Z - center.z * scale
  );

  root.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const material = new THREE.MeshStandardMaterial({
      color: "#111111",
      roughness: 0.8,
      metalness: 0,
      transparent: true,
      opacity: 0,
    });
    mesh.material = material;
    materials.push(material);
  });

  let mixer: THREE.AnimationMixer | null = null;
  const defaultClip = pickDefaultAnimation(animations);
  if (defaultClip) {
    mixer = new THREE.AnimationMixer(root);
    const action = mixer.clipAction(defaultClip);
    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.enabled = true;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1);
    action.play();
  }

  return {
    root,
    materials,
    baseX: root.position.x,
    baseY: root.position.y,
    baseZ: root.position.z,
    baseRotationX: root.rotation.x,
    baseRotationY: root.rotation.y,
    baseRotationZ: root.rotation.z,
    baseScale: scale,
    mixer,
  };
}

function normalizedArchetypeKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function archetypeIdFromAssetFile(file: string): string {
  const fileName = file.split("/").pop() ?? file;
  return fileName.replace(/\.glb$/i, "");
}

export function ArchetypeMesh() {
  const lockState = useAppStore((s) => s.lockState);
  const storyObjects = useAppStore(selectRenderableStoryObjects);
  const sceneModeValue = useAppStore((s) => s.sceneModeValue);
  const elementsRegistry = useAppStore((s) => s.elementsRegistry);
  const gltfs = useLoader(GLTFLoader, [...ARCHETYPE_URLS]) as GLTF[];
  const library = useMemo(() => registryToLibrary(elementsRegistry), [elementsRegistry]);

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

  const storyGLBBindings = useMemo(() => {
    const assetsById = new Map(library.map((asset) => [asset.id, asset]));
    const archetypeIdByKey = new Map(
      ARCHETYPES.map((archetype) => [normalizedArchetypeKey(archetype.id), archetype.id])
    );

    const byStoryObjectId = new Map<string, StoryGLBBinding>();

    for (const storyObject of enabledStoryObjects) {
      const asset = assetsById.get(storyObject.assetId);
      if (!asset || asset.type === "effect" || !asset.file) continue;
      const archetypeKey = normalizedArchetypeKey(archetypeIdFromAssetFile(asset.file));
      const archetypeId = archetypeIdByKey.get(archetypeKey);
      if (!archetypeId) continue;

      const transform = resolveObjectTransform({
        size: storyObject.param1,
        offsetX: storyObject.param2,
        orientationX: storyObject.orientationX,
        orientationY: storyObject.orientationY,
        orientationZ: storyObject.orientationZ,
        mode: storyObject.param3,
      });

      byStoryObjectId.set(storyObject.id, {
        archetypeId,
        scale: transform.size,
        offsetX: transform.offsetX,
        orientationXDeg: transform.orientationDegX,
        orientationYDeg: transform.orientationDegY,
        orientationZDeg: transform.orientationDegZ,
      });
    }

    return byStoryObjectId;
  }, [enabledStoryObjects, library]);

  const preparedById = useMemo(() => {
    const byId = {} as Record<ArchetypeId, PreparedScene>;
    ARCHETYPES.forEach((archetype, index) => {
      byId[archetype.id] = prepareScene(gltfs[index].scene, gltfs[index].animations);
    });
    return byId;
  }, [gltfs]);

  useEffect(
    () => () => {
      for (const scene of Object.values(preparedById)) {
        for (const material of scene.materials) {
          material.dispose();
        }
        scene.mixer?.stopAllAction();
        scene.mixer?.uncacheRoot(scene.root);
      }
    },
    [preparedById]
  );

  useFrame((_, delta) => {
    const p = clamp01(getEffectiveProgress(lockState));
    const opacityScale = Math.min(1, Math.max(0, debugControls.meshOpacity));
    const sceneModeVisual = resolveSceneModeVisualSettings(sceneModeValue);

    const timelinePosition = p * timeline.totalLength;
    const activeClips = resolveActiveClips(timeline, timelinePosition);
    const activeClip = activeClips[0];

    const activeBinding = activeClip ? storyGLBBindings.get(activeClip.objectId) : null;

    const activeSegment = activeClip ? timeline.segments[activeClip.segmentIndex] : null;
    const localT = activeSegment
      ? clamp01(
          (timelinePosition - activeSegment.start) / Math.max(activeSegment.end - activeSegment.start, 1e-4)
        )
      : 0;

    const transitionEase = smoothstep(0, 1, activeClip?.morph ?? 0);
    const weightedClip = activeClip
      ? activeClip.phase === "toObject"
        ? transitionEase
        : activeClip.phase === "toCloud"
          ? 1 - transitionEase
          : 1
      : 0;

    const wTarget = weightedClip * debugControls.peakStrength;
    const depthZ =
      subtleDepthOffset(localT) * sceneModeVisual.depth;
    const tunnelScaleX = 1 - sceneModeVisual.tunnelAmount * 0.12;
    const tunnelScaleY = 1 - sceneModeVisual.tunnelAmount * 0.06;

    for (const archetype of ARCHETYPES) {
      const scene = preparedById[archetype.id];
      const isActive = Boolean(activeBinding && archetype.id === activeBinding.archetypeId);
      const scale = isActive ? activeBinding?.scale ?? 1 : 1;
      const offsetX = isActive ? activeBinding?.offsetX ?? 0 : 0;
      const orientationXRad = THREE.MathUtils.degToRad(
        isActive ? activeBinding?.orientationXDeg ?? 0 : 0
      );
      const orientationYRad = THREE.MathUtils.degToRad(
        isActive ? activeBinding?.orientationYDeg ?? 0 : 0
      );
      const orientationZRad = THREE.MathUtils.degToRad(
        isActive ? activeBinding?.orientationZDeg ?? 0 : 0
      );

      scene.root.scale.set(
        scene.baseScale * scale * tunnelScaleX,
        scene.baseScale * scale * tunnelScaleY,
        scene.baseScale * scale
      );
      scene.root.position.x = scene.baseX + offsetX;
      scene.root.position.y = scene.baseY;
      scene.root.position.z = scene.baseZ + (isActive ? depthZ : 0);
      scene.root.rotation.set(
        scene.baseRotationX + orientationXRad,
        scene.baseRotationY + orientationYRad,
        scene.baseRotationZ + orientationZRad
      );
      scene.root.visible = isActive && wTarget > 0.01 && opacityScale > 0.001;

      scene.mixer?.update(delta);
      const opacity = isActive ? (0.08 + wTarget * 0.92) * opacityScale : 0;
      for (const material of scene.materials) {
        material.opacity = opacity;
      }
    }
  });

  return (
    <group>
      {ARCHETYPES.map((archetype) => (
        <primitive key={archetype.id} object={preparedById[archetype.id].root} />
      ))}
    </group>
  );
}
