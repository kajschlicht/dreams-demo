import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type WindEffectProps = {
  objectId: string;
  getWeight: (objectId: string) => number;
  size: number;
  offsetX: number;
  orientationXDeg: number;
  orientationYDeg: number;
  orientationZDeg: number;
  mode: number;
};

const WIND_PARTICLE_COUNT = 120;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function WindEffect({ objectId, getWeight, size, offsetX, orientationXDeg, orientationYDeg, orientationZDeg, mode }: WindEffectProps) {
  const pointsRef = useRef<THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>>(null);
  const groupRef = useRef<THREE.Group>(null);

  const { geometry, positions, phase } = useMemo(() => {
    const nextPositions = new Float32Array(WIND_PARTICLE_COUNT * 3);
    const nextPhase = new Float32Array(WIND_PARTICLE_COUNT);

    for (let i = 0; i < WIND_PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      nextPositions[i3 + 0] = -1.2 + Math.random() * 2.4;
      nextPositions[i3 + 1] = (Math.random() - 0.5) * 1.2;
      nextPositions[i3 + 2] = (Math.random() - 0.5) * 1.8;
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
    const modeFactor = 0.5 + clamp01(mode) * 1.1;
    const motionFactor = Math.max(weight, 0.2) * modeFactor;

    points.material.opacity = 0.32 * weight;
    points.material.size = 0.06 * Math.sqrt(Math.max(size, 0.1));

    group.position.set(offsetX, 0.9, 0);
    group.rotation.set(
      THREE.MathUtils.degToRad(orientationXDeg),
      THREE.MathUtils.degToRad(orientationYDeg),
      THREE.MathUtils.degToRad(orientationZDeg)
    );
    group.scale.set(
      Math.max(0.1, size) * 2.2,
      Math.max(0.1, size),
      Math.max(0.1, size) * 1.6
    );

    const windForce = 0.7 + motionFactor * 1.8;

    for (let i = 0; i < WIND_PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      positions[i3 + 0] += delta * windForce;
      positions[i3 + 1] += Math.sin(t * 1.7 + phase[i]) * delta * 0.12;
      positions[i3 + 2] += Math.cos(t * 1.4 + phase[i] * 0.8) * delta * 0.08;

      if (positions[i3 + 0] > 1.4) {
        positions[i3 + 0] = -1.4;
        positions[i3 + 1] = (Math.random() - 0.5) * 1.2;
        positions[i3 + 2] = (Math.random() - 0.5) * 1.8;
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
          color="#cbe5ff"
          size={0.06}
          transparent
          opacity={0.18}
          depthWrite={false}
          blending={THREE.NormalBlending}
          sizeAttenuation
        />
      </points>
    </group>
  );
}
