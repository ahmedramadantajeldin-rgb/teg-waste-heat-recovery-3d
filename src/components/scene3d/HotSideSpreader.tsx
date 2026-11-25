import { useThermalMaterial } from './thermalShader';

interface HotSideSpreaderProps {
  T: number;               // °C hot-side interface temperature
  T_top?: number;          // °C top face temperature
  T_min?: number;          // °C scale min (T_ambient)
  T_max?: number;          // °C scale max (T_source)
  coreRadius?: number;     // heater footprint radius (m)
  width: number;           // m
  length: number;          // m
  thickness: number;       // m
  position?: [number, number, number];
  thermalView?: boolean;
}

/**
 * Realistic Hot-Side Copper Heat Spreader Plate with GLSL FEA Radial Thermal Plume
 */
export function HotSideSpreader({
  T,
  T_top,
  T_min = 25,
  T_max = 150,
  coreRadius,
  width,
  length,
  thickness,
  position = [0, 0, 0],
  thermalView = false,
}: HotSideSpreaderProps) {
  const topTemp = T_top ?? T + 2.5;
  const thermalMat = useThermalMaterial(thermalView, {
    mode: 1,
    scaleMin: T_min,
    scaleMax: T_max,
    tempTop: topTemp,
    tempBot: T,
    tempEdge: Math.max(T_min, T - (topTemp - T_min) * 0.09),
    dimX: width,
    dimY: thickness,
    dimZ: length,
    coreRadius: coreRadius ?? width * 0.38,
  });

  return (
    <group position={position}>
      {/* Copper spreader plate */}
      <mesh key={thermalMat ? 'thm' : 'pbr'} material={thermalMat ?? undefined} castShadow receiveShadow>
        <boxGeometry args={[width, thickness, length]} />
        {!thermalMat && (
          <meshStandardMaterial
            color="#c87a3e"
            metalness={0.94}
            roughness={0.22}
            envMapIntensity={1.4}
          />
        )}
      </mesh>

      {/* Flush thermocouple sensor port */}
      <mesh position={[width / 2 + 0.001, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0012, 0.0012, 0.003, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* 4 Corner Socket-Head Clamping Screws on outer shelf */}
      {[-width * 0.445, width * 0.445].map((x, xi) =>
        [-length * 0.445, length * 0.445].map((z, zi) => (
          <mesh key={`${xi}-${zi}`} position={[x, thickness / 2 + 0.0006, z]} castShadow>
            <cylinderGeometry args={[0.0016, 0.0016, 0.0014, 12]} />
            <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.2} />
          </mesh>
        ))
      )}
    </group>
  );
}
