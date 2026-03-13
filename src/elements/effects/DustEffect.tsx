import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type DustEffectProps = {
  objectId: string;
  getWeight: (objectId: string) => number;
  size: number;
  offsetX: number;
  orientationXDeg: number;
  orientationYDeg: number;
  orientationZDeg: number;
  mode: number;
};

const DUST_PARTICLE_COUNT = 200;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function DustEffect({ objectId, getWeight, size, offsetX, orientationXDeg, orientationYDeg, orientationZDeg, mode }: DustEffectProps) {
  const pointsRef = useRef<THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>>(null);
  const groupRef = useRef<THREE.Group>(null);

  const { geometry, positions, phase } = useMemo(() => {
    const nextPositions = new Float32Array(DUST_PARTICLE_COUNT * 3);
    const nextPhase = new Float32Array(DUST_PARTICLE_COUNT);

    for (let i = 0; i < DUST_PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      nextPositions[i3 + 0] = (Math.random() - 0.5) * 2.2;
      nextPositions[i3 + 1] = (Math.random() - 0.5) * 1.4;
      nextPositions[i3 + 2] = (Math.random() - 0.5) * 2.2;
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
    const modeFactor = 0.55 + clamp01(mode) * 0.8;
    const motionFactor = Math.max(weight, 0.2) * modeFactor;

    points.material.opacity = 0.32 * weight;
    points.material.size = 0.04 * Math.sqrt(Math.max(size, 0.1));

    group.position.set(offsetX, 0.9, 0);
    group.rotation.set(
      THREE.MathUtils.degToRad(orientationXDeg),
      THREE.MathUtils.degToRad(orientationYDeg),
      THREE.MathUtils.degToRad(orientationZDeg)
    );
    group.scale.setScalar(Math.max(0.1, size));

    for (let i = 0; i < DUST_PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      positions[i3 + 0] += Math.sin(t * 0.55 + phase[i]) * delta * (0.05 + motionFactor * 0.05);
      positions[i3 + 1] +=
        Math.cos(t * 0.45 + phase[i] * 1.1) * delta * (0.03 + motionFactor * 0.04);
      positions[i3 + 2] +=
        Math.sin(t * 0.5 + phase[i] * 0.8) * delta * (0.05 + motionFactor * 0.05);

      if (positions[i3 + 0] > 1.2) positions[i3 + 0] = -1.2;
      if (positions[i3 + 0] < -1.2) positions[i3 + 0] = 1.2;
      if (positions[i3 + 1] > 0.9) positions[i3 + 1] = -0.9;
      if (positions[i3 + 1] < -0.9) positions[i3 + 1] = 0.9;
      if (positions[i3 + 2] > 1.2) positions[i3 + 2] = -1.2;
      if (positions[i3 + 2] < -1.2) positions[i3 + 2] = 1.2;
    }

    const positionAttr = points.geometry.getAttribute("position") as THREE.BufferAttribute;
    positionAttr.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      <points ref={pointsRef} geometry={geometry}>
        <pointsMaterial
          color="#d7cdb8"
          size={0.04}
          transparent
          opacity={0.16}
          depthWrite={false}
          blending={THREE.NormalBlending}
          sizeAttenuation
        />
      </points>
    </group>
  );
}
