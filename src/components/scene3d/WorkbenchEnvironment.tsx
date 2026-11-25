import { Environment, Lightformer, ContactShadows } from '@react-three/drei';

interface WorkbenchEnvironmentProps {
  width?: number;
  depth?: number;
}

/**
 * 100% Offline Procedural Laboratory Testing Workbench & Studio Lighting:
 * - Zero external CDN HDRI network fetch (eliminates Suspense freezes / black fallback cubes)
 * - Procedural studio softbox Lightformers for realistic brushed copper, aluminum & steel reflections
 * - Stainless steel laboratory workbench with brushed metallic sheen
 */
export function WorkbenchEnvironment({
  width = 0.44,
  depth = 0.30,
}: WorkbenchEnvironmentProps) {
  return (
    <>
      <ambientLight intensity={0.55} color="#e2e8f0" />

      <directionalLight
        castShadow
        position={[0.8, 1.4, 0.9]}
        intensity={1.65}
        color="#ffffff"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={3.0}
        shadow-camera-near={0.1}
        shadow-camera-left={-0.38}
        shadow-camera-right={0.38}
        shadow-camera-top={0.38}
        shadow-camera-bottom={-0.38}
        shadow-bias={-0.0001}
      />

      <directionalLight position={[-0.9, 0.6, 0.5]} intensity={0.72} color="#dbeafe" />
      <directionalLight position={[0.2, 0.8, -0.9]} intensity={0.58} color="#fed7aa" />
      <pointLight position={[0, -0.2, 0]} intensity={0.22} color="#94a3b8" />

      {/* Local GPU-generated studio IBL (no external HDR network request) */}
      <Environment resolution={256} frames={1} environmentIntensity={0.62}>
        <Lightformer
          form="rect"
          intensity={2.2}
          color="#f8fafc"
          position={[0, 4, 1]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[6, 4, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.5}
          color="#bae6fd"
          position={[-4, 2, 2]}
          rotation={[0, Math.PI / 2.6, 0]}
          scale={[4, 3, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.2}
          color="#fed7aa"
          position={[4, 1.8, -2]}
          rotation={[0, -Math.PI / 2.2, 0]}
          scale={[4, 2.5, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.7}
          color="#64748b"
          position={[0, -3, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[8, 8, 1]}
        />
      </Environment>

      {/* ── Stainless Steel Laboratory Workbench Tabletop (top strictly at y = 0) ── */}
      <group position={[0, -0.010, 0]}>
        <mesh receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={[width, 0.020, depth]} />
          <meshStandardMaterial
            color="#b0bcc7"
            metalness={0.82}
            roughness={0.24}
            envMapIntensity={1.3}
          />
        </mesh>

        {/* Brushed beveled front edge trim */}
        <mesh position={[0, 0.008, depth / 2 + 0.001]}>
          <boxGeometry args={[width + 0.002, 0.004, 0.002]} />
          <meshStandardMaterial color="#8895a2" metalness={0.90} roughness={0.18} />
        </mesh>

        {/* Workbench rear equipment riser rail */}
        <mesh position={[0, 0.024, -depth / 2 + 0.012]} castShadow receiveShadow>
          <boxGeometry args={[width - 0.02, 0.028, 0.020]} />
          <meshStandardMaterial color="#475569" metalness={0.65} roughness={0.35} />
        </mesh>
      </group>

      <ContactShadows
        position={[0, 0.0004, 0]}
        opacity={0.62}
        scale={Math.max(0.36, width)}
        blur={1.6}
        far={0.25}
        color="#0a121e"
      />
    </>
  );
}
