import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type RainEffectProps = {
  objectId: string;
  getWeight: (objectId: string) => number;
  size: number;
  offsetX: number;
  orientationXDeg: number;
  orientationYDeg: number;
  orientationZDeg: number;
  mode: number;
};

const RAIN_PARTICLE_COUNT = 300;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function RainEffect({ objectId, getWeight, size, offsetX, orientationXDeg, orientationYDeg, orientationZDeg, mode }: RainEffectProps) {
  const pointsRef = useRef<THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>>(null);
  const groupRef = useRef<THREE.Group>(null);

  const { geometry, positions, phase } = useMemo(() => {
    const nextPositions = new Float32Array(RAIN_PARTICLE_COUNT * 3);
    const nextPhase = new Float32Array(RAIN_PARTICLE_COUNT);

    for (let i = 0; i < RAIN_PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      nextPositions[i3 + 0] = (Math.random() - 0.5) * 2.8;
      nextPositions[i3 + 1] = -1.5 + Math.random() * 3;
      nextPositions[i3 + 2] = (Math.random() - 0.5) * 2.8;
      nextPhase[i] = Math.random() * Math.PI * 2;
    }

    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setAttribute("position", new THREE.BufferAttribute(nextPositions, 3));

    return {
      geometry: nextGeometry,
      positions: nextPositions,
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
    const modeFactor = 0.5 + clamp01(mode) * 1.0;
    const motionFactor = Math.max(weight, 0.2) * modeFactor;

    points.material.opacity = 0.6 * weight;
    points.material.size = 0.03 * Math.sqrt(Math.max(size, 0.1));

    group.position.set(offsetX, 1.2, 0);
    group.rotation.set(
      THREE.MathUtils.degToRad(orientationXDeg),
      THREE.MathUtils.degToRad(orientationYDeg),
      THREE.MathUtils.degToRad(orientationZDeg)
    );
    group.scale.set(
      Math.max(0.1, size) * 1.8,
      Math.max(0.1, size) * 1.2,
      Math.max(0.1, size) * 1.8
    );

    const fallSpeed = 1.7 + motionFactor * 2.9;

    for (let i = 0; i < RAIN_PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      positions[i3 + 1] -= delta * fallSpeed;
      positions[i3 + 0] += Math.sin(t * 1.3 + phase[i]) * delta * 0.12;

      if (positions[i3 + 1] < -1.7) {
        positions[i3 + 1] = 1.7;
        positions[i3 + 0] = (Math.random() - 0.5) * 2.8;
        positions[i3 + 2] = (Math.random() - 0.5) * 2.8;
        phase[i] = Math.random() * Math.PI * 2;
      }
    }

    const positionAttr = points.geometry.getAttribute("position") as THREE.BufferAttribute;
    positionAttr.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      <points ref={pointsRef} geometry={geometry}>
        <pointsMaterial
          color="#8db6ff"
          size={0.03}
          transparent
          opacity={0.35}
          depthWrite={false}
          blending={THREE.NormalBlending}
          sizeAttenuation
        />
      </points>
    </group>
  );
}
