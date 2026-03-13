import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { selectRenderableSelectedAtmosphereId, useAppStore } from "../core/store";
import { atmospheres } from "../data/atmospheres";

const ATMOSPHERE_PARTICLE_COUNT = 20000;
const PLANE_HEIGHT = -8;
const ATMOSPHERE_OPACITY = 0.6;
const ATMOSPHERE_SOFTNESS = 0.3;
const ATMOSPHERE_CLOUD_SIZE = 2;

const atmosphereById = new Map(atmospheres.map((atmosphere) => [atmosphere.id, atmosphere]));

function hash01(index: number, seed: number): number {
  const x = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function createSoftParticleTexture(softness: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const hardCore = 0.72 - Math.min(1, Math.max(0.2, softness)) * 0.5;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(Math.max(0.06, hardCore), "rgba(255,255,255,1)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function AtmosphereLayers() {
  const selectedAtmosphereId = useAppStore(selectRenderableSelectedAtmosphereId);
  const selectedAtmosphere = selectedAtmosphereId
    ? atmosphereById.get(selectedAtmosphereId) ?? atmosphereById.get("open-air")
    : atmosphereById.get("open-air");

  const spriteTexture = useMemo(() => createSoftParticleTexture(ATMOSPHERE_SOFTNESS), []);
  const { geometry, sizeFactors } = useMemo(() => {
    const positions = new Float32Array(ATMOSPHERE_PARTICLE_COUNT * 3);
    const sizes = new Float32Array(ATMOSPHERE_PARTICLE_COUNT);

    const spanX = 30 * ATMOSPHERE_CLOUD_SIZE;
    const spanZ = 30 * ATMOSPHERE_CLOUD_SIZE;
    const spreadY = 1.1;

    for (let i = 0; i < ATMOSPHERE_PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      positions[i3 + 0] = (hash01(i, 101) * 2 - 1) * spanX;
      positions[i3 + 1] = PLANE_HEIGHT + (hash01(i, 211) * 2 - 1) * spreadY;
      positions[i3 + 2] = (hash01(i, 307) * 2 - 1) * spanZ;
      sizes[i] = 0.94 + hash01(i, 401) * 0.12;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setDrawRange(0, ATMOSPHERE_PARTICLE_COUNT);

    return { geometry: geo, sizeFactors: sizes };
  }, []);

  const material = useMemo(() => {
    const mat = new THREE.PointsMaterial({
      color: selectedAtmosphere?.color ?? "#4f7f5f",
      size: 0.04,
      sizeAttenuation: true,
      transparent: true,
      alphaTest: 0.01,
      opacity: ATMOSPHERE_OPACITY,
      map: spriteTexture,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("void main() {", "attribute float aSize;\nvoid main() {")
        .replace("gl_PointSize = size;", "gl_PointSize = size * aSize;");
    };
    mat.customProgramCacheKey = () => "atmosphere-plane-size-v1";
    return mat;
  }, [selectedAtmosphere?.color, spriteTexture]);

  void sizeFactors;

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      spriteTexture.dispose();
    },
    [geometry, material, spriteTexture]
  );

  return (
    <points
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={-120}
    />
  );
}
