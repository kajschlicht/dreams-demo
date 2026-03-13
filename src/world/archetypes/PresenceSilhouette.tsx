import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type Props = {
  intensity: number; // 0..1
};

export function PresenceSilhouette({ intensity }: Props) {
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#888888"),
      transparent: true,
      opacity: 0.62,
      roughness: 1,
      metalness: 0,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: 0.2,
    });
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    material.opacity = 0.25 + intensity * 0.6 + Math.sin(t * 0.6) * 0.01;
    material.emissiveIntensity = 0.05 + intensity * 0.35;
  });
const z = 0.6 - intensity * 0.6;
 return (
    <group position={[0, -0.35, z]}>
      <mesh material={material}>
        <capsuleGeometry args={[0.22, 0.55, 8, 16]} />
      </mesh>
    </group>
  );
}