import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

interface DigitalMultimeterProps {
  tegPos: [number, number, number];    // TEG module center position
  tegWidth: number;
  tegLength: number;
  actualVoltage: number;                // calculated V_load or Voc
  current: number;                      // calculated I_load
  power: number;                        // calculated P_elec
  ratedVoltage?: number;                // nominal rated voltage
  position?: [number, number, number];  // meter chassis position on workbench
}

/**
 * Realistic Benchtop Digital Multimeter & Electrical Load Station:
 * - Matches the reference engineering setup:
 *   - Dark industrial instrument housing sitting firmly on the workbench to the right
 *   - Beautiful digital display screen showing:
 *     - Header: "Electrical Output"
 *     - V = X.XX V (green LED font)
 *     - I = X.XX A (amber/orange LED font)
 *     - P = X.XX W (cyan LED font)
 *   - Continuous flexible cables: Red (+) and Black (-) emerging from TEG terminals and entering the meter
 *   - Two heavy black load cables exiting the bottom onto the workbench
 *   - Clean: NO floating rods, NO awkward overlapping stanchion pole
 */
export function DigitalMultimeter({
  tegPos,
  tegWidth,
  tegLength,
  actualVoltage,
  current,
  power,
  position = [0.088, 0.026, 0.038],
}: DigitalMultimeterProps) {
  // Meter chassis dimensions (meters)
  const meterW = 0.058;
  const meterH = 0.048;
  const meterD = 0.052;

  // Rotation angled towards the camera and slightly upwards
  const meterRot: [number, number, number] = [-0.10, -0.32, 0.02];

  // Jack positions on the left side of the meter faceplate
  // Calculate transformed position for cable connection
  const rotY = meterRot[1];
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);

  // Offset from meter center to wire entry point on left face/front edge
  const localJackRed = new THREE.Vector3(-meterW * 0.44, -meterH * 0.12, meterD * 0.38);
  const localJackBlack = new THREE.Vector3(-meterW * 0.44, -meterH * 0.28, meterD * 0.38);

  localJackRed.applyEuler(new THREE.Euler(...meterRot));
  localJackBlack.applyEuler(new THREE.Euler(...meterRot));

  const jackRedWorld: [number, number, number] = [
    position[0] + localJackRed.x,
    position[1] + localJackRed.y,
    position[2] + localJackRed.z,
  ];

  const jackBlackWorld: [number, number, number] = [
    position[0] + localJackBlack.x,
    position[1] + localJackBlack.y,
    position[2] + localJackBlack.z,
  ];

  // TEG Module front-right terminal blocks
  const tegTermX = tegPos[0] + tegWidth * 0.30;
  const tegTermY = tegPos[1];
  const tegTermZ = tegPos[2] + tegLength / 2 + 0.002;

  const tegRedStart: [number, number, number] = [tegTermX - 0.004, tegTermY, tegTermZ];
  const tegBlackStart: [number, number, number] = [tegTermX + 0.004, tegTermY, tegTermZ];

  // ─── 1. Continuous Flexible Red (+) Wire ───
  const redWireTube = useMemo(() => {
    const points = [
      new THREE.Vector3(...tegRedStart),
      new THREE.Vector3(tegRedStart[0] + 0.012, tegRedStart[1] - 0.006, tegRedStart[2] + 0.016),
      new THREE.Vector3(
        (tegRedStart[0] + jackRedWorld[0]) * 0.52,
        0.008, // natural catenary gravity curve down toward workbench
        (tegRedStart[2] + jackRedWorld[2]) * 0.5 + 0.022
      ),
      new THREE.Vector3(jackRedWorld[0] - 0.012, jackRedWorld[1] - 0.004, jackRedWorld[2] + 0.010),
      new THREE.Vector3(...jackRedWorld),
    ];
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
    return new THREE.TubeGeometry(curve, 40, 0.0016, 10, false);
  }, [tegRedStart, jackRedWorld]);

  // ─── 2. Continuous Flexible Black (-) Wire ───
  const blackWireTube = useMemo(() => {
    const points = [
      new THREE.Vector3(...tegBlackStart),
      new THREE.Vector3(tegBlackStart[0] + 0.014, tegBlackStart[1] - 0.008, tegBlackStart[2] + 0.018),
      new THREE.Vector3(
        (tegBlackStart[0] + jackBlackWorld[0]) * 0.54,
        0.006,
        (tegBlackStart[2] + jackBlackWorld[2]) * 0.5 + 0.026
      ),
      new THREE.Vector3(jackBlackWorld[0] - 0.010, jackBlackWorld[1] - 0.006, jackBlackWorld[2] + 0.012),
      new THREE.Vector3(...jackBlackWorld),
    ];
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
    return new THREE.TubeGeometry(curve, 40, 0.0016, 10, false);
  }, [tegBlackStart, jackBlackWorld]);

  // ─── 3. Two Heavy Bottom Black Output Cables exiting the meter onto table ───
  const bottomCable1 = useMemo(() => {
    const startX = position[0] - 0.008 * cosY;
    const startZ = position[2] + 0.008 * sinY;
    const points = [
      new THREE.Vector3(startX, position[1] - meterH / 2, startZ),
      new THREE.Vector3(startX + 0.002, 0.005, startZ + 0.012),
      new THREE.Vector3(startX + 0.004, 0.002, startZ + 0.038),
    ];
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
    return new THREE.TubeGeometry(curve, 20, 0.0020, 8, false);
  }, [position, cosY, sinY, meterH]);

  const bottomCable2 = useMemo(() => {
    const startX = position[0] + 0.008 * cosY;
    const startZ = position[2] - 0.008 * sinY;
    const points = [
      new THREE.Vector3(startX, position[1] - meterH / 2, startZ),
      new THREE.Vector3(startX + 0.002, 0.005, startZ + 0.012),
      new THREE.Vector3(startX + 0.005, 0.002, startZ + 0.040),
    ];
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
    return new THREE.TubeGeometry(curve, 20, 0.0020, 8, false);
  }, [position, cosY, sinY, meterH]);

  return (
    <group>
      {/* ── Continuous Flexible Red (+) Wire ── */}
      <mesh geometry={redWireTube} castShadow>
        <meshStandardMaterial
          color="#dc2626"
          roughness={0.35}
          metalness={0.12}
        />
      </mesh>

      {/* ── Continuous Flexible Black (-) Wire ── */}
      <mesh geometry={blackWireTube} castShadow>
        <meshStandardMaterial
          color="#181a1d"
          roughness={0.4}
          metalness={0.12}
        />
      </mesh>

      {/* ── Heavy Bottom Output Cables ── */}
      <mesh geometry={bottomCable1} castShadow>
        <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.15} />
      </mesh>
      <mesh geometry={bottomCable2} castShadow>
        <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.15} />
      </mesh>

      {/* ── Benchtop Digital Multimeter Housing ── */}
      <group position={position} rotation={meterRot}>
        {/* Main chassis box */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[meterW, meterH, meterD]} />
          <meshStandardMaterial
            color="#1e2430"
            metalness={0.65}
            roughness={0.35}
          />
        </mesh>

        {/* Rubberized protective bumper bezel */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[meterW + 0.002, meterH + 0.002, meterD - 0.004]} />
          <meshStandardMaterial color="#0b0f19" roughness={0.85} metalness={0.1} />
        </mesh>

        {/* Front instrument display faceplate */}
        <mesh position={[0, 0, meterD / 2 + 0.001]}>
          <boxGeometry args={[meterW * 0.92, meterH * 0.90, 0.001]} />
          <meshStandardMaterial color="#0b1320" roughness={0.3} metalness={0.2} />
        </mesh>

        {/* Wire entry terminals on left side */}
        <mesh position={[-meterW / 2 - 0.001, -meterH * 0.12, meterD * 0.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0025, 0.0025, 0.003, 16]} />
          <meshStandardMaterial color="#dc2626" roughness={0.3} metalness={0.4} />
        </mesh>
        <mesh position={[-meterW / 2 - 0.001, -meterH * 0.28, meterD * 0.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0025, 0.0025, 0.003, 16]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.4} />
        </mesh>

        {/* Bottom cable glands */}
        <mesh position={[-0.008, -meterH / 2 - 0.002, 0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.0035, 0.0035, 0.004, 16]} />
          <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.8} />
        </mesh>
        <mesh position={[0.008, -meterH / 2 - 0.002, 0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.0035, 0.0035, 0.004, 16]} />
          <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.8} />
        </mesh>

        {/* Glowing Digital Screen (High-Fidelity Readout matching reference image) */}
        <Html
          position={[0, 0.002, meterD / 2 + 0.002]}
          transform
          distanceFactor={0.25}
          pointerEvents="none"
        >
          <div
            style={{
              width: 146,
              padding: '8px 10px',
              background: '#040914',
              border: '1.5px solid #1e3a5f',
              borderRadius: 5,
              fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
              boxShadow: 'inset 0 0 12px rgba(30, 58, 95, 0.5), 0 0 10px rgba(0, 0, 0, 0.7)',
              userSelect: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {/* Meter Header */}
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: '#38bdf8',
                letterSpacing: '0.08em',
                textAlign: 'center',
                textTransform: 'uppercase',
                borderBottom: '1px solid #1e293b',
                paddingBottom: 3,
                marginBottom: 2,
              }}
            >
              Electrical Output
            </div>

            {/* V = X.XX V (Phosphor Green) */}
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: '#4ade80',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                display: 'flex',
                justifyContent: 'space-between',
                textShadow: '0 0 8px rgba(74, 222, 128, 0.4)',
              }}
            >
              <span>V =</span>
              <span>{actualVoltage.toFixed(2)} V</span>
            </div>

            {/* I = X.XX A (Amber / Yellow) */}
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: '#facc15',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                display: 'flex',
                justifyContent: 'space-between',
                textShadow: '0 0 8px rgba(250, 204, 21, 0.4)',
              }}
            >
              <span>I =</span>
              <span>{current.toFixed(2)} A</span>
            </div>

            {/* P = X.XX W (Bright Sky Cyan) */}
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: '#38bdf8',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                display: 'flex',
                justifyContent: 'space-between',
                textShadow: '0 0 8px rgba(56, 189, 248, 0.4)',
              }}
            >
              <span>P =</span>
              <span>{power.toFixed(2)} W</span>
            </div>
          </div>
        </Html>
      </group>
    </group>
  );
}
