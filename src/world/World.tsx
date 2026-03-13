import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useAppStore } from "../core/store";
import { ElementRenderer } from "../elements/ElementRenderer";
import { resolveSceneShellParams } from "../story/sceneShellMapping";
import { getTheme } from "../theme";
import { ArchetypeMesh } from "./ArchetypeMesh";
import { AtmosphereLayers } from "./AtmosphereLayers";
import { ParticleCloud } from "./ParticleCloud";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const BACKDROP_VERTEX_SHADER = `
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vec4 viewPosition = viewMatrix * worldPosition;
  vViewPosition = viewPosition.xyz;
  gl_Position = projectionMatrix * viewPosition;
}
`;

const BACKDROP_FRAGMENT_SHADER = `
uniform vec3 topColor;
uniform vec3 bottomColor;
uniform vec3 cameraCenter;
uniform float shellFalloff;
uniform float shellOpacity;
uniform float fogStrength;
uniform float edgeCompression;
uniform float openness;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
void main() {
  vec3 worldDir = normalize(vWorldPosition - cameraCenter);
  float vertical = smoothstep(-0.2, 0.95, worldDir.y);
  vec3 baseColor = mix(bottomColor, topColor, vertical);

  vec3 viewDir = normalize(vViewPosition);
  float radial = clamp(length(viewDir.xy), 0.0, 1.0);
  float edge = smoothstep(0.15, 1.0, radial);
  float edgeDensity = pow(edge, 1.0 + edgeCompression * 2.3) * edgeCompression;

  float horizon = clamp(1.0 - abs(viewDir.y), 0.0, 1.0);
  float shell = pow(horizon, max(0.35, shellFalloff));
  float depthBand = mix(shell, horizon, 0.35 + fogStrength * 0.4);

  float opennessLift = mix(1.08, 0.88, clamp(openness, 0.0, 1.2));
  float alpha = shellOpacity * (depthBand * (0.55 + fogStrength * 0.45) + edgeDensity * 0.7) * opennessLift;
  alpha = clamp(alpha, 0.0, 0.95);

  vec3 color = mix(baseColor, baseColor * 0.9, edgeDensity * 0.5);
  gl_FragColor = vec4(color, alpha);
}
`;

function damp(current: number, target: number, lambda: number, delta: number): number {
  const t = 1 - Math.exp(-lambda * delta);
  return current + (target - current) * t;
}

export function World() {
  const scene = useAppStore((s) => s.scene);
  const themeName = useAppStore((s) => s.themeName);
  const sceneModeValue = useAppStore((s) => s.sceneModeValue);
  const theme = getTheme(themeName);
  const useSceneShell = themeName === "dark";
  const shellMeshRef = useRef<THREE.Mesh>(null);
  const shellMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const shellParams = useMemo(
    () => resolveSceneShellParams(sceneModeValue),
    [sceneModeValue]
  );

  const baseFogFar = clamp(
    (28 - scene.fog * 8 + scene.space * 8) * theme.fogFarMultiplier + theme.fogFarOffset,
    14,
    92
  );
  const fogNear = useSceneShell
    ? clamp(theme.fogNear * (0.9 + shellParams.fogStrength * 0.7), 2, 24)
    : theme.fogNear;
  const fogFar = useSceneShell
    ? clamp(
        baseFogFar * (0.6 + shellParams.depthOpening * 0.65) * (1 - shellParams.fogStrength * 0.2),
        fogNear + 8,
        130
      )
    : baseFogFar;

  const shellUniforms = useMemo(
    () => ({
      topColor: { value: new THREE.Color(theme.backdropTopColor) },
      bottomColor: { value: new THREE.Color(theme.backdropBottomColor) },
      cameraCenter: { value: new THREE.Vector3() },
      shellFalloff: { value: shellParams.shellFalloff },
      shellOpacity: { value: shellParams.shellOpacity },
      fogStrength: { value: shellParams.fogStrength },
      edgeCompression: { value: shellParams.edgeCompression },
      openness: { value: shellParams.openness },
    }),
    []
  );

  useEffect(() => {
    if (!useSceneShell) return;
    const material = shellMaterialRef.current;
    if (!material) return;
    material.uniforms.topColor.value.set(theme.backdropTopColor);
    material.uniforms.bottomColor.value.set(theme.backdropBottomColor);
  }, [theme.backdropBottomColor, theme.backdropTopColor, useSceneShell]);

  useFrame(({ camera }, delta) => {
    if (!useSceneShell) return;
    const shell = shellMeshRef.current;
    const material = shellMaterialRef.current;
    if (!shell || !material) return;

    shell.position.copy(camera.position);
    material.uniforms.cameraCenter.value.copy(camera.position);
    material.uniforms.shellFalloff.value = damp(
      material.uniforms.shellFalloff.value,
      shellParams.shellFalloff,
      4.5,
      delta
    );
    material.uniforms.shellOpacity.value = damp(
      material.uniforms.shellOpacity.value,
      shellParams.shellOpacity,
      4.5,
      delta
    );
    material.uniforms.fogStrength.value = damp(
      material.uniforms.fogStrength.value,
      shellParams.fogStrength,
      4.5,
      delta
    );
    material.uniforms.edgeCompression.value = damp(
      material.uniforms.edgeCompression.value,
      shellParams.edgeCompression,
      4.5,
      delta
    );
    material.uniforms.openness.value = damp(
      material.uniforms.openness.value,
      shellParams.openness,
      4.5,
      delta
    );
  });

  return (
    <>
      <color attach="background" args={[theme.sceneBackground]} />
      <fog attach="fog" args={[theme.sceneFog, fogNear, fogFar]} />

      {useSceneShell ? (
        <mesh ref={shellMeshRef} frustumCulled={false} renderOrder={-1000}>
          <sphereGeometry args={[130, 32, 24]} />
          <shaderMaterial
            ref={shellMaterialRef}
            side={THREE.BackSide}
            depthWrite={false}
            depthTest
            transparent
            uniforms={shellUniforms}
            vertexShader={BACKDROP_VERTEX_SHADER}
            fragmentShader={BACKDROP_FRAGMENT_SHADER}
          />
        </mesh>
      ) : null}

      <ambientLight intensity={theme.ambientIntensity} />
      <directionalLight
        position={[5, 8, 4]}
        intensity={theme.keyLightIntensity}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <directionalLight position={[-6, 2, -2]} intensity={theme.rimLightIntensity} />

      {theme.floorVisible ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.6, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color={theme.groundColor} roughness={1} metalness={0} />
        </mesh>
      ) : null}

      <AtmosphereLayers />
      <ArchetypeMesh />
      <ElementRenderer />
      <ParticleCloud />
    </>
  );
}
