import { Environment, ContactShadows } from '@react-three/drei';

interface WorkbenchEnvironmentProps {
  width?: number;
  depth?: number;
}

/**
 * Realistic Parametric Laboratory Testing Workbench & Studio Lighting:
 * - Stainless steel laboratory workbench with brushed metallic sheen
 * - Expands automatically so even enlarged fin/fan configurations sit solidly on benchtop
 */
export function WorkbenchEnvironment({
  width = 0.44,
  depth = 0.30,
}: WorkbenchEnvironmentProps) {
  return (
    <>
      <ambientLight intensity={0.48} color="#e2e8f0" />

      <directionalLight
        castShadow
        position={[0.8, 1.4, 0.9]}
        intensity={1.6}
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

      <directionalLight position={[-0.9, 0.6, 0.5]} intensity={0.68} color="#dbeafe" />
      <directionalLight position={[0.2, 0.8, -0.9]} intensity={0.55} color="#fed7aa" />
      <pointLight position={[0, -0.2, 0]} intensity={0.2} color="#94a3b8" />

      <Environment preset="warehouse" environmentIntensity={0.6} />

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
