import { useMemo } from 'react';
import { Environment, Lightformer, ContactShadows } from '@react-three/drei';
import { getMetroBenchTextures, getBrushedMetalTextures } from './pbrTextures';

interface WorkbenchEnvironmentProps {
  width?: number;
  depth?: number;
}

/**
 * 100% Offline High-Detail Studio Lighting & Metrology Laboratory Workbench:
 * - Zero external CDN HDRI fetches
 * - High-res (512) procedural Lightformer softboxes + rim strips for crisp metallic reflections
 * - Optical metrology stainless steel benchtop with laser-etched M6 coordinate grid & vibration isolation feet
 */
export function WorkbenchEnvironment({
  width = 0.44,
  depth = 0.30,
}: WorkbenchEnvironmentProps) {
  const benchTex = useMemo(() => getMetroBenchTextures(), []);
  const brushedMetal = useMemo(() => getBrushedMetalTextures(), []);

  return (
    <>
      <ambientLight intensity={0.64} color="#edf2f7" />

      {/* Main Key Light with tight 2048px soft shadow frustum */}
      <directionalLight
        castShadow
        position={[0.72, 1.35, 0.85]}
        intensity={1.95}
        color="#ffffff"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={2.8}
        shadow-camera-near={0.1}
        shadow-camera-left={-0.28}
        shadow-camera-right={0.28}
        shadow-camera-top={0.28}
        shadow-camera-bottom={-0.28}
        shadow-bias={-0.00008}
        shadow-normalBias={0.0015}
      />

      {/* Cool azure studio fill + warm rear rim key for sharp mechanical bevel highlights */}
      <directionalLight position={[-0.85, 0.58, 0.55]} intensity={0.90} color="#dbeafe" />
      <directionalLight position={[0.25, 0.72, -0.85]} intensity={0.74} color="#fed7aa" />
      <pointLight position={[0, -0.18, 0]} intensity={0.28} color="#cbd5e1" />

      {/* Local GPU-generated high-res Studio IBL softboxes & specular strips */}
      <Environment resolution={512} frames={1} environmentIntensity={0.96}>
        {/* Primary overhead diffused studio dome */}
        <Lightformer
          form="ring"
          intensity={2.4}
          color="#f8fafc"
          position={[0, 4.5, 0.5]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[5, 5, 1]}
        />
        {/* Crisp top-front specular highlight strip */}
        <Lightformer
          form="rect"
          intensity={3.0}
          color="#ffffff"
          position={[1.5, 3.2, 3.0]}
          rotation={[Math.PI / 3, 0, 0]}
          scale={[5, 0.9, 1]}
        />
        {/* Left cool-cyan airflow fill strip */}
        <Lightformer
          form="rect"
          intensity={1.7}
          color="#bae6fd"
          position={[-4.2, 2.0, 1.8]}
          rotation={[0, Math.PI / 2.4, 0]}
          scale={[4.5, 2.5, 1]}
        />
        {/* Right warm-amber copper/brass accent strip */}
        <Lightformer
          form="rect"
          intensity={1.45}
          color="#fed7aa"
          position={[4.2, 1.8, -1.6]}
          rotation={[0, -Math.PI / 2.2, 0]}
          scale={[4.2, 2.2, 1]}
        />
        {/* Rear rim backlight for blades & heatsink silhouette */}
        <Lightformer
          form="rect"
          intensity={1.8}
          color="#e0f2fe"
          position={[-0.5, 2.4, -4.5]}
          rotation={[0, 0, 0]}
          scale={[6, 1.4, 1]}
        />
        {/* Workbench under-bounce */}
        <Lightformer
          form="rect"
          intensity={0.75}
          color="#64748b"
          position={[0, -3, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[9, 9, 1]}
        />
      </Environment>

      {/* ── Precision Laser-Etched Optical Metrology Workbench (top strictly at y = 0) ── */}
      <group position={[0, -0.010, 0]}>
        <mesh receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={[width, 0.020, depth]} />
          <meshStandardMaterial
            map={benchTex.map}
            bumpMap={benchTex.bumpMap}
            bumpScale={0.00025}
            roughnessMap={benchTex.roughnessMap}
            metalness={0.76}
            roughness={0.32}
            envMapIntensity={1.35}
          />
        </mesh>

        {/* Front & side dark-anodized perimeter trim rails */}
        <mesh position={[0, 0.0075, depth / 2 + 0.0012]} receiveShadow>
          <boxGeometry args={[width + 0.004, 0.005, 0.0024]} />
          <meshStandardMaterial
            color="#334155"
            metalness={0.86}
            roughness={0.26}
            bumpMap={brushedMetal.bumpMap}
            bumpScale={0.0002}
          />
        </mesh>
        {[-width / 2 - 0.0012, width / 2 + 0.0012].map((xRail, idx) => (
          <mesh key={idx} position={[xRail, 0.0075, 0]} receiveShadow>
            <boxGeometry args={[0.0024, 0.005, depth]} />
            <meshStandardMaterial color="#334155" metalness={0.86} roughness={0.26} />
          </mesh>
        ))}

        {/* Rear anodized instrumentation riser rail + stainless clamp cap screws */}
        <mesh position={[0, 0.024, -depth / 2 + 0.012]} castShadow receiveShadow>
          <boxGeometry args={[width - 0.02, 0.028, 0.020]} />
          <meshStandardMaterial
            color="#3b4656"
            metalness={0.74}
            roughness={0.30}
            bumpMap={brushedMetal.bumpMap}
            bumpScale={0.00025}
          />
        </mesh>
        {[-width * 0.36, -width * 0.12, width * 0.12, width * 0.36].map((rx, i) => (
          <mesh key={i} position={[rx, 0.0385, -depth / 2 + 0.012]} castShadow>
            <cylinderGeometry args={[0.0024, 0.0024, 0.0016, 12]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.18} />
          </mesh>
        ))}

        {/* 4 Corner Vibration-Isolation Feet below bench slab */}
        {[-width * 0.43, width * 0.43].map((fx, xi) =>
          [-depth * 0.40, depth * 0.40].map((fz, zi) => (
            <mesh key={`${xi}-${zi}`} position={[fx, -0.0125, fz]}>
              <cylinderGeometry args={[0.010, 0.012, 0.005, 16]} />
              <meshStandardMaterial color="#1e293b" metalness={0.4} roughness={0.65} />
            </mesh>
          )),
        )}
      </group>

      <ContactShadows
        position={[0, 0.0004, 0]}
        opacity={0.66}
        scale={Math.max(0.36, width)}
        blur={1.8}
        far={0.25}
        color="#060c16"
      />
    </>
  );
}
