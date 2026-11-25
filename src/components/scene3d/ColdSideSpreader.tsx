import { useMemo } from 'react';
import { useThermalMaterial } from './thermalShader';
import { getBrushedMetalTextures } from './pbrTextures';

interface ColdSideSpreaderProps {
  T: number;               // °C TEG cold-side interface temperature
  T_hs_base?: number;      // °C heat sink base interface temperature
  T_min?: number;          // °C scale min (T_ambient)
  T_max?: number;          // °C scale max (T_source)
  coreRadius?: number;     // TEG footprint radius (m)
  width: number;           // m
  length: number;          // m
  thickness: number;       // m
  position?: [number, number, number];
  thermalView?: boolean;
  labelsVisible?: boolean;
}

/**
 * Realistic Cold-Side Aluminum Heat Spreader Plate with GLSL FEA Radial Thermal Spreading Gradient
 */
export function ColdSideSpreader({
  T,
  T_hs_base,
  T_min = 25,
  T_max = 150,
  coreRadius,
  width,
  length,
  thickness,
  position = [0, 0, 0],
  thermalView = false,
}: ColdSideSpreaderProps) {
  const botTemp = T_hs_base ?? Math.max(T_min, T - 2);
  const brushed = useMemo(() => getBrushedMetalTextures(), []);
  const thermalMat = useThermalMaterial(thermalView, {
    mode: 1,
    scaleMin: T_min,
    scaleMax: T_max,
    tempTop: T,
    tempBot: botTemp,
    tempEdge: Math.max(T_min, botTemp - (botTemp - T_min) * 0.35),
    dimX: width,
    dimY: thickness,
    dimZ: length,
    coreRadius: coreRadius ?? width * 0.36,
  });

  return (
    <group position={position}>
      {/* Brushed Aluminum Spreader Plate */}
      <mesh key={thermalMat ? 'thm' : 'pbr'} material={thermalMat ?? undefined} castShadow receiveShadow>
        <boxGeometry args={[width, thickness, length]} />
        {!thermalMat && (
          <meshStandardMaterial
            color="#94a3b8"
            metalness={0.88}
            roughness={0.26}
            bumpMap={brushed.bumpMap}
            bumpScale={0.00022}
            roughnessMap={brushed.roughnessMap}
            envMapIntensity={1.38}
          />
        )}
      </mesh>

      {/* Flush cold thermocouple sensor port */}
      <mesh position={[-width / 2 - 0.001, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0012, 0.0012, 0.003, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* 4 Corner Counterbored Clamping Bolts */}
      {[-width * 0.44, width * 0.44].map((x, xi) =>
        [-length * 0.44, length * 0.44].map((z, zi) => (
          <mesh key={`${xi}-${zi}`} position={[x, thickness / 2 + 0.0004, z]} castShadow>
            <cylinderGeometry args={[0.0018, 0.0018, 0.001, 12]} />
            <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.2} />
          </mesh>
        ))
      )}
    </group>
  );
}
