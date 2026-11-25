import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getBrushedMetalTextures } from './pbrTextures';

interface FanComponentProps {
  enabled: boolean;
  V_air: number;         // m/s — controls spin speed
  position?: [number, number, number];
  size?: number;         // fan outer width/height (m)
  depth?: number;        // fan thickness along X (m)
  mountHeight?: number;  // height of fan center above workbench (y = 0)
}

const BLADE_COUNT = 7;

/**
 * Create a rounded-square extruded fan housing with an OPEN circular venturi bore
 * so blades, nose dome, and rear stator struts are 100% visible through the tunnel.
 */
function createHollowHousingGeometry(size: number, depth: number, boreRadius: number): THREE.ExtrudeGeometry {
  const half = size / 2;
  const rCorner = size * 0.12;

  const outer = new THREE.Shape();
  outer.moveTo(-half + rCorner, -half);
  outer.lineTo(half - rCorner, -half);
  outer.quadraticCurveTo(half, -half, half, -half + rCorner);
  outer.lineTo(half, half - rCorner);
  outer.quadraticCurveTo(half, half, half - rCorner, half);
  outer.lineTo(-half + rCorner, half);
  outer.quadraticCurveTo(-half, half, -half, half - rCorner);
  outer.lineTo(-half, -half + rCorner);
  outer.quadraticCurveTo(-half, -half, -half + rCorner, -half);

  // Clockwise circular cutout for the open airflow tunnel
  const hole = new THREE.Path();
  hole.absarc(0, 0, boreRadius, 0, Math.PI * 2, true);
  outer.holes.push(hole);

  const bevel = 0.001;
  const extrudeDepth = Math.max(0.004, depth - bevel * 2);

  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: extrudeDepth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 36,
  });
  // Center extrusion along Z before rotating Z -> +X
  geo.translate(0, 0, -extrudeDepth / 2);
  return geo;
}

/**
 * Create a swept scimitar-shaped axial fan blade profile in local (chord X, radial Y)
 * extruded along Z (blade thickness), ready to be pitched inside each radial blade group.
 */
function createAirfoilBladeGeometry(
  rStart: number,
  rEnd: number,
  chordRoot: number,
  chordTip: number,
  thickness: number,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const rMid1 = THREE.MathUtils.lerp(rStart, rEnd, 0.35);
  const rMid2 = THREE.MathUtils.lerp(rStart, rEnd, 0.78);

  // Swept forward-edge and curved trailing-edge scimitar silhouette
  shape.moveTo(-chordRoot * 0.45, rStart);
  shape.bezierCurveTo(
    -chordRoot * 0.55, rMid1,
    -chordTip * 0.35, rMid2,
    -chordTip * 0.15, rEnd,
  );
  // Rounded aerodynamic blade tip
  shape.quadraticCurveTo(chordTip * 0.38, rEnd + 0.0015, chordTip * 0.62, rEnd * 0.96);
  // Swept trailing edge back to root
  shape.bezierCurveTo(
    chordTip * 0.68, rMid2,
    chordRoot * 0.52, rMid1,
    chordRoot * 0.45, rStart,
  );
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.00035,
    bevelSize: 0.00035,
    bevelSegments: 2,
    curveSegments: 16,
  });
  geo.translate(0, 0, -thickness / 2);
  return geo;
}

/**
 * Realistic Industrial Axial Cooling Fan:
 * - Truly hollow rounded-square frame housing with open cylindrical venturi bore
 * - Central motor hub + brushed metallic nose dome
 * - 7 clearly visible sculpted scimitar blades pitched for axial +X flow into fins
 * - 3 rear aerodynamic stator struts + motor can
 * - Fine stainless protective intake finger guard (does not obscure blades)
 * - Parametric machined aluminum L-bracket bench stand flush at world y = 0
 */
export function FanComponent({
  enabled,
  V_air,
  position = [0, 0, 0],
  size = 0.058,
  depth = 0.020,
  mountHeight,
}: FanComponentProps) {
  const rotorRef = useRef<THREE.Group>(null);

  // Anti-aliased rotation speed scaled smoothly & visibly across 0.5..15 m/s
  const rotationSpeed = useMemo(() => {
    if (!enabled || V_air <= 0) return 0;
    return Math.min(26.0, 2.2 + V_air * 1.65);
  }, [enabled, V_air]);

  useFrame((_state, delta) => {
    if (rotorRef.current && enabled && rotationSpeed > 0) {
      rotorRef.current.rotation.x += rotationSpeed * delta;
    }
  });

  const boreRadius = size * 0.435;
  const hubRadius = size * 0.145;
  const effectiveMountH = mountHeight ?? position[1] ?? size / 2 + 0.008;
  const metalMaps = useMemo(() => getBrushedMetalTextures(), []);

  const housingGeo = useMemo(
    () => createHollowHousingGeometry(size, depth, boreRadius),
    [size, depth, boreRadius],
  );

  const bladeGeo = useMemo(
    () =>
      createAirfoilBladeGeometry(
        hubRadius * 0.88,
        boreRadius - 0.0014,
        depth * 0.72,
        depth * 1.15,
        0.0020,
      ),
    [hubRadius, boreRadius, depth],
  );

  // Corner M3 socket screws inside frame perimeter
  const holeInset = size * 0.11;
  const holePositions: [number, number, number][] = [
    [0, -size / 2 + holeInset, -size / 2 + holeInset],
    [0, size / 2 - holeInset, -size / 2 + holeInset],
    [0, -size / 2 + holeInset, size / 2 - holeInset],
    [0, size / 2 - holeInset, size / 2 - holeInset],
  ];

  // Bench foot plate dimensions (rests flush at local y = -effectiveMountH)
  const footThickness = 0.004;
  const footLengthX = depth * 1.45;
  const footWidthZ = size * 0.94;
  const bracketBottomY = -effectiveMountH;
  const riserBottomY = bracketBottomY + footThickness;
  const riserTopY = -size / 2 + 0.004;
  const riserHeight = Math.max(0.004, riserTopY - riserBottomY);

  return (
    <group position={position}>
      {/* ── 1. Parametric Machined Aluminum Bench-Mounting Stand ── */}
      <group>
        {/* Base foot plate resting strictly on workbench (world y = 0 .. 4mm) */}
        <mesh position={[0, bracketBottomY + footThickness / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[footLengthX, footThickness, footWidthZ]} />
          <meshStandardMaterial
            color="#8c98a4"
            metalness={0.88}
            roughness={0.26}
            bumpMap={metalMaps.bumpMap}
            bumpScale={0.00022}
            roughnessMap={metalMaps.roughnessMap}
            envMapIntensity={1.38}
          />
        </mesh>

        {/* Foot mounting cap bolts into workbench */}
        {[-footWidthZ * 0.36, footWidthZ * 0.36].map((zPos, idx) => (
          <mesh key={idx} position={[0, bracketBottomY + footThickness + 0.0015, zPos]} castShadow>
            <cylinderGeometry args={[0.0022, 0.0022, 0.003, 12]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.2} />
          </mesh>
        ))}

        {/* Dual Side L-Bracket Uprights clamping fan frame bottom corners cleanly */}
        {[-size * 0.34, size * 0.34].map((zSide, idx) => (
          <mesh
            key={idx}
            position={[0, riserBottomY + riserHeight / 2, zSide]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[depth * 0.72, riserHeight, 0.004]} />
            <meshStandardMaterial color="#7a8694" metalness={0.86} roughness={0.32} />
          </mesh>
        ))}

        {/* Horizontal cradle saddle supporting fan bottom */}
        <mesh position={[0, -size / 2 + 0.0005, 0]} castShadow>
          <boxGeometry args={[depth * 0.76, 0.003, size * 0.72]} />
          <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.32} />
        </mesh>
      </group>

      {/* ── 2. Open-Tunnel Square Fan Housing Frame ── */}
      <mesh geometry={housingGeo} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#181c22" metalness={0.22} roughness={0.52} />
      </mesh>

      {/* Inner open-ended metallic shroud collar lining the circular bore */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[boreRadius + 0.0003, boreRadius + 0.0003, depth * 0.94, 36, 1, true]} />
        <meshStandardMaterial
          color="#262c36"
          metalness={0.35}
          roughness={0.45}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Subtle intake chamfer trim ring on left inlet */}
      <mesh position={[-depth / 2 + 0.0005, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[boreRadius + 0.0006, 0.0008, 10, 36]} />
        <meshStandardMaterial color="#475569" metalness={0.75} roughness={0.3} />
      </mesh>

      {/* 4 Corner Through-Bolts */}
      {holePositions.map((pos, idx) => (
        <mesh key={idx} position={pos} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0018, 0.0018, depth + 0.0016, 12]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.22} />
        </mesh>
      ))}

      {/* ── 3. Rear Motor Stator Can & 3 Aerodynamic Support Struts (+X discharge side) ── */}
      <group position={[depth / 2 - 0.0025, 0, 0]}>
        {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, i) => {
          const midR = hubRadius + (boreRadius - hubRadius) * 0.5;
          return (
            <mesh
              key={i}
              rotation={[angle, 0, 0]}
              position={[0, Math.cos(angle) * midR, Math.sin(angle) * midR]}
            >
              <boxGeometry args={[0.0022, boreRadius - hubRadius + 0.002, 0.0024]} />
              <meshStandardMaterial color="#1f252e" metalness={0.3} roughness={0.55} />
            </mesh>
          );
        })}
        {/* Brushless motor rear stator housing */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[hubRadius * 0.94, hubRadius * 0.94, 0.0045, 24]} />
          <meshStandardMaterial color="#334155" metalness={0.65} roughness={0.35} />
        </mesh>
      </group>

      {/* ── 4. Rotating 7-Blade Impeller Rotor (Clearly Visible Contrast Blades) ── */}
      <group ref={rotorRef} position={[0, 0, 0]}>
        {/* Rotor hub barrel */}
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[hubRadius, hubRadius * 0.96, depth * 0.62, 28]} />
          <meshStandardMaterial color="#334155" metalness={0.45} roughness={0.38} />
        </mesh>

        {/* Brushed metal front spinner nose cone */}
        <mesh position={[-depth * 0.30, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <sphereGeometry args={[hubRadius * 0.96, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.88} roughness={0.22} />
        </mesh>

        {/* Precision machined shaft cap nut */}
        <mesh position={[-depth * 0.44, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[hubRadius * 0.30, hubRadius * 0.30, 0.0025, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.18} />
        </mesh>

        {/* 7 Sculpted Scimitar Airfoil Fan Blades */}
        {Array.from({ length: BLADE_COUNT }).map((_, i) => {
          const angle = (i / BLADE_COUNT) * Math.PI * 2;
          return (
            <group key={i} rotation={[angle, 0, 0]}>
              {/* Pitch ~32° from rotor plane for clean axial +X flow and wide frontal profile */}
              <mesh
                geometry={bladeGeo}
                rotation={[0, Math.PI / 2 - 0.56, 0]}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial
                  color="#5b6676"
                  metalness={0.55}
                  roughness={0.28}
                  bumpMap={metalMaps.bumpMap}
                  bumpScale={0.00018}
                  envMapIntensity={1.65}
                />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* ── 5. Fine Wire Intake Finger Guard (Does NOT occlude impeller) ── */}
      <group position={[-depth / 2 - 0.002, 0, 0]}>
        {[boreRadius * 0.95, boreRadius * 0.66, boreRadius * 0.36].map((r, idx) => (
          <mesh key={idx} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[r, 0.00042, 8, 36]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.22} />
          </mesh>
        ))}
        {[0, Math.PI / 2].map((ang, idx) => (
          <mesh key={idx} rotation={[ang, 0, 0]}>
            <cylinderGeometry args={[0.00042, 0.00042, boreRadius * 1.92, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.22} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
