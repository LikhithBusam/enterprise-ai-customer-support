"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, MeshDistortMaterial } from "@react-three/drei";
import type { Mesh } from "three";

function CoreShape() {
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x += delta * 0.15;
    meshRef.current.rotation.y += delta * 0.2;
  });

  return (
    <Float speed={1.5} rotationIntensity={0.6} floatIntensity={1.2}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.6, 4]} />
        <MeshDistortMaterial
          color="#6366f1"
          distort={0.35}
          speed={2}
          roughness={0.15}
          metalness={0.6}
        />
      </mesh>
    </Float>
  );
}

export function HeroScene() {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 45 }} dpr={[1, 2]}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 3, 3]} intensity={1.2} />
      <Suspense fallback={null}>
        <CoreShape />
        <Environment preset="city" />
      </Suspense>
    </Canvas>
  );
}
