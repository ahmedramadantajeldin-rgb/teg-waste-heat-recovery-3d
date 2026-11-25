import { useMemo } from 'react';
import * as THREE from 'three';
import { PBR_PRESETS } from './colorUtils';
import { useThermalMaterial } from './thermalShader';

interface HeatSink3DProps {
  N: number;              // number of fins
  H: number;              // fin height (m) (Y direction)
  L: number;              // fin length (m) (airflow X direction)
  t: number;              // fin thickness (m)
  S: number;              // fin spacing (m)
  W_base: number;         // base plate width (m) (Z direction across fins)
  L_base: number;         // base plate length (m) (X direction)
  t_base: number;         // base plate thickness (m)
  mountThickness?: number;// bottom workbench mounting flange thickness (m)
  mountWidthX?: number;   // bottom mounting flange X span (m)
  mountWidthZ?: number;   // bottom mounting flange Z span (m)
  coldFootprintR?: number;// cold spreader half-width for thermal plume radius (m)
  material: string;       // 'aluminum' | 'copper' | 'steel'
  viewMode: 'thermal' | 'material';
  T_base: number;         // top deck base temperature °C
  T_tip: number;          // fin tip / bottom deck temperature °C
  T_inf: number;          // ambient temperature °C
  T_maxScale?: number;    // global scale max (°C, T_source)
  finM?: number;          // Paper Eq.(22) fin decay parameter m (1/m)
  airflowWarming?: number;// axial warming bias along airflow (°C)
  finType: 'plate' | 'pin';
  position?: [number, number, number];
}

/**
 * Realistic Extruded Metal Heat Sink with Per-Pixel FEA Heat Map Mode:
 * - In Thermal mode: renders Paper Eq.(21) hyperbolic fin cooling cosh(m*(H-dist))/cosh(m*H),
 *   concentric top-deck spreading under the cold plate, and axial -X -> +X airflow gradient
 */
export function HeatSink3D({
  N,
  H,
  L,
  t,
  S,
  W_base,
  L_base,
  t_base,
  mountThickness = 0.005,
  mountWidthX,
  mountWidthZ,
  coldFootprintR,
  material,
  viewMode,
  T_base,
  T_tip,
  T_inf,
  T_maxScale = 150,
  finM = 14,
  airflowWarming = 3.5,
  finType,
  position = [0, 0, 0],
}: HeatSink3DProps) {
  const preset = PBR_PRESETS[material] ?? PBR_PRESETS.aluminum;
  const isThermal = viewMode === 'thermal';

  const finLengthX = L > 0 ? L : L_base;
  const baseSpanZ = W_base;
  const flangeX = mountWidthX ?? finLengthX + 0.022;
  const flangeZ = mountWidthZ ?? baseSpanZ + 0.022;
  const coreRadius = coldFootprintR ?? Math.min(finLengthX, baseSpanZ) * 0.36;

  // Radial spreading edge temp on top deck
  const T_top_edge = Math.max(T_inf, T_base - (T_base - T_inf) * 0.32);

  // Physics bottom-of-fin temperature via Paper Eq.(21)
  const coshML = Math.cosh(Math.min(6, Math.max(0.05, finM * H)));
  const T_fin_bottom = T_inf + (T_base - T_inf) / coshML;
  const T_bot_eff = Math.min(T_fin_bottom, T_tip);

  const topDeckThermalMat = useThermalMaterial(isThermal, {
    mode: 4,
    scaleMin: T_inf,
    scaleMax: T_maxScale,
    tempTop: T_base,
    tempBot: T_base,
    tempEdge: T_top_edge,
    dimX: finLengthX,
    dimY: t_base,
    dimZ: baseSpanZ,
    coreRadius,
    airflowWarming: airflowWarming * 0.6,
  });

  const finThermalMat = useThermalMaterial(isThermal, {
    mode: 3,
    scaleMin: T_inf,
    scaleMax: T_maxScale,
    tempTop: T_base,
    tempBot: T_bot_eff,
    tempEdge: T_top_edge,
    dimX: finLengthX,
    dimY: H,
    dimZ: baseSpanZ,
    coreRadius,
    finM,
    finH: H,
    airflowWarming,
  });

  const lowerDeckThermalMat = useThermalMaterial(isThermal, {
    mode: 4,
    scaleMin: T_inf,
    scaleMax: T_maxScale,
    tempTop: T_bot_eff,
    tempBot: T_bot_eff,
    tempEdge: Math.max(T_inf, T_inf + (T_bot_eff - T_inf) * 0.45),
    dimX: flangeX,
    dimY: t_base + mountThickness,
    dimZ: flangeZ,
    coreRadius,
    airflowWarming: airflowWarming * 0.5,
  });

  const plateFins = useMemo(() => {
    if (finType !== 'plate') return null;
    const clampedN = Math.max(2, Math.min(30, N));
    const effectiveThickness = Math.max(0.0005, t);
    const effectiveSpacing = Math.max(0.001, S);

    const totalSpan = clampedN * effectiveThickness + (clampedN - 1) * effectiveSpacing;
    const startZ = -totalSpan / 2 + effectiveThickness / 2;

    const fins: { z: number; thickness: number }[] = [];
    for (let i = 0; i < clampedN; i++) {
      const z = startZ + i * (effectiveThickness + effectiveSpacing);
      fins.push({ z, thickness: effectiveThickness });
    }
    return fins;
  }, [N, t, S, finType]);

  const pinFins = useMemo(() => {
    if (finType !== 'pin') return null;
    const countPerSide = Math.max(3, Math.min(8, Math.round(Math.sqrt(N * 2.5))));
    const pins: { x: number; z: number }[] = [];
    const spanX = finLengthX * 0.84;
    const spanZ = baseSpanZ * 0.84;
    for (let ix = 0; ix < countPerSide; ix++) {
      for (let iz = 0; iz < countPerSide; iz++) {
        const x = THREE.MathUtils.lerp(-spanX / 2, spanX / 2, ix / (countPerSide - 1));
        const z = THREE.MathUtils.lerp(-spanZ / 2, spanZ / 2, iz / (countPerSide - 1));
        pins.push({ x, z });
      }
    }
    return pins;
  }, [N, finType, finLengthX, baseSpanZ]);

  const boltMarginX = (flangeX - finLengthX) * 0.25;
  const boltMarginZ = (flangeZ - baseSpanZ) * 0.25;

  const mountBolts: [number, number][] = [
    [-finLengthX / 2 - boltMarginX, -baseSpanZ / 2 - boltMarginZ],
    [finLengthX / 2 + boltMarginX, -baseSpanZ / 2 - boltMarginZ],
    [-finLengthX / 2 - boltMarginX, baseSpanZ / 2 + boltMarginZ],
    [finLengthX / 2 + boltMarginX, baseSpanZ / 2 + boltMarginZ],
  ];

  const pinRadius = Math.max(0.0010, Math.min(t * 0.65, 0.0038));

  return (
    <group position={position}>
      {/* ── 1. Bottom Apparatus Mounting Flange (Flush on Workbench y = 0) ── */}
      <mesh
        key={lowerDeckThermalMat ? 'flange-thm' : 'flange-pbr'}
        position={[0, mountThickness / 2, 0]}
        material={lowerDeckThermalMat ?? undefined}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[flangeX, mountThickness, flangeZ]} />
        {!lowerDeckThermalMat && (
          <meshStandardMaterial color="#94a0ad" metalness={0.86} roughness={0.30} />
        )}
      </mesh>

      {/* 4 Laboratory Bench Clamp Bolts */}
      {mountBolts.map(([bx, bz], idx) => (
        <group key={idx} position={[bx, mountThickness, bz]}>
          <mesh position={[0, 0.0006, 0]}>
            <cylinderGeometry args={[0.0038, 0.0038, 0.0012, 16]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.0032, 0]} castShadow>
            <cylinderGeometry args={[0.0028, 0.0028, 0.0042, 6]} />
            <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.25} />
          </mesh>
        </group>
      ))}

      {/* ── 2. Heat Sink Lower Base Deck ── */}
      <mesh
        key={lowerDeckThermalMat ? 'botdeck-thm' : 'botdeck-pbr'}
        position={[0, mountThickness + t_base / 2, 0]}
        material={lowerDeckThermalMat ?? undefined}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[finLengthX, t_base, baseSpanZ]} />
        {!lowerDeckThermalMat && (
          <meshStandardMaterial
            color={preset.color}
            metalness={preset.metalness}
            roughness={preset.roughness}
            envMapIntensity={1.3}
          />
        )}
      </mesh>

      {/* ── 3. Vertical Fins Array (Paper Eq.21 Thermal Profile in Heat Map mode) ── */}
      {finType === 'plate' && plateFins && (
        <group position={[0, mountThickness + t_base + H / 2, 0]}>
          {plateFins.map(({ z, thickness }, i) => (
            <mesh
              key={`plate-${i}-${finThermalMat ? 'thm' : 'pbr'}`}
              position={[0, 0, z]}
              material={finThermalMat ?? undefined}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[finLengthX, H, thickness]} />
              {!finThermalMat && (
                <meshStandardMaterial
                  color={preset.color}
                  metalness={preset.metalness}
                  roughness={preset.roughness}
                  envMapIntensity={1.2}
                />
              )}
            </mesh>
          ))}
        </group>
      )}

      {finType === 'pin' && pinFins && (
        <group position={[0, mountThickness + t_base + H / 2, 0]}>
          {pinFins.map(({ x, z }, i) => (
            <mesh
              key={`pin-${i}-${finThermalMat ? 'thm' : 'pbr'}`}
              position={[x, 0, z]}
              material={finThermalMat ?? undefined}
              castShadow
              receiveShadow
            >
              <cylinderGeometry args={[pinRadius, pinRadius, H, 14]} />
              {!finThermalMat && (
                <meshStandardMaterial
                  color={preset.color}
                  metalness={preset.metalness}
                  roughness={preset.roughness}
                />
              )}
            </mesh>
          ))}
        </group>
      )}

      {/* ── 4. Solid Top Cold Deck of the Heat Sink ── */}
      <mesh
        key={topDeckThermalMat ? 'topdeck-thm' : 'topdeck-pbr'}
        position={[0, mountThickness + t_base + H + t_base / 2, 0]}
        material={topDeckThermalMat ?? undefined}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[finLengthX, t_base, baseSpanZ]} />
        {!topDeckThermalMat && (
          <meshStandardMaterial
            color={preset.color}
            metalness={preset.metalness}
            roughness={preset.roughness}
            envMapIntensity={1.3}
          />
        )}
      </mesh>
    </group>
  );
}
