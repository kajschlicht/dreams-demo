import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import GUI from "lil-gui";
import * as THREE from "three";
import type { GLBPointSets } from "../archetypes/sampleGLBTargets";
import { loadGLBPointSets, silhouetteProbability } from "../archetypes/sampleGLBTargets";
import { selectRenderableStoryObjects, useAppStore } from "../core/store";
import { registryToLibrary } from "../data/elementsRegistry";
import {
  applyObjectTransform,
  applyOrientationToNormalsY,
  resolveObjectTransform,
  type ResolvedObjectTransform,
} from "../story/applyObjectTransform";
import { resolveActiveClips } from "../story/activeClips";
import { buildTimeline } from "../story/timeline";
import { getTheme, type ThemeName } from "../theme";
import { resolveSceneModeVisualSettings } from "../core/sceneMode";
import {
  ARCHETYPES,
  clamp01,
  smoothstep,
  subtleDepthOffset,
  type ArchetypeId,
} from "./morphTimeline";
import { debugControls } from "./debugControls";
import { getEffectiveProgress } from "./scrollTimeline";

const MAX_PARTICLE_COUNT = 30000;
const MIN_PARTICLE_COUNT = 1000;
const DEFAULT_PARTICLE_COUNT = 25000;
const SURFACE_SAMPLE_COUNT = 26000;
const EDGE_SAMPLE_COUNT = 26000;
const EDGE_THRESHOLD_ANGLE = 22;
const DEFAULT_MODE = 0.2;
const MIN_PARTICLES_PER_OBJECT = 8000;
const LIGHT_MODE_PARTICLE_COLOR = "#202aff";
const DARK_MODE_PARTICLE_COLOR = "#e7b6ac";
const DEFAULT_STORY_TRANSFORM = {
  archetypeId: undefined as ArchetypeId | undefined,
  transform: resolveObjectTransform(undefined),
  transitionIn: 0.1,
  stay: 0.5,
  transitionOut: 0.1,
} as const;

type StoryTransform = {
  archetypeId?: ArchetypeId;
  transform: ResolvedObjectTransform;
  transitionIn: number;
  stay: number;
  transitionOut: number;
};

function hash01(index: number, seed: number): number {
  const x = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function rangeValue(index: number, seed: number, min: number, max: number): number {
  return min + hash01(index, seed) * (max - min);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clampRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function applySceneModeOffset(
  sceneValue: number,
  debugValue: number,
  debugBaseline: number,
  min: number,
  max: number
): number {
  return clampRange(sceneValue + (debugValue - debugBaseline), min, max);
}

function createSoftParticleTexture(softness: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  const clampedSoftness = Math.min(1, Math.max(0.2, softness));
  const hardCore = 0.7 - clampedSoftness * 0.5;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(Math.max(0.05, hardCore), "rgba(255,255,255,1)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

function safeNormalize(
  x: number,
  y: number,
  z: number
): { x: number; y: number; z: number } {
  const len = Math.sqrt(x * x + y * y + z * z);
  if (len <= 1e-6) return { x: 0, y: 0, z: 0 };
  return { x: x / len, y: y / len, z: z / len };
}

type ModeWeights = {
  wSurface: number;
  wEdge: number;
  wSil: number;
};

function modeToWeights(mode: number): ModeWeights {
  const m = clamp01(mode / 2) * 2;
  if (m <= 1) {
    const wSurface = 1 - m;
    const wEdge = m;
    const wSil = 0;
    return { wSurface, wEdge, wSil };
  }

  const t = m - 1;
  const wSurface = 0;
  const wEdge = 1 - t;
  const wSil = t;
  return { wSurface, wEdge, wSil };
}

function normalizedWeights(weights: ModeWeights): ModeWeights {
  const sum = weights.wSurface + weights.wEdge + weights.wSil;
  if (sum <= 1e-5) return { wSurface: 1, wEdge: 0, wSil: 0 };
  return {
    wSurface: weights.wSurface / sum,
    wEdge: weights.wEdge / sum,
    wSil: weights.wSil / sum,
  };
}

function createFallbackPointSet(baseCloud: Float32Array): GLBPointSets {
  const surfacePositions = new Float32Array(SURFACE_SAMPLE_COUNT * 3);
  const edgePositions = new Float32Array(EDGE_SAMPLE_COUNT * 3);
  const surfaceNormals = new Float32Array(SURFACE_SAMPLE_COUNT * 3);

  for (let i = 0; i < SURFACE_SAMPLE_COUNT; i++) {
    const srcI3 = (i % MAX_PARTICLE_COUNT) * 3;
    const dstI3 = i * 3;
    surfacePositions[dstI3 + 0] = baseCloud[srcI3 + 0];
    surfacePositions[dstI3 + 1] = baseCloud[srcI3 + 1];
    surfacePositions[dstI3 + 2] = baseCloud[srcI3 + 2];
    surfaceNormals[dstI3 + 0] = 0;
    surfaceNormals[dstI3 + 1] = 1;
    surfaceNormals[dstI3 + 2] = 0;
  }

  for (let i = 0; i < EDGE_SAMPLE_COUNT; i++) {
    const srcI3 = (i % MAX_PARTICLE_COUNT) * 3;
    const dstI3 = i * 3;
    edgePositions[dstI3 + 0] = baseCloud[srcI3 + 0];
    edgePositions[dstI3 + 1] = baseCloud[srcI3 + 1];
    edgePositions[dstI3 + 2] = baseCloud[srcI3 + 2];
  }

  return { surfacePositions, edgePositions, surfaceNormals };
}

function getPointSetCenter(pointSet: GLBPointSets, out: THREE.Vector3): void {
  const surf = pointSet.surfacePositions;
  const sampleCount = Math.max(1, Math.floor(surf.length / 3));
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let i = 0; i < sampleCount; i++) {
    const i3 = i * 3;
    cx += surf[i3 + 0];
    cy += surf[i3 + 1];
    cz += surf[i3 + 2];
  }
  out.set(cx / sampleCount, cy / sampleCount, cz / sampleCount);
}

function normalizedArchetypeKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function archetypeIdFromAssetFile(file: string): string {
  const fileName = file.split("/").pop() ?? file;
  return fileName.replace(/\.glb$/i, "");
}

export function updateMixedParticleBuffer(
  weightsInput: ModeWeights,
  renderCount: number,
  camera: THREE.Camera,
  pointSet: GLBPointSets,
  outPositions: Float32Array,
  seed = 1
): void {
  const count = Math.max(
    MIN_PARTICLE_COUNT,
    Math.min(MAX_PARTICLE_COUNT, Math.floor(renderCount))
  );
  const weights = normalizedWeights(weightsInput);
  const surfaceCount = Math.max(1, Math.floor(pointSet.surfacePositions.length / 3));
  const edgeCount = Math.max(1, Math.floor(pointSet.edgePositions.length / 3));

  let nSurface = Math.round(count * weights.wSurface);
  let nEdge = Math.round(count * weights.wEdge);
  let nSil = count - nSurface - nEdge;
  if (nSil < 0) {
    nSil = 0;
    nEdge = Math.max(0, count - nSurface);
  }

  const cameraPos = new THREE.Vector3();
  camera.getWorldPosition(cameraPos);
  const normal = new THREE.Vector3();
  const viewDir = new THREE.Vector3();

  let writeParticle = 0;

  const copyFromSurface = (surfaceIndex: number) => {
    const src = surfaceIndex * 3;
    const dst = writeParticle * 3;
    outPositions[dst + 0] = pointSet.surfacePositions[src + 0];
    outPositions[dst + 1] = pointSet.surfacePositions[src + 1];
    outPositions[dst + 2] = pointSet.surfacePositions[src + 2];
    writeParticle++;
  };

  const copyFromEdge = (edgeIndex: number) => {
    const src = edgeIndex * 3;
    const dst = writeParticle * 3;
    outPositions[dst + 0] = pointSet.edgePositions[src + 0];
    outPositions[dst + 1] = pointSet.edgePositions[src + 1];
    outPositions[dst + 2] = pointSet.edgePositions[src + 2];
    writeParticle++;
  };

  for (let i = 0; i < nSurface; i++) {
    const idx = Math.floor(hash01(i, seed + 101) * surfaceCount) % surfaceCount;
    copyFromSurface(idx);
  }

  for (let i = 0; i < nEdge; i++) {
    const idx = Math.floor(hash01(i, seed + 503) * edgeCount) % edgeCount;
    copyFromEdge(idx);
  }

  for (let i = 0; i < nSil; i++) {
    let chosen = Math.floor(hash01(i, seed + 907) * surfaceCount) % surfaceCount;
    let bestIdx = chosen;
    let bestProb = 0;

    for (let attempt = 0; attempt < 8; attempt++) {
      const probe = Math.floor(hash01(i * 19 + attempt, seed + 1301) * surfaceCount) % surfaceCount;
      const probeI3 = probe * 3;
      const px = pointSet.surfacePositions[probeI3 + 0];
      const py = pointSet.surfacePositions[probeI3 + 1];
      const pz = pointSet.surfacePositions[probeI3 + 2];

      const nx = pointSet.surfaceNormals[probeI3 + 0];
      const ny = pointSet.surfaceNormals[probeI3 + 1];
      const nz = pointSet.surfaceNormals[probeI3 + 2];

      const vx = cameraPos.x - px;
      const vy = cameraPos.y - py;
      const vz = cameraPos.z - pz;
      const vLen = Math.max(1e-6, Math.sqrt(vx * vx + vy * vy + vz * vz));

      normal.set(nx, ny, nz).normalize();
      viewDir.set(vx / vLen, vy / vLen, vz / vLen);
      const probability = silhouetteProbability(normal, viewDir, 0.35, 0.92);
      if (probability > bestProb) {
        bestProb = probability;
        bestIdx = probe;
      }

      const acceptance = hash01(i * 37 + attempt, seed + 1709);
      if (acceptance < probability) {
        chosen = probe;
        break;
      }
      chosen = bestIdx;
    }

    copyFromSurface(chosen);
  }

  while (writeParticle < count) {
    const idx = Math.floor(hash01(writeParticle, seed + 1999) * surfaceCount) % surfaceCount;
    copyFromSurface(idx);
  }
}

export function ParticleCloud() {
  const scene = useAppStore((s) => s.scene);
  const lockState = useAppStore((s) => s.lockState);
  const setLockState = useAppStore((s) => s.setLockState);
  const cloudStrength = useAppStore((s) => s.cloudStrength);
  const setCloudStrength = useAppStore((s) => s.setCloudStrength);
  const sceneModeValue = useAppStore((s) => s.sceneModeValue);
  const storyObjects = useAppStore(selectRenderableStoryObjects);
  const elementsRegistry = useAppStore((s) => s.elementsRegistry);
  const appMode = useAppStore((s) => s.mode);
  const themeName = useAppStore((s) => s.themeName);
  const setTheme = useAppStore((s) => s.setTheme);
  const pointsRef =
    useRef<THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>>(null);
  const particleCountRef = useRef(DEFAULT_PARTICLE_COUNT);
  const modeRef = useRef(DEFAULT_MODE);
  const guiRef = useRef<GUI | null>(null);
  const modeDirtyRef = useRef(true);
  const blendingOverriddenRef = useRef(false);
  const particleColorOverriddenRef = useRef(false);
  const lastObjectKeyRef = useRef("");
  const staticSampleCameraRef = useRef(new THREE.PerspectiveCamera(60, 1, 0.1, 120));
  const activeCenterRef = useRef(new THREE.Vector3(0, 0.8, 0));
  const mixedTargetRef = useRef<Float32Array>(new Float32Array(MAX_PARTICLE_COUNT * 3));
  const [softnessControlTick, setSoftnessControlTick] = useState(0);
  const [pointSetsById, setPointSetsById] = useState<Record<ArchetypeId, GLBPointSets> | null>(
    null
  );
  const library = useMemo(() => registryToLibrary(elementsRegistry), [elementsRegistry]);
  const enabledStoryObjects = useMemo(
    () => storyObjects.filter((storyObject) => storyObject.enabled),
    [storyObjects]
  );
  const storyTransformsById = useMemo(() => {
    const assetById = new Map(library.map((asset) => [asset.id, asset]));
    const archetypeIdByKey = new Map(
      ARCHETYPES.map((archetype) => [normalizedArchetypeKey(archetype.id), archetype.id])
    );
    const byId = new Map<string, StoryTransform>();

    for (const storyObject of enabledStoryObjects) {
      const asset = assetById.get(storyObject.assetId);
      let archetypeId: ArchetypeId | undefined;
      if (asset && asset.type !== "effect" && asset.file) {
        const key = normalizedArchetypeKey(archetypeIdFromAssetFile(asset.file));
        archetypeId = archetypeIdByKey.get(key);
      }
      const transform = resolveObjectTransform({
        size: storyObject.param1,
        offsetX: storyObject.param2,
        orientationX: storyObject.orientationX,
        orientationY: storyObject.orientationY,
        orientationZ: storyObject.orientationZ,
        mode: storyObject.param3,
      });
      byId.set(storyObject.id, {
        archetypeId,
        transform,
        transitionIn: Math.min(1, Math.max(0, storyObject.transitionIn ?? 0.1)),
        stay: Math.min(2, Math.max(0, storyObject.stay ?? 0.5)),
        transitionOut: Math.min(1, Math.max(0, storyObject.transitionOut ?? 0.1)),
      });
    }

    return byId;
  }, [enabledStoryObjects, library]);
  const storyTransformsSignature = useMemo(
    () =>
      enabledStoryObjects
        .map((storyObject) => {
          const transform = storyTransformsById.get(storyObject.id) ?? DEFAULT_STORY_TRANSFORM;
          return `${storyObject.id}:${transform.transform.size.toFixed(3)}:${transform.transform.offsetX.toFixed(
            3
          )}:${transform.transform.orientationDegX.toFixed(
            1
          )}:${transform.transform.orientationDegY.toFixed(
            1
          )}:${transform.transform.orientationDegZ.toFixed(
            1
          )}:${transform.transform.mode.toFixed(3)}:${transform.transitionIn.toFixed(
            3
          )}:${transform.stay.toFixed(
            3
          )}:${transform.transitionOut.toFixed(3)}:${transform.archetypeId ?? "effect"}`;
        })
        .join("|"),
    [enabledStoryObjects, storyTransformsById]
  );
  const timeline = useMemo(
    () =>
      buildTimeline(
        enabledStoryObjects.map((storyObject) => {
          const transform = storyTransformsById.get(storyObject.id) ?? DEFAULT_STORY_TRANSFORM;
          return {
            id: storyObject.id,
            assetId: storyObject.assetId,
            enabled: true,
            transitionIn: transform.transitionIn,
            stay: transform.stay,
            transitionOut: transform.transitionOut,
          };
        })
      ),
    [enabledStoryObjects, storyTransformsById]
  );
  const theme = getTheme(themeName);
  const sceneModeVisual = useMemo(
    () => resolveSceneModeVisualSettings(sceneModeValue),
    [sceneModeValue]
  );
  const effectiveSoftness = useMemo(
    () =>
      applySceneModeOffset(
        sceneModeVisual.softness,
        debugControls.softness,
        0.75,
        0.2,
        1
      ),
    [sceneModeVisual.softness, softnessControlTick]
  );
  const spriteTexture = useMemo(
    () => createSoftParticleTexture(effectiveSoftness),
    [effectiveSoftness]
  );
  const particleMaterial = useMemo(() => {
    const defaultBlending =
      themeName === "dark" ? THREE.AdditiveBlending : THREE.NormalBlending;
    const defaultParticleColor =
      themeName === "dark" ? DARK_MODE_PARTICLE_COLOR : LIGHT_MODE_PARTICLE_COLOR;
    const mat = new THREE.PointsMaterial({
      color: defaultParticleColor,
      size: 0.03,
      sizeAttenuation: true,
      transparent: true,
      alphaTest: 0.01,
      opacity: theme.particleBaseOpacity,
      map: spriteTexture,
      depthWrite: false,
      blending: defaultBlending,
    });

    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          "void main() {",
          [
            "attribute float aSize;",
            "attribute float aAlpha;",
            "varying float vAlpha;",
            "void main() {",
          ].join("\n")
        )
        .replace("gl_PointSize = size;", "gl_PointSize = size * aSize;\n  vAlpha = aAlpha;");

      shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", "varying float vAlpha;\nvoid main() {")
        .replace(
          "vec4 diffuseColor = vec4( diffuse, opacity );",
          "vec4 diffuseColor = vec4( diffuse, opacity * vAlpha );"
        );
    };
    mat.customProgramCacheKey = () => "particle-size-alpha-v1";
    return mat;
  }, [spriteTexture, theme.particleBaseOpacity, themeName]);

  const {
    geometry,
    positions,
    baseCloudPositions,
    phases,
    particleSizeRandom,
    particleSizeFactors,
    particleAlphaFactors,
    fallbackPointSet,
  } = useMemo(() => {
    const pos = new Float32Array(MAX_PARTICLE_COUNT * 3);
    const baseCloud = new Float32Array(MAX_PARTICLE_COUNT * 3);
    const phase = new Float32Array(MAX_PARTICLE_COUNT);
    const sizeRandom = new Float32Array(MAX_PARTICLE_COUNT);
    const sizeFactors = new Float32Array(MAX_PARTICLE_COUNT);
    const alphaFactors = new Float32Array(MAX_PARTICLE_COUNT);

    for (let i = 0; i < MAX_PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const bx = rangeValue(i, scene.seed + 11, -6, 6);
      const by = rangeValue(i, scene.seed + 23, -4, 4);
      const bz = rangeValue(i, scene.seed + 37, -4, 4);
      baseCloud[i3 + 0] = bx;
      baseCloud[i3 + 1] = by;
      baseCloud[i3 + 2] = bz;
      pos[i3 + 0] = bx;
      pos[i3 + 1] = by;
      pos[i3 + 2] = bz;
      phase[i] = rangeValue(i, scene.seed + 771, 0, Math.PI * 2);
      sizeRandom[i] = 0.85 + hash01(i, scene.seed + 1201) * 0.3;
      sizeFactors[i] = 1;
      alphaFactors[i] = 1;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizeFactors, 1));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(alphaFactors, 1));
    geo.setDrawRange(0, DEFAULT_PARTICLE_COUNT);

    return {
      geometry: geo,
      positions: pos,
      baseCloudPositions: baseCloud,
      phases: phase,
      particleSizeRandom: sizeRandom,
      particleSizeFactors: sizeFactors,
      particleAlphaFactors: alphaFactors,
      fallbackPointSet: createFallbackPointSet(baseCloud),
    };
  }, [scene.seed]);
  const transformedPointSetsById = useMemo(() => {
    const baseSetsById = pointSetsById ?? ARCHETYPES.reduce((acc, archetype) => {
      acc[archetype.id] = fallbackPointSet;
      return acc;
    }, {} as Record<ArchetypeId, GLBPointSets>);

    const transformedById = {} as Record<string, GLBPointSets>;
    for (const storyObject of enabledStoryObjects) {
      const storyTransform = storyTransformsById.get(storyObject.id);
      const archetypeId = storyTransform?.archetypeId;
      if (!archetypeId) continue;
      const baseSet = baseSetsById[archetypeId] ?? fallbackPointSet;
      const transform = storyTransform?.transform ?? DEFAULT_STORY_TRANSFORM.transform;
      transformedById[storyObject.id] = {
        surfacePositions: applyObjectTransform(baseSet.surfacePositions, transform),
        edgePositions: applyObjectTransform(baseSet.edgePositions, transform),
        surfaceNormals: applyOrientationToNormalsY(baseSet.surfaceNormals, transform),
      };
    }
    return transformedById;
  }, [enabledStoryObjects, fallbackPointSet, pointSetsById, storyTransformsById]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => particleMaterial.dispose(), [particleMaterial]);
  useEffect(() => () => spriteTexture.dispose(), [spriteTexture]);

  useEffect(() => {
    if (blendingOverriddenRef.current) return;
    debugControls.blendingMode = themeName === "dark" ? "additive" : "normal";
  }, [themeName]);

  useEffect(() => {
    if (particleColorOverriddenRef.current) return;
    debugControls.particleColor =
      themeName === "dark" ? DARK_MODE_PARTICLE_COLOR : LIGHT_MODE_PARTICLE_COLOR;
  }, [themeName]);

  useEffect(() => {
    modeDirtyRef.current = true;
  }, [enabledStoryObjects]);

  useEffect(() => {
    modeDirtyRef.current = true;
  }, [storyTransformsSignature]);

  useEffect(() => {
    if (appMode !== "edit") {
      if (guiRef.current) {
        guiRef.current.destroy();
        guiRef.current = null;
      }
      return;
    }

    if (!blendingOverriddenRef.current) {
      debugControls.blendingMode = themeName === "dark" ? "additive" : "normal";
    }
    if (!particleColorOverriddenRef.current) {
      debugControls.particleColor =
        themeName === "dark" ? DARK_MODE_PARTICLE_COLOR : LIGHT_MODE_PARTICLE_COLOR;
    }

    const guiState = {
      theme: themeName as ThemeName,
      lockState,
      mode: DEFAULT_MODE,
      meshOpacity: debugControls.meshOpacity,
      depth: debugControls.depthStrength,
      cloudStrength,
      particleColor: debugControls.particleColor,
      softness: debugControls.softness,
      sizeVariation: debugControls.sizeVariation,
      cloudOpacity: debugControls.cloudOpacity,
      peakOpacity: debugControls.peakOpacity,
      blendingMode: debugControls.blendingMode as "normal" | "additive",
      motionEnabled: debugControls.motionEnabled,
      motionAmount: debugControls.motionAmount,
      depthFade: debugControls.depthFade,
      peakStrength: debugControls.peakStrength,
      peakHoldLength: debugControls.peakHoldLength,
      subtleMotionStrength: debugControls.subtleMotionStrength,
      cloudSize: debugControls.cloudSize,
      noiseStrength: debugControls.noiseStrength,
      noiseEnabled: debugControls.noiseEnabled,
      particles: DEFAULT_PARTICLE_COUNT,
    };
    const gui = new GUI({ title: "Particle Modes" });
    guiRef.current = gui;
    const themeCtrl = gui
      .add(guiState, "theme", { Bright: "light", Dark: "dark" })
      .name("theme");
    const lockCtrl = gui.add(guiState, "lockState").name("lock state");
    const modeCtrl = gui.add(guiState, "mode", 0, 2, 0.01).name("mode");
    const meshOpacityCtrl = gui
      .add(guiState, "meshOpacity", 0, 1, 0.01)
      .name("mesh opacity");
    const depthCtrl = gui
      .add(guiState, "depth", 0, 8, 0.1)
      .name("depth");
    const cloudStrengthCtrl = gui
      .add(guiState, "cloudStrength", 0, 1, 0.01)
      .name("cloud");
    const particleColorCtrl = gui
      .addColor(guiState, "particleColor")
      .name("particle color");
    const softnessCtrl = gui
      .add(guiState, "softness", 0.2, 1, 0.01)
      .name("softness");
    const sizeVariationCtrl = gui
      .add(guiState, "sizeVariation", 0, 0.3, 0.01)
      .name("size variation");
    const cloudOpacityCtrl = gui
      .add(guiState, "cloudOpacity", 0.05, 0.6, 0.01)
      .name("cloud opacity");
    const peakOpacityCtrl = gui
      .add(guiState, "peakOpacity", 0.2, 1, 0.01)
      .name("peak opacity");
    const blendingModeCtrl = gui
      .add(guiState, "blendingMode", { Normal: "normal", Additive: "additive" })
      .name("blending");
    const motionEnabledCtrl = gui
      .add(guiState, "motionEnabled")
      .name("motion");
    const motionAmountCtrl = gui
      .add(guiState, "motionAmount", 0, 1, 0.01)
      .name("motion amount");
    const depthFadeCtrl = gui
      .add(guiState, "depthFade", 0, 1, 0.01)
      .name("depth fade");
    const peakStrengthCtrl = gui
      .add(guiState, "peakStrength", 0.98, 1, 0.001)
      .name("peak strength");
    const peakHoldLengthCtrl = gui
      .add(guiState, "peakHoldLength", 0.1, 0.9, 0.01)
      .name("peak hold length");
    const subtleMotionCtrl = gui
      .add(guiState, "subtleMotionStrength", 0, 2, 0.01)
      .name("subtle motion");
    const cloudSizeCtrl = gui
      .add(guiState, "cloudSize", 1, 6, 0.1)
      .name("cloud size");
    const noiseEnabledCtrl = gui
      .add(guiState, "noiseEnabled")
      .name("noise");
    const noiseStrengthCtrl = gui
      .add(guiState, "noiseStrength", 0, 3, 0.05)
      .name("noise strength");
    const particlesCtrl = gui
      .add(guiState, "particles", MIN_PARTICLE_COUNT, MAX_PARTICLE_COUNT, 100)
      .name("particles");

    themeCtrl.onChange((nextTheme: ThemeName) => {
      setTheme(nextTheme);
    });
    lockCtrl.onChange((nextLock: boolean) => {
      setLockState(nextLock);
    });
    modeCtrl.onChange((nextMode: number) => {
      modeRef.current = nextMode;
      modeDirtyRef.current = true;
    });
    meshOpacityCtrl.onChange((nextOpacity: number) => {
      debugControls.meshOpacity = nextOpacity;
    });
    depthCtrl.onChange((nextDepth: number) => {
      debugControls.depthStrength = nextDepth;
    });
    cloudStrengthCtrl.onChange((nextCloudStrength: number) => {
      setCloudStrength(nextCloudStrength);
    });
    particleColorCtrl.onChange((nextColor: string) => {
      particleColorOverriddenRef.current = true;
      debugControls.particleColor = nextColor;
    });
    softnessCtrl.onChange((nextSoftness: number) => {
      debugControls.softness = nextSoftness;
      setSoftnessControlTick((tick) => tick + 1);
    });
    sizeVariationCtrl.onChange((nextSizeVariation: number) => {
      debugControls.sizeVariation = nextSizeVariation;
    });
    cloudOpacityCtrl.onChange((nextCloudOpacity: number) => {
      debugControls.cloudOpacity = nextCloudOpacity;
    });
    peakOpacityCtrl.onChange((nextPeakOpacity: number) => {
      debugControls.peakOpacity = nextPeakOpacity;
    });
    blendingModeCtrl.onChange((nextBlendingMode: "normal" | "additive") => {
      blendingOverriddenRef.current = true;
      debugControls.blendingMode = nextBlendingMode;
    });
    motionEnabledCtrl.onChange((nextMotionEnabled: boolean) => {
      debugControls.motionEnabled = nextMotionEnabled;
    });
    motionAmountCtrl.onChange((nextMotionAmount: number) => {
      debugControls.motionAmount = nextMotionAmount;
    });
    depthFadeCtrl.onChange((nextDepthFade: number) => {
      debugControls.depthFade = nextDepthFade;
    });
    peakStrengthCtrl.onChange((nextPeakStrength: number) => {
      debugControls.peakStrength = nextPeakStrength;
    });
    peakHoldLengthCtrl.onChange((nextPeakHoldLength: number) => {
      debugControls.peakHoldLength = nextPeakHoldLength;
    });
    subtleMotionCtrl.onChange((nextMotionStrength: number) => {
      debugControls.subtleMotionStrength = nextMotionStrength;
    });
    cloudSizeCtrl.onChange((nextCloudSize: number) => {
      debugControls.cloudSize = nextCloudSize;
    });
    noiseEnabledCtrl.onChange((nextEnabled: boolean) => {
      debugControls.noiseEnabled = nextEnabled;
    });
    noiseStrengthCtrl.onChange((nextNoiseStrength: number) => {
      debugControls.noiseStrength = nextNoiseStrength;
    });
    particlesCtrl.onChange((nextCount: number) => {
      particleCountRef.current = Math.floor(nextCount);
      modeDirtyRef.current = true;
    });

    return () => {
      guiRef.current = null;
      gui.destroy();
    };
  }, [appMode, cloudStrength, lockState, setCloudStrength, setLockState, setTheme, themeName]);

  useEffect(() => {
    const gui = guiRef.current;
    if (!gui) return;
    const el = gui.domElement;
    if (themeName === "light") {
      el.style.setProperty("--background-color", "#edf2f7");
      el.style.setProperty("--text-color", "#1b2735");
      el.style.setProperty("--title-background-color", "#dce6f1");
      el.style.setProperty("--widget-color", "#d7e2ef");
      el.style.setProperty("--hover-color", "#c3d3e6");
      el.style.setProperty("--focus-color", "#9fb9d6");
      return;
    }
    el.style.removeProperty("--background-color");
    el.style.removeProperty("--text-color");
    el.style.removeProperty("--title-background-color");
    el.style.removeProperty("--widget-color");
    el.style.removeProperty("--hover-color");
    el.style.removeProperty("--focus-color");
  }, [themeName]);

  useEffect(() => {
    let cancelled = false;
    setPointSetsById(null);

    const loadTargets = async () => {
      const loadedEntries = await Promise.all(
        ARCHETYPES.map(async (archetype, i) => {
          let pointSet: GLBPointSets;
          try {
            pointSet = await loadGLBPointSets(
              archetype.url,
              SURFACE_SAMPLE_COUNT,
              EDGE_SAMPLE_COUNT,
              EDGE_THRESHOLD_ANGLE
            );
          } catch (error) {
            console.error(
              `[ParticleCloud] Failed to build point sets for ${archetype.url}`,
              error
            );
            const jitteredSurface = fallbackPointSet.surfacePositions.slice();
            const jitteredEdge = fallbackPointSet.edgePositions.slice();
            for (let p = 0; p < jitteredSurface.length; p += 3) {
              jitteredSurface[p + 2] += rangeValue(p + i, scene.seed + 9001, -0.1, 0.1);
            }
            pointSet = {
              surfacePositions: jitteredSurface,
              edgePositions: jitteredEdge,
              surfaceNormals: fallbackPointSet.surfaceNormals.slice(),
            };
          }
          return [archetype.id, pointSet] as const;
        })
      );

      if (cancelled) return;
      const nextById = {} as Record<ArchetypeId, GLBPointSets>;
      for (const [id, pointSet] of loadedEntries) {
        nextById[id] = pointSet;
      }
      setPointSetsById(nextById);
      modeDirtyRef.current = true;
    };

    void loadTargets();

    return () => {
      cancelled = true;
    };
  }, [fallbackPointSet, scene.seed]);

  useFrame(({ clock, camera }, delta) => {
    const points = pointsRef.current;
    if (!points) return;
    const baseParticleCount = Math.max(
      MIN_PARTICLE_COUNT,
      Math.min(MAX_PARTICLE_COUNT, Math.floor(particleCountRef.current))
    );

    const p = clamp01(getEffectiveProgress(lockState));
    const tSec = clock.getElapsedTime();

    let segIndex = 0;
    let localT = 0;
    let wCloudRaw = 1;
    let wTarget = 0;
    let activeSet: GLBPointSets = fallbackPointSet;
    let activeTransform: StoryTransform = DEFAULT_STORY_TRANSFORM;
    let activeKey = "none";
    const timelinePosition = p * timeline.totalLength;
    const activeClip = resolveActiveClips(timeline, timelinePosition)[0];
    if (activeClip) {
      segIndex = Math.max(activeClip.segmentIndex, 0);
      const activeSegment = timeline.segments[segIndex];
      localT = activeSegment
        ? clamp01(
            (timelinePosition - activeSegment.start) /
              Math.max(activeSegment.end - activeSegment.start, 1e-4)
          )
        : 0;

      const storyTransform = storyTransformsById.get(activeClip.objectId) ?? DEFAULT_STORY_TRANSFORM;
      activeTransform = storyTransform;
      if (storyTransform.archetypeId && transformedPointSetsById[activeClip.objectId]) {
        activeSet = transformedPointSetsById[activeClip.objectId] ?? fallbackPointSet;
        activeKey = activeClip.objectId;
        wTarget = activeClip.weight * debugControls.peakStrength;
        wCloudRaw = 1 - wTarget;
      } else {
        activeSet = fallbackPointSet;
        activeKey = `effect:${activeClip.objectId}`;
        wTarget = 0;
        wCloudRaw = 1;
      }
    } else {
      wCloudRaw = 1;
      wTarget = 0;
    }
    const activeMode = clamp01(activeTransform.transform.mode ?? modeRef.current);
    const activeScaleForCount = Math.max(0.1, activeTransform.transform.size);
    const effectiveParticleCount = Math.min(
      MAX_PARTICLE_COUNT,
      Math.max(
        MIN_PARTICLES_PER_OBJECT,
        Math.floor(baseParticleCount / activeScaleForCount)
      )
    );
    geometry.setDrawRange(0, effectiveParticleCount);
    const depthZ =
      subtleDepthOffset(localT) *
      sceneModeVisual.depth;

    const weights = modeToWeights(activeMode);
    const needsResample =
      modeDirtyRef.current ||
      activeKey !== lastObjectKeyRef.current;

    if (needsResample) {
      const sampleCamera = staticSampleCameraRef.current;
      sampleCamera.position.set(0, 0.8, 9);
      sampleCamera.lookAt(0, 0.8, 0);
      sampleCamera.updateMatrixWorld();
      updateMixedParticleBuffer(
        weights,
        effectiveParticleCount,
        sampleCamera,
        activeSet,
        mixedTargetRef.current,
        scene.seed + segIndex * 137
      );
      getPointSetCenter(activeSet, activeCenterRef.current);

      modeDirtyRef.current = false;
      lastObjectKeyRef.current = activeKey;
    }

    const dominantWeight = Math.max(weights.wSurface, weights.wEdge, weights.wSil);
    const structureProgress = wTarget;
    const effectiveCloudOpacity = applySceneModeOffset(
      sceneModeVisual.cloudOpacity,
      debugControls.cloudOpacity,
      0.6,
      0.05,
      1
    );
    const targetOpacity = lerp(
      effectiveCloudOpacity,
      debugControls.peakOpacity,
      structureProgress
    );
    points.material.opacity = clamp01(targetOpacity);
    const baseParticleSize = 0.026 + dominantWeight * 0.014;
    const activeScaleFactor = Math.max(0.1, activeTransform.transform.size);
    const objectSizeFactor = Math.sqrt(activeScaleFactor);
    const scaledParticleSize = baseParticleSize * objectSizeFactor;
    points.material.size = Math.min(
      baseParticleSize * 1.4,
      Math.max(baseParticleSize * 0.6, scaledParticleSize)
    );
    const blendingMode =
      blendingOverriddenRef.current
        ? debugControls.blendingMode
        : themeName === "dark"
          ? "additive"
          : "normal";
    points.material.blending =
      blendingMode === "additive" ? THREE.AdditiveBlending : THREE.NormalBlending;
    points.material.depthWrite = false;
    points.material.map = spriteTexture;
    points.material.alphaTest = 0.01;
    const particleColor =
      particleColorOverriddenRef.current
        ? debugControls.particleColor || LIGHT_MODE_PARTICLE_COLOR
        : themeName === "dark"
          ? DARK_MODE_PARTICLE_COLOR
          : LIGHT_MODE_PARTICLE_COLOR;
    points.material.color.set(particleColor);

    const cloudMotionBlend = smoothstep(0.05, 1, wCloudRaw);
    const lerpSpeed = 8 + cloudMotionBlend * 5;
    const lerpFactor = 1 - Math.exp(-lerpSpeed * delta);
    const spreadFactor = (1 - structureProgress) * debugControls.spreadStrength;
    const mappedMotionAmount = applySceneModeOffset(
      sceneModeVisual.motionAmount,
      debugControls.motionAmount,
      0.5,
      0,
      1
    );
    const motionAmount = debugControls.motionEnabled ? mappedMotionAmount : 0;
    const noiseAmplitude = debugControls.noiseEnabled
      ? 0.12 * debugControls.noiseStrength * cloudMotionBlend * motionAmount
      : 0;
    const subtleMotionStrength = applySceneModeOffset(
      sceneModeVisual.subtleAmount,
      debugControls.subtleMotionStrength,
      0.65,
      0,
      2
    );
    const cloudSize = applySceneModeOffset(
      sceneModeVisual.cloudSize,
      debugControls.cloudSize,
      1.2,
      1,
      6
    );
    const fluffiness = Math.max(0, debugControls.fluffiness);
    const fluffBlend = Math.min(0.65, fluffiness * 0.16);
    const noiseScale = debugControls.noiseScale;
    const sizeVariationBlend = clamp01(debugControls.sizeVariation / 0.3);
    const depthFadeAmount = clamp01(debugControls.depthFade);
    const depthAlphaMin = lerp(1, 0.75, depthFadeAmount);
    const tunnelScaleX = 1 - sceneModeVisual.tunnelAmount * 0.2;
    const tunnelScaleY = 1 - sceneModeVisual.tunnelAmount * 0.12;
    const sceneMotionPresence = 0.35 + cloudMotionBlend * 0.65;
    const sceneMotionAmplitude =
      0.02 *
      motionAmount *
      sceneModeVisual.motionMultiplier *
      sceneMotionPresence;
    const cameraPos = camera.position;
    const nearDistance = 6;
    const farDistance = 24;
    const centerX = activeCenterRef.current.x;
    const centerY = activeCenterRef.current.y;
    const centerZ = activeCenterRef.current.z;

    for (let i = 0; i < effectiveParticleCount; i++) {
      const i3 = i * 3;
      const phase = phases[i];

      const bx = baseCloudPositions[i3 + 0];
      const by = baseCloudPositions[i3 + 1];
      const bz = baseCloudPositions[i3 + 2];

      const tx = mixedTargetRef.current[i3 + 0];
      const ty = mixedTargetRef.current[i3 + 1];
      const tz = mixedTargetRef.current[i3 + 2];

      const nx = tx - centerX;
      const ny = ty - centerY;
      const nz = tz - centerZ;
      const dir = safeNormalize(nx, ny, nz);

      let spreadX = tx + dir.x * spreadFactor;
      let spreadY = ty + dir.y * spreadFactor;
      let spreadZ = tz + depthZ + dir.z * spreadFactor;

      spreadX = centerX + (spreadX - centerX) * tunnelScaleX;
      spreadY = centerY + (spreadY - centerY) * tunnelScaleY;

      if (noiseAmplitude > 1e-5) {
        const sx = spreadX * noiseScale;
        const sy = spreadY * noiseScale;
        const sz = spreadZ * noiseScale;
        const noisePhase = tSec * 1.8 + p * 4.5;
        const noiseX = Math.sin(sx * 0.73 + sy * 1.11 + sz * 0.37 + noisePhase + phase);
        const noiseY = Math.sin(sx * 1.27 - sy * 0.59 + sz * 0.83 + noisePhase + phase * 1.3);
        const noiseZ = Math.sin(-sx * 0.44 + sy * 0.91 + sz * 1.35 + noisePhase + phase * 0.6);
        spreadX += noiseX * noiseAmplitude;
        spreadY += noiseY * noiseAmplitude;
        spreadZ += noiseZ * noiseAmplitude;
      }

      const desiredX = lerp(bx, spreadX, wTarget);
      const desiredY = lerp(by, spreadY, wTarget);
      const desiredZ = lerp(bz, spreadZ, wTarget);

      const cloudScale = 1 + (cloudSize - 1) * (1 - structureProgress);
      const cloudX = centerX + (bx - centerX) * cloudScale;
      const cloudY = centerY + (by - centerY) * cloudScale;
      const cloudZ = centerZ + (bz - centerZ) * cloudScale;

      const tunnelCloudX = centerX + (cloudX - centerX) * tunnelScaleX;
      const tunnelCloudY = centerY + (cloudY - centerY) * tunnelScaleY;

      const blendedX = lerp(tunnelCloudX, desiredX, structureProgress);
      const blendedY = lerp(tunnelCloudY, desiredY, structureProgress);
      const blendedZ = lerp(cloudZ, desiredZ, structureProgress);

      const loosen =
        fluffBlend *
        cloudMotionBlend *
        (0.35 + (1 - structureProgress) * 0.65);
      const looseX = lerp(blendedX, tunnelCloudX, loosen);
      const looseY = lerp(blendedY, tunnelCloudY, loosen);
      const looseZ = lerp(blendedZ, cloudZ, loosen);

      const fluffAmp =
        subtleMotionStrength *
        motionAmount *
        cloudMotionBlend *
        (1 - structureProgress) *
        (0.02 + (1 - structureProgress) * 0.13);
      const fluffPhase = tSec * 2.35 + p * 2.1;
      const fluffX = Math.sin(fluffPhase + phase * 1.7) * fluffAmp;
      const fluffY = Math.cos(fluffPhase + phase * 1.3) * fluffAmp;
      const fluffZ = Math.sin(fluffPhase + phase * 0.9) * fluffAmp * 0.75;

      const modeOscX =
        Math.sin(tSec * 1.7 + phase * 1.1 + p * 2.2) *
        sceneMotionAmplitude *
        sceneModeVisual.motionX;
      const modeRiseY =
        (Math.sin(tSec * 0.9 + phase * 0.6) * 0.5 + 0.5) *
        sceneMotionAmplitude *
        sceneModeVisual.motionY;

      positions[i3 + 0] = lerp(positions[i3 + 0], looseX + fluffX + modeOscX, lerpFactor);
      positions[i3 + 1] = lerp(positions[i3 + 1], looseY + fluffY + modeRiseY, lerpFactor);
      positions[i3 + 2] = lerp(positions[i3 + 2], looseZ + fluffZ, lerpFactor);

      const dx = positions[i3 + 0] - cameraPos.x;
      const dy = positions[i3 + 1] - cameraPos.y;
      const dz = positions[i3 + 2] - cameraPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const nearFactor = clamp01((farDistance - dist) / (farDistance - nearDistance));
      particleAlphaFactors[i] = lerp(depthAlphaMin, 1, nearFactor);
      particleSizeFactors[i] =
        1 + (particleSizeRandom[i] - 1) * sizeVariationBlend;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aAlpha.needsUpdate = true;
    geometry.attributes.aSize.needsUpdate = true;
  });

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={particleMaterial}
      frustumCulled={false}
    />
  );
}
