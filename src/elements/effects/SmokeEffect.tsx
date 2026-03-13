import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type SmokeEffectProps = {
  objectId: string;
  getWeight: (objectId: string) => number;
  size: number;
  offsetX: number;
  orientationXDeg: number;
  orientationYDeg: number;
  orientationZDeg: number;
  mode: number;
};

const SMOKE_PARTICLE_COUNT = 200;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function SmokeEffect({ objectId, getWeight, size, offsetX, orientationXDeg, orientationYDeg, orientationZDeg, mode }: SmokeEffectProps) {
  const pointsRef = useRef<THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>>(null);
  const groupRef = useRef<THREE.Group>(null);

  const { geometry, positions, baseY, phase } = useMemo(() => {
    const nextPositions = new Float32Array(SMOKE_PARTICLE_COUNT * 3);
    const nextBaseY = new Float32Array(SMOKE_PARTICLE_COUNT);
    const nextPhase = new Float32Array(SMOKE_PARTICLE_COUNT);

    for (let i = 0; i < SMOKE_PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      nextPositions[i3 + 0] = (Math.random() - 0.5) * 1.8;
      nextPositions[i3 + 1] = -0.8 + Math.random() * 1.8;
      nextPositions[i3 + 2] = (Math.random() - 0.5) * 1.8;
      nextBaseY[i] = nextPositions[i3 + 1];
      nextPhase[i] = Math.random() * Math.PI * 2;
    }

    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setAttribute("position", new THREE.BufferAttribute(nextPositions, 3));

    return {
      geometry: nextGeometry,
      positions: nextPositions,
      baseY: nextBaseY,
      phase: nextPhase,
    };
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useFrame(({ clock }, delta) => {
    const points = pointsRef.current;
    const group = groupRef.current;
    if (!points || !group) return;

    const weight = clamp01(getWeight(objectId));
    group.visible = weight > 0.001;
    if (!group.visible) return;

    const t = clock.getElapsedTime();
    const modeFactor = 0.55 + clamp01(mode) * 0.9;
    const motionFactor = Math.max(weight, 0.2) * modeFactor;

    points.material.opacity = 0.5 * weight;
    points.material.size = 0.12 * Math.sqrt(Math.max(size, 0.1));

    group.position.set(offsetX, 0.8, 0);
    group.rotation.set(
      THREE.MathUtils.degToRad(orientationXDeg),
      THREE.MathUtils.degToRad(orientationYDeg),
      THREE.MathUtils.degToRad(orientationZDeg)
    );
    group.scale.setScalar(Math.max(0.1, size));

    for (let i = 0; i < SMOKE_PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      const drift = 0.16 + motionFactor * 0.42;
      positions[i3 + 1] += delta * drift;
      positions[i3 + 0] += Math.sin(t * 0.8 + phase[i]) * delta * (0.08 + motionFactor * 0.12);
      positions[i3 + 2] +=
        Math.cos(t * 0.7 + phase[i] * 0.9) * delta * (0.07 + motionFactor * 0.1);

      if (positions[i3 + 1] > 1.6) {
        positions[i3 + 1] = -0.9;
        positions[i3 + 0] = (Math.random() - 0.5) * 1.8;
        positions[i3 + 2] = (Math.random() - 0.5) * 1.8;
        baseY[i] = positions[i3 + 1];
        phase[i] = Math.random() * Math.PI * 2;
      }

      const settle = Math.max(-1, baseY[i]);
      if (positions[i3 + 1] < settle) {
        positions[i3 + 1] = settle;
      }
    }

    const positionAttr = points.geometry.getAttribute("position") as THREE.BufferAttribute;
    positionAttr.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      <points ref={pointsRef} geometry={geometry}>
        <pointsMaterial
          color="#bfc5d2"
          size={0.12}
          transparent
          opacity={0.25}
          depthWrite={false}
          blending={THREE.NormalBlending}
          sizeAttenuation
        />
      </points>
    </group>
  );
}
