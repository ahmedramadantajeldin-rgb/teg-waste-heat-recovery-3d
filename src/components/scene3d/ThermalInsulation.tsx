import { useThermalMaterial } from './thermalShader';

interface ThermalInsulationProps {
  enabled: boolean;
  material: string;
  thickness: number; // m
  T_outer?: number;  // °C outer surface temp
  T_min?: number;    // °C scale min
  T_max?: number;    // °C scale max
  position: [number, number, number];
  size: [number, number, number];
  thermalView?: boolean;
}

const MATERIAL_COLORS: Record<string, string> = {
  glasswool: '#e8dcba',
  rockwool: '#b8a68d',
  mineral_wool: '#b8a68d',
  ceramicfiber: '#ede4d3',
  ceramic_fiber: '#ede4d3',
  calciumsilicate: '#d4d8db',
  aerogel: '#bce0fd',
  polyurethane: '#c4e0b2',
};

/**
 * Parametric Industrial Thermal Insulation Jacket with Live Outer Thermal Gradient in Heat Map Mode
 */
export function ThermalInsulation({
  enabled,
  material,
  thickness,
  T_outer = 38,
  T_min = 25,
  T_max = 150,
  position,
  size,
  thermalView = false,
}: ThermalInsulationProps) {
  const baseColor = MATERIAL_COLORS[material] ?? '#ede4d3';
  const effectiveThick = Math.min(0.024, Math.max(0.004, thickness * 0.42));

  const outerWidth = size[0] + effectiveThick * 2;
  const height = size[1] * 1.04;
  const outerLength = size[2] + effectiveThick * 2;

  const insThermalMat = useThermalMaterial(enabled && thermalView, {
    mode: 5,
    scaleMin: T_min,
    scaleMax: T_max,
    tempTop: Math.min(T_max, T_outer + 8),
    tempBot: T_outer,
    tempEdge: Math.max(T_min, T_outer - 5),
    dimX: outerWidth,
    dimY: height,
    dimZ: outerLength,
  });

  if (!enabled) return null;

  return (
    <group position={position}>
      {/* Front insulation wall (+Z) */}
      <mesh key={insThermalMat ? 'if-thm' : 'if-pbr'} position={[0, 0, size[2] / 2 + effectiveThick / 2]} material={insThermalMat ?? undefined} castShadow receiveShadow>
        <boxGeometry args={[outerWidth, height, effectiveThick]} />
        {!insThermalMat && <meshStandardMaterial color={baseColor} roughness={0.92} metalness={0.02} />}
      </mesh>

      {/* Back insulation wall (-Z) */}
      <mesh key={insThermalMat ? 'ib-thm' : 'ib-pbr'} position={[0, 0, -size[2] / 2 - effectiveThick / 2]} material={insThermalMat ?? undefined} castShadow receiveShadow>
        <boxGeometry args={[outerWidth, height, effectiveThick]} />
        {!insThermalMat && <meshStandardMaterial color={baseColor} roughness={0.92} metalness={0.02} />}
      </mesh>

      {/* Left insulation wall (-X) */}
      <mesh key={insThermalMat ? 'il-thm' : 'il-pbr'} position={[-size[0] / 2 - effectiveThick / 2, 0, 0]} material={insThermalMat ?? undefined} castShadow receiveShadow>
        <boxGeometry args={[effectiveThick, height, size[2]]} />
        {!insThermalMat && <meshStandardMaterial color={baseColor} roughness={0.92} metalness={0.02} />}
      </mesh>

      {/* Right insulation wall (+X) */}
      <mesh key={insThermalMat ? 'ir-thm' : 'ir-pbr'} position={[size[0] / 2 + effectiveThick / 2, 0, 0]} material={insThermalMat ?? undefined} castShadow receiveShadow>
        <boxGeometry args={[effectiveThick, height, size[2]]} />
        {!insThermalMat && <meshStandardMaterial color={baseColor} roughness={0.92} metalness={0.02} />}
      </mesh>

      {/* Upper perimeter collar flange */}
      <mesh key={insThermalMat ? 'it1-thm' : 'it1-pbr'} position={[0, height / 2 + 0.001, size[2] * 0.42 + effectiveThick * 0.5]} material={insThermalMat ?? undefined} castShadow>
        <boxGeometry args={[outerWidth, 0.002, size[2] * 0.16 + effectiveThick]} />
        {!insThermalMat && <meshStandardMaterial color={baseColor} roughness={0.92} metalness={0.02} />}
      </mesh>
      <mesh key={insThermalMat ? 'it2-thm' : 'it2-pbr'} position={[0, height / 2 + 0.001, -size[2] * 0.42 - effectiveThick * 0.5]} material={insThermalMat ?? undefined} castShadow>
        <boxGeometry args={[outerWidth, 0.002, size[2] * 0.16 + effectiveThick]} />
        {!insThermalMat && <meshStandardMaterial color={baseColor} roughness={0.92} metalness={0.02} />}
      </mesh>

      {/* Stainless steel retention strap clamp */}
      <mesh position={[0, 0, size[2] / 2 + effectiveThick + 0.0006]}>
        <boxGeometry args={[outerWidth + 0.002, 0.004, 0.001]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.88} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, -size[2] / 2 - effectiveThick - 0.0006]}>
        <boxGeometry args={[outerWidth + 0.002, 0.004, 0.001]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.88} roughness={0.25} />
      </mesh>
      <mesh position={[-size[0] / 2 - effectiveThick - 0.0006, 0, 0]}>
        <boxGeometry args={[0.001, 0.004, outerLength + 0.002]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.88} roughness={0.25} />
      </mesh>
      <mesh position={[size[0] / 2 + effectiveThick + 0.0006, 0, 0]}>
        <boxGeometry args={[0.001, 0.004, outerLength + 0.002]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.88} roughness={0.25} />
      </mesh>

      <mesh position={[outerWidth / 2 + 0.001, 0, size[2] / 2 + effectiveThick + 0.0012]}>
        <boxGeometry args={[0.005, 0.006, 0.0025]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.2} />
      </mesh>
    </group>
  );
}
