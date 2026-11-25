import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

interface ElectricalMeasurementStationProps {
  tegPos: [number, number, number];    // TEG module center [x, y, z]
  tegWidth: number;                     // TEG width
  tegLength: number;                    // TEG length
  actualVoltage: number;                // calculated V_load
  current: number;                      // calculated I_load
  power: number;                        // calculated P_elec
  ratedVoltage?: number;                // nominal rated voltage
  R_load?: number;                      // load resistance
}

/**
 * Realistic Electrical Measurement Station:
 * - 1. Benchtop Digital Multimeter (DMM):
 *      - Resting on workbench with ample breathing room in front-right area
 *      - Light gray / dark gray industrial chassis with rubber bumpers and tilt stand
 *      - High-contrast digital LCD showing live Voltage (DCV) and Current
 *      - Rotary function selector dial and control pushbuttons
 *      - 4mm Safety Banana Jacks (Red V/Ω and Black COM)
 * - 2. Separate Industrial Electrical Output Display Panel:
 *      - Mounted on independent vertical stanchion post behind the multimeter
 *      - Clear 10+ cm physical separation to prevent any visual overlap
 *      - Displays: TEG ELECTRICAL OUTPUT, Rated Voltage, Actual Voltage, Load Current, Electrical Power
 * - 3. Continuous Flexible Insulated Wires:
 *      - Exactly two cables: Positive (+) Red and Negative (-) Black
 *      - Physically exit from TEG module terminal studs (not heat sink, not fan)
 *      - Natural catenary curve resting gently on table and plugging into DMM jacks
 */
export function ElectricalMeasurementStation({
  tegPos,
  tegWidth,
  tegLength,
  actualVoltage,
  current,
  power,
  ratedVoltage,
  R_load = 2.0,
}: ElectricalMeasurementStationProps) {
  // ─── 1. Multimeter Placement (Front-Right on Workbench) ───
  const dmmPos: [number, number, number] = [0.094, 0.0175, 0.060];
  const dmmRot: [number, number, number] = [-0.06, -0.38, 0];
  const dmmW = 0.066;
  const dmmH = 0.035;
  const dmmD = 0.082;

  // ─── 2. Output Display Placement (Rear-Right on Stand) ───
  // Clear physical separation: z is set back by ~11 cm from DMM, elevated on post
  const displayPos: [number, number, number] = [0.100, 0.0, -0.045];
  const displayRot: [number, number, number] = [-0.10, -0.32, 0];

  // ─── 3. Jack Positions on Multimeter Faceplate ───
  const euler = new THREE.Euler(...dmmRot);
  // Red Banana Jack (V/Ω) offset in front faceplate
  const localJackRed = new THREE.Vector3(dmmW * 0.24, -dmmH * 0.18, dmmD / 2 + 0.002);
  localJackRed.applyEuler(euler);
  const jackRedWorld: [number, number, number] = [
    dmmPos[0] + localJackRed.x,
    dmmPos[1] + localJackRed.y,
    dmmPos[2] + localJackRed.z,
  ];

  // Black Banana Jack (COM) offset in front faceplate
  const localJackBlack = new THREE.Vector3(dmmW * 0.24 + 0.012, -dmmH * 0.18, dmmD / 2 + 0.002);
  localJackBlack.applyEuler(euler);
  const jackBlackWorld: [number, number, number] = [
    dmmPos[0] + localJackBlack.x,
    dmmPos[1] + localJackBlack.y,
    dmmPos[2] + localJackBlack.z,
  ];

  // ─── 4. Exact Wire Origin Points at TEG Module Terminals ───
  // Positive (+) Red Terminal Stud on front edge of TEG
  const tegRedStart: [number, number, number] = [
    tegPos[0] + tegWidth * 0.22,
    tegPos[1] - 0.001,
    tegPos[2] + tegLength / 2 + 0.0022,
  ];

  // Negative (-) Black Terminal Stud on front edge of TEG
  const tegBlackStart: [number, number, number] = [
    tegPos[0] + tegWidth * 0.36,
    tegPos[1] - 0.001,
    tegPos[2] + tegLength / 2 + 0.0022,
  ];

  // ─── 5. Continuous Flexible Red (+) Wire (Catmull-Rom Spline) ───
  const redWireTube = useMemo(() => {
    const points = [
      new THREE.Vector3(...tegRedStart),
      new THREE.Vector3(tegRedStart[0] + 0.010, tegRedStart[1] - 0.006, tegRedStart[2] + 0.014),
      new THREE.Vector3(
        (tegRedStart[0] + jackRedWorld[0]) * 0.48,
        0.005, // resting gracefully on workbench surface
        (tegRedStart[2] + jackRedWorld[2]) * 0.52 + 0.015
      ),
      new THREE.Vector3(jackRedWorld[0] - 0.012, 0.008, jackRedWorld[2] + 0.020),
      new THREE.Vector3(jackRedWorld[0], jackRedWorld[1], jackRedWorld[2] + 0.008),
      new THREE.Vector3(...jackRedWorld),
    ];
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
    return new THREE.TubeGeometry(curve, 48, 0.0015, 10, false);
  }, [tegRedStart, jackRedWorld]);

  // ─── 6. Continuous Flexible Black (-) Wire (Catmull-Rom Spline) ───
  const blackWireTube = useMemo(() => {
    const points = [
      new THREE.Vector3(...tegBlackStart),
      new THREE.Vector3(tegBlackStart[0] + 0.012, tegBlackStart[1] - 0.008, tegBlackStart[2] + 0.016),
      new THREE.Vector3(
        (tegBlackStart[0] + jackBlackWorld[0]) * 0.52,
        0.005,
        (tegBlackStart[2] + jackBlackWorld[2]) * 0.50 + 0.022
      ),
      new THREE.Vector3(jackBlackWorld[0] - 0.008, 0.008, jackBlackWorld[2] + 0.022),
      new THREE.Vector3(jackBlackWorld[0], jackBlackWorld[1], jackBlackWorld[2] + 0.008),
      new THREE.Vector3(...jackBlackWorld),
    ];
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
    return new THREE.TubeGeometry(curve, 48, 0.0015, 10, false);
  }, [tegBlackStart, jackBlackWorld]);

  return (
    <group>
      {/* ── 1. Continuous Flexible Red (+) Cable ── */}
      <mesh geometry={redWireTube} castShadow>
        <meshStandardMaterial
          color="#dc2626"
          roughness={0.35}
          metalness={0.15}
        />
      </mesh>

      {/* ── 2. Continuous Flexible Black (-) Cable ── */}
      <mesh geometry={blackWireTube} castShadow>
        <meshStandardMaterial
          color="#181a1d"
          roughness={0.4}
          metalness={0.15}
        />
      </mesh>

      {/* ── 3. Realistic Benchtop Digital Multimeter (DMM) ── */}
      <group position={dmmPos} rotation={dmmRot}>
        {/* Main instrument chassis body (Dual-tone light gray lab instrument) */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[dmmW, dmmH, dmmD]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.45} roughness={0.4} />
        </mesh>

        {/* Rubberized protective corner bumpers (Navy / Dark Slate) */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[dmmW + 0.0025, dmmH + 0.0025, dmmD - 0.006]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} />
        </mesh>

        {/* Folding tilt bail / bench foot stand underneath */}
        <mesh position={[0, -dmmH / 2 + 0.002, -dmmD * 0.2]} castShadow>
          <boxGeometry args={[dmmW * 0.9, 0.004, 0.004]} />
          <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* Front instrument faceplate */}
        <mesh position={[0, 0, dmmD / 2 + 0.0006]}>
          <boxGeometry args={[dmmW * 0.94, dmmH * 0.90, 0.001]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.2} />
        </mesh>

        {/* Front LCD Screen Bezel */}
        <mesh position={[-dmmW * 0.14, dmmH * 0.12, dmmD / 2 + 0.0014]}>
          <boxGeometry args={[dmmW * 0.58, dmmH * 0.54, 0.001]} />
          <meshStandardMaterial color="#020617" roughness={0.2} metalness={0.3} />
        </mesh>

        {/* Rotary Selector Dial */}
        <mesh position={[-dmmW * 0.14, -dmmH * 0.22, dmmD / 2 + 0.002]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.0055, 0.006, 0.004, 20]} />
          <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Dial pointer notch */}
        <mesh position={[-dmmW * 0.14, -dmmH * 0.22 + 0.004, dmmD / 2 + 0.0035]}>
          <boxGeometry args={[0.0012, 0.003, 0.001]} />
          <meshStandardMaterial color="#38bdf8" />
        </mesh>

        {/* Function pushbuttons (DCV, DCI, Ω, HOLD) */}
        {[-0.008, 0, 0.008].map((xOff, i) => (
          <mesh key={i} position={[dmmW * 0.24 + xOff, dmmH * 0.22, dmmD / 2 + 0.002]} castShadow>
            <boxGeometry args={[0.005, 0.003, 0.002]} />
            <meshStandardMaterial color="#64748b" roughness={0.5} />
          </mesh>
        ))}

        {/* 4mm Safety Banana Input Terminals on Faceplate */}
        {/* Red V/Ω Jack */}
        <mesh position={[dmmW * 0.24, -dmmH * 0.18, dmmD / 2 + 0.002]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.0032, 0.0032, 0.003, 16]} />
          <meshStandardMaterial color="#dc2626" roughness={0.3} metalness={0.4} />
        </mesh>
        {/* Black COM Jack */}
        <mesh position={[dmmW * 0.24 + 0.012, -dmmH * 0.18, dmmD / 2 + 0.002]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.0032, 0.0032, 0.003, 16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.4} />
        </mesh>

        {/* Live Digital LCD Readout */}
        <Html
          position={[-dmmW * 0.14, dmmH * 0.12, dmmD / 2 + 0.002]}
          transform
          distanceFactor={0.22}
          pointerEvents="none"
        >
          <div
            style={{
              width: 125,
              padding: '5px 7px',
              background: '#040d12',
              border: '1px solid #00f0ff33',
              borderRadius: 3,
              fontFamily: "'JetBrains Mono', monospace",
              color: '#00f0ff',
              boxShadow: 'inset 0 0 10px rgba(0, 240, 255, 0.18)',
              userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: '#64748b', fontWeight: 700, marginBottom: 2 }}>
              <span>PRECISION DMM</span>
              <span style={{ color: '#22c55e' }}>● DC V</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#4ade80', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {actualVoltage.toFixed(3)} <span style={{ fontSize: 8 }}>V</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#94a3b8', borderTop: '1px solid #1e293b', paddingTop: 2, marginTop: 2 }}>
              <span>I: {current.toFixed(2)}A</span>
              <span style={{ color: '#38bdf8' }}>P: {power.toFixed(2)}W</span>
            </div>
          </div>
        </Html>
      </group>

      {/* ── 4. Separate Industrial Electrical Output Display (On Stanchion Stand) ── */}
      {/* Positioned behind the multimeter with clear distance and independent elevation */}
      <group position={displayPos}>
        {/* Table Mounting Flange */}
        <mesh position={[0, 0.0015, 0]} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 0.003, 20]} />
          <meshStandardMaterial color="#64748b" metalness={0.88} roughness={0.25} />
        </mesh>
        {/* Flange mounting bolts into table */}
        {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((rad, i) => (
          <mesh key={i} position={[Math.cos(rad) * 0.008, 0.0035, Math.sin(rad) * 0.008]} castShadow>
            <cylinderGeometry args={[0.0012, 0.0012, 0.002, 12]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
          </mesh>
        ))}

        {/* Stainless Steel Vertical Support Post */}
        <mesh position={[0, 0.040, 0]} castShadow>
          <cylinderGeometry args={[0.0022, 0.0022, 0.078, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.18} />
        </mesh>

        {/* Articulated Swivel Head Mount */}
        <mesh position={[0, 0.078, 0]} castShadow>
          <sphereGeometry args={[0.0038, 16, 16]} />
          <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.3} />
        </mesh>

        {/* Display Panel Head (Tilted toward camera) */}
        <group position={[0, 0.080, 0]} rotation={displayRot}>
          {/* Extruded Aluminum Panel Enclosure */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.064, 0.046, 0.008]} />
            <meshStandardMaterial color="#1e2430" metalness={0.75} roughness={0.3} />
          </mesh>
          {/* Protective Bezel */}
          <mesh position={[0, 0, 0.0041]}>
            <boxGeometry args={[0.061, 0.043, 0.001]} />
            <meshStandardMaterial color="#0b101b" roughness={0.4} metalness={0.4} />
          </mesh>

          {/* Crisp Industrial Digital Data Screen */}
          <Html position={[0, 0, 0.005]} transform distanceFactor={0.22} pointerEvents="none">
            <div
              style={{
                width: 152,
                padding: '6px 8px',
                background: 'rgba(8, 15, 26, 0.96)',
                border: '1.5px solid #1e3a5f',
                borderRadius: 4,
                fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
                fontSize: 8.5,
                color: '#f8fafc',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6), inset 0 0 10px rgba(30, 58, 95, 0.5)',
                userSelect: 'none',
              }}
            >
              {/* Header */}
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 800,
                  color: '#38bdf8',
                  letterSpacing: '0.08em',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid #1e293b',
                  paddingBottom: 3,
                  marginBottom: 3,
                }}
              >
                TEG ELECTRICAL OUTPUT
              </div>

              {/* Rated Voltage */}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', marginBottom: 2 }}>
                <span>Rated Voltage:</span>
                <span style={{ color: '#cbd5e1', fontWeight: 600 }}>
                  {ratedVoltage != null && ratedVoltage > 0 ? `${ratedVoltage.toFixed(2)} V` : 'Not Specified'}
                </span>
              </div>

              {/* Actual Voltage */}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', marginBottom: 2 }}>
                <span>Actual Voltage:</span>
                <span style={{ color: '#4ade80', fontWeight: 800 }}>{actualVoltage.toFixed(2)} V</span>
              </div>

              {/* Load Current */}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', marginBottom: 2 }}>
                <span>Load Current:</span>
                <span style={{ color: '#facc15', fontWeight: 800 }}>{current.toFixed(2)} A</span>
              </div>

              {/* Electrical Power */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid #1e293b',
                  paddingTop: 3,
                  marginTop: 2,
                }}
              >
                <span style={{ color: '#f8fafc', fontWeight: 700 }}>Electrical Power:</span>
                <span style={{ color: '#38bdf8', fontWeight: 800 }}>{power.toFixed(2)} W</span>
              </div>
            </div>
          </Html>
        </group>
      </group>
    </group>
  );
}
