import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useThermalMaterial } from './thermalShader';

interface HeatSourceProps {
  T_source: number;     // °C
  T_ambient?: number;   // °C
  T_hot_block?: number; // °C bottom interface temperature
  insulationEnabled?: boolean;
  width: number;        // m
  length: number;       // m
  thickness: number;    // m
  position?: [number, number, number];
  thermalView?: boolean;
}

/**
 * Create a CNC-machined beveled rounded-rectangle heating block chassis
 * aligned in standard local axes (X=width, Y=thickness, Z=length).
 */
function createChamferedBlockGeometry(w: number, h: number, l: number): THREE.ExtrudeGeometry {
  const hw = w * 0.5;
  const hl = l * 0.5;
  const r = Math.min(w, l) * 0.08;

  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hl);
  shape.lineTo(hw - r, -hl);
  shape.quadraticCurveTo(hw, -hl, hw, -hl + r);
  shape.lineTo(hw, hl - r);
  shape.quadraticCurveTo(hw, hl, hw - r, hl);
  shape.lineTo(-hw + r, hl);
  shape.quadraticCurveTo(-hw, hl, -hw, hl - r);
  shape.lineTo(-hw, -hl + r);
  shape.quadraticCurveTo(-hw, -hl, -hw + r, -hl);

  const bevel = 0.0012;
  const innerW = Math.max(0.01, w - bevel * 2);
  const innerL = Math.max(0.01, l - bevel * 2);
  const scaleX = innerW / w;
  const scaleZ = innerL / l;
  const extrudeH = Math.max(0.004, h - bevel * 2);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeH,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 16,
  });
  geo.translate(0, 0, -extrudeH * 0.5);
  geo.rotateX(-Math.PI / 2);
  geo.scale(scaleX, 1, scaleZ);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Authentic Industrial Laboratory Cartridge & Radiant Heating Block:
 * - Precision CNC-chamfered Brushed Tool-Steel / Inconel chassis (clearly contrasted against Copper Hot Spreader)
 * - Recessed circular top radiant heating chamber with concentric glowing Incoloy heating coils
 * - Dual embedded horizontal cartridge heater bores with flush stainless locking collars & ceramic bushings
 * - Flush rear stainless heater busbar strip (zero floating/dangling rods!)
 * - 4 Spring-loaded stainless socket-head torque clamping bolts on corner pedestals
 * - Subtle rising thermal heat shimmer motes above hot core (no text or clutter)
 * - Full GLSL FEA Thermal Shader compatibility in Heat Map mode
 */
export function HeatSource({
  T_source,
  T_ambient = 25,
  T_hot_block,
  insulationEnabled = false,
  width,
  length,
  thickness,
  position = [0, 0, 0],
  thermalView = false,
}: HeatSourceProps) {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const coreDiscRef = useRef<THREE.Mesh>(null);
  const shimmerRef = useRef<THREE.Points>(null);

  const chassisGeo = useMemo(
    () => createChamferedBlockGeometry(width, thickness, length),
    [width, thickness, length],
  );

  useEffect(() => {
    return () => {
      chassisGeo.dispose();
    };
  }, [chassisGeo]);

  // Thermal glow factor (0 at ambient .. 1 at 400+ °C)
  const heatRatio = useMemo(
    () => THREE.MathUtils.clamp((T_source - 45) / 360, 0, 1),
    [T_source],
  );

  const elementColor = useMemo(() => {
    if (T_source > 340) return new THREE.Color('#ffedd5');
    if (T_source > 220) return new THREE.Color('#fb923c');
    if (T_source > 110) return new THREE.Color('#ea580c');
    return new THREE.Color('#7c2d12');
  }, [T_source]);

  const elementEmissive = useMemo(() => {
    if (T_source > 340) return new THREE.Color('#ef4444');
    if (T_source > 200) return new THREE.Color('#f97316');
    return new THREE.Color('#dc2626');
  }, [T_source]);

  // Subtle thermal shimmer motes rising off top heating core when hot
  const MOTE_COUNT = 28;
  const coreRadius = Math.min(width, length) * 0.24;
  const [moteGeo, motePhases] = useMemo(() => {
    const pos = new Float32Array(MOTE_COUNT * 3);
    const ph = new Float32Array(MOTE_COUNT);
    for (let i = 0; i < MOTE_COUNT; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.random() * coreRadius * 0.9;
      pos[i * 3 + 0] = Math.cos(ang) * rad;
      pos[i * 3 + 1] = thickness * 0.5 + 0.002 + Math.random() * 0.016;
      pos[i * 3 + 2] = Math.sin(ang) * rad;
      ph[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return [geo, ph];
  }, [coreRadius, thickness]);

  useEffect(() => {
    return () => {
      moteGeo.dispose();
    };
  }, [moteGeo]);

  useFrame(({ clock }, delta) => {
    const pulse = 0.92 + 0.08 * Math.sin(clock.elapsedTime * 2.8);
    const intensity = thermalView ? 1.15 : (0.18 + heatRatio * 2.2) * pulse;

    if (ring1Ref.current) {
      (ring1Ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
    }
    if (ring2Ref.current) {
      (ring2Ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity * 1.15;
    }
    if (coreDiscRef.current) {
      (coreDiscRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity * 0.75;
    }

    if (shimmerRef.current && heatRatio > 0.08) {
      const posAttr = shimmerRef.current.geometry.attributes.position as THREE.BufferAttribute;
      const yMin = thickness * 0.5 + 0.002;
      const yMax = thickness * 0.5 + 0.020;
      const riseSpeed = 0.010 + heatRatio * 0.018;

      for (let i = 0; i < MOTE_COUNT; i++) {
        let x = posAttr.getX(i);
        let y = posAttr.getY(i);
        let z = posAttr.getZ(i);

        y += riseSpeed * delta * (0.7 + 0.5 * motePhases[i]);
        x += Math.sin(clock.elapsedTime * 3 + motePhases[i] * 12) * 0.0018 * delta;

        if (y > yMax) {
          const ang = Math.random() * Math.PI * 2;
          const rad = Math.random() * coreRadius * 0.85;
          x = Math.cos(ang) * rad;
          y = yMin;
          z = Math.sin(ang) * rad;
        }
        posAttr.setXYZ(i, x, y, z);
      }
      posAttr.needsUpdate = true;
    }
  });

  const T_bot = T_hot_block ?? T_source * 0.85;
  const edgeCoolDrop = insulationEnabled ? 2.5 : (T_source - T_ambient) * 0.14;
  const thermalMat = useThermalMaterial(thermalView, {
    mode: 0,
    scaleMin: T_ambient,
    scaleMax: T_source,
    tempTop: T_source,
    tempBot: T_bot,
    tempEdge: Math.max(T_ambient, T_bot - edgeCoolDrop),
    dimX: width,
    dimY: thickness,
    dimZ: length,
  });

  const boltInset = Math.min(width, length) * 0.14;
  const boltPositions: [number, number, number][] = [
    [-width / 2 + boltInset, thickness / 2, -length / 2 + boltInset],
    [width / 2 - boltInset, thickness / 2, -length / 2 + boltInset],
    [-width / 2 + boltInset, thickness / 2, length / 2 - boltInset],
    [width / 2 - boltInset, thickness / 2, length / 2 - boltInset],
  ];

  const minSide = Math.min(width, length);
  const chamberR = minSide * 0.27;
  const yTop = thickness * 0.5;

  return (
    <group position={position}>
      {/* ── 1. Precision CNC-Chamfered Brushed Steel Heating Block Chassis ── */}
      <mesh
        key={thermalMat ? 'hs-thm' : 'hs-pbr'}
        geometry={chassisGeo}
        material={thermalMat ?? undefined}
        castShadow
        receiveShadow
      >
        {!thermalMat && (
          <meshStandardMaterial
            color="#64748b"
            metalness={0.86}
            roughness={0.28}
            envMapIntensity={1.35}
          />
        )}
      </mesh>

      {/* Machined Horizontal Side Thermal Expansion Grooves (hidden in Heat Map so FEA isotherms stay continuous) */}
      {!thermalView &&
        [-thickness * 0.18, thickness * 0.18].map((yGroove, gi) => (
          <mesh key={gi} position={[0, yGroove, 0]}>
            <boxGeometry args={[width + 0.0003, 0.0007, length + 0.0003]} />
            <meshStandardMaterial color="#334155" metalness={0.75} roughness={0.5} />
          </mesh>
        ))}

      {/* ── 2. Top Recessed Radiant Heating Chamber & Glowing Incoloy Rings ── */}
      {/* Brushed Stainless Retaining Bezel Collar */}
      <mesh position={[0, yTop + 0.0004, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[chamberR * 1.14, chamberR * 1.18, 0.0008, 32]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.90} roughness={0.22} />
      </mesh>

      {/* Dark Oxidized Ceramic Emitter Bed */}
      <mesh ref={coreDiscRef} position={[0, yTop + 0.0006, 0]}>
        <cylinderGeometry args={[chamberR, chamberR, 0.0005, 32]} />
        <meshStandardMaterial
          color={thermalView ? '#dc2626' : '#1e1b18'}
          emissive={elementEmissive}
          emissiveIntensity={0.4}
          roughness={0.6}
          metalness={0.3}
        />
      </mesh>

      {/* Outer Glowing Resistive Heating Coil Ring */}
      <mesh ref={ring1Ref} position={[0, yTop + 0.0010, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[chamberR * 0.72, 0.0011, 12, 36]} />
        <meshStandardMaterial
          color={elementColor}
          emissive={elementEmissive}
          emissiveIntensity={0.8}
          roughness={0.35}
          metalness={0.4}
        />
      </mesh>

      {/* Inner Glowing Resistive Heating Coil Ring */}
      <mesh ref={ring2Ref} position={[0, yTop + 0.0010, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[chamberR * 0.36, 0.0010, 12, 32]} />
        <meshStandardMaterial
          color={elementColor}
          emissive={elementEmissive}
          emissiveIntensity={0.95}
          roughness={0.35}
          metalness={0.4}
        />
      </mesh>

      {/* ── 3. Dual Embedded Side Cartridge Heater Bores (Flush Collars + Ceramic Bushings) ── */}
      {[-length * 0.20, length * 0.20].map((zOff, i) => (
        <group key={i} position={[0, -thickness * 0.06, zOff]}>
          {/* Left (-X) Stainless Circlip Bore End-Cap (protrudes only 1.2 mm, clears insulation) */}
          <mesh position={[-width * 0.5 - 0.0006, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.0024, 0.0024, 0.0014, 16]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.2} />
          </mesh>

          {/* Right (+X) Cartridge Swaged Brass/Ceramic Strain-Relief Termination Bushing */}
          <mesh position={[width * 0.5 + 0.0008, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.0023, 0.0023, 0.0018, 16]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.28} metalness={0.05} />
          </mesh>
          <mesh position={[width * 0.5 + 0.0018, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.0013, 0.0013, 0.0010, 12]} />
            <meshStandardMaterial color="#d97706" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      ))}

      {/* Flush Machined K-Type Thermocouple Compression Gland on Front Wall */}
      <group position={[0, -thickness * 0.22, length * 0.5 + 0.0008]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.0018, 0.0018, 0.0016, 6]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.92} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0.0012]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.0009, 0.0009, 0.0014, 12]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.85} roughness={0.25} />
        </mesh>
      </group>

      {/* ── 4. 4 Spring-Loaded Hardened Torque Clamping Studs ── */}
      {boltPositions.map((pos, i) => (
        <group key={i} position={pos}>
          {/* Bottom seat washer */}
          <mesh position={[0, 0.0005, 0]}>
            <cylinderGeometry args={[0.0034, 0.0034, 0.0010, 16]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.92} roughness={0.18} />
          </mesh>
          {/* Helical compression preload spring rings */}
          {[0.0013, 0.0020, 0.0027].map((sy, si) => (
            <mesh key={si} position={[0, sy, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.0024, 0.00035, 8, 16]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.22} />
            </mesh>
          ))}
          {/* Top Socket-Head Cap Screw */}
          <mesh position={[0, 0.0044, 0]} castShadow>
            <cylinderGeometry args={[0.0026, 0.0026, 0.0026, 16]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.92} roughness={0.20} />
          </mesh>
          {/* Hex Socket Drive Recess */}
          <mesh position={[0, 0.0058, 0]}>
            <cylinderGeometry args={[0.0014, 0.0014, 0.0005, 6]} />
            <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* ── 5. Subtle Rising Thermal Shimmer Motes (only when heated & !thermalView) ── */}
      {!thermalView && heatRatio > 0.08 && (
        <points ref={shimmerRef} geometry={moteGeo}>
          <pointsMaterial
            color="#fb923c"
            size={0.0018}
            transparent
            opacity={0.28 + heatRatio * 0.35}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            sizeAttenuation
          />
        </points>
      )}
    </group>
  );
}
