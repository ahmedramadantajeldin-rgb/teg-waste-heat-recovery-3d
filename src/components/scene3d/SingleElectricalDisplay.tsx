import { useMemo, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getTEGTerminalOffsets } from './TEGModule';

interface SingleElectricalDisplayProps {
  tegPos: [number, number, number];    // TEG module center [x, y, z]
  tegWidth: number;                    // TEG width (m)
  tegLength: number;                   // TEG length (m)
  tegThickness?: number;               // TEG thickness (m)
  clearRightX?: number;                // Rightmost edge of heat sink flange/spreaders (+X) to clear before dipping
  yClearTop?: number;                  // Top Y of cold spreader (wires exit above this height)
  standPos?: [number, number, number]; // Parametric benchtop stand coordinates [x, y, z]
  actualVoltage: number;               // calculated V_load
  current: number;                     // calculated I_load
  power: number;                       // calculated P_elec
  ratedVoltage?: number;               // nominal rated voltage
  showElectrons?: boolean;             // animated electron pulses on external circuit wires
}

function drawDisplayCanvas(
  canvas: HTMLCanvasElement,
  actualVoltage: number,
  current: number,
  power: number,
  ratedVoltage?: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = '#070d18';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, W - 16, H - 16);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 26px "JetBrains Mono", "Segoe UI", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ELECTRICAL OUTPUT', W / 2, 46);

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(24, 62);
  ctx.lineTo(W - 24, 62);
  ctx.stroke();

  ctx.font = '600 22px "JetBrains Mono", monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'left';
  ctx.fillText('Rated Voc (100K):', 26, 98);
  ctx.fillStyle = '#cbd5e1';
  ctx.textAlign = 'right';
  const ratedText = ratedVoltage != null && ratedVoltage > 0 ? `${ratedVoltage.toFixed(2)} V` : '—';
  ctx.fillText(ratedText, W - 26, 98);

  const drawRow = (
    yTop: number,
    bgColor: string,
    borderColor: string,
    textColor: string,
    label: string,
    val: string,
  ) => {
    const rowH = 68;
    ctx.fillStyle = bgColor;
    ctx.fillRect(22, yTop, W - 44, rowH);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(22, yTop, W - 44, rowH);

    ctx.fillStyle = textColor;
    ctx.font = 'bold 34px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(label, 40, yTop + 46);

    ctx.textAlign = 'right';
    ctx.font = 'bold 38px "JetBrains Mono", monospace';
    ctx.fillText(val, W - 38, yTop + 47);
  };

  drawRow(120, 'rgba(16, 185, 129, 0.16)', 'rgba(74, 222, 128, 0.45)', '#4ade80', 'V =', `${actualVoltage.toFixed(2)} V`);
  drawRow(198, 'rgba(250, 204, 21, 0.16)', 'rgba(250, 204, 21, 0.45)', '#facc15', 'I =', `${current.toFixed(2)} A`);
  drawRow(276, 'rgba(56, 189, 248, 0.18)', 'rgba(56, 189, 248, 0.55)', '#38bdf8', 'P =', `${power.toFixed(2)} W`);
}

/**
 * Single Industrial Electrical Output Display & Non-Intersecting Cables:
 * - Red (+) and Black (-) test leads exit horizontally from the right (+X) TEG brass studs
 *   strictly ABOVE the cold spreader and stay clear past the right heat-sink flange edge (`clearRightX`)
 *   before dropping smoothly in free air and entering bottom-mounted banana glands under the display casing.
 * - ZERO intersection with spreaders, heat sink, mounting bolts, or the OLED face.
 */
export function SingleElectricalDisplay({
  tegPos,
  tegWidth,
  tegLength,
  tegThickness = 0.0076,
  clearRightX = 0.052,
  yClearTop = 0.050,
  standPos = [0.106, 0.0, 0.024],
  actualVoltage,
  current,
  power,
  ratedVoltage,
  showElectrons = true,
}: SingleElectricalDisplayProps) {
  const [sx, sy, sz] = standPos;
  const postHeight = 0.056;
  const panelPos: [number, number, number] = [sx, sy + postHeight, sz];
  const panelRot: [number, number, number] = [-0.08, -0.52, 0.0];

  const [tx, ty, tz] = tegPos;

  const latestPropsRef = useRef({ actualVoltage, current, power, ratedVoltage });
  latestPropsRef.current = { actualVoltage, current, power, ratedVoltage };

  const texRef = useRef<THREE.CanvasTexture | null>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const drawnKeyRef = useRef<string>('');

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 368;

    const { actualVoltage: v, current: i, power: p, ratedVoltage: r } = latestPropsRef.current;
    drawDisplayCanvas(canvas, v, i, p, r);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;

    texRef.current = tex;
    drawnKeyRef.current = `${v.toFixed(2)}|${i.toFixed(2)}|${p.toFixed(2)}|${r?.toFixed(2) ?? ''}`;

    if (matRef.current) {
      matRef.current.map = tex;
      matRef.current.emissiveMap = tex;
      matRef.current.needsUpdate = true;
    }

    return () => {
      texRef.current = null;
      drawnKeyRef.current = '';
      if (matRef.current) {
        matRef.current.map = null;
        matRef.current.emissiveMap = null;
      }
      tex.dispose();
    };
  }, []);

  useFrame(() => {
    const tex = texRef.current;
    if (!tex) return;
    const { actualVoltage: v, current: i, power: p, ratedVoltage: r } = latestPropsRef.current;
    const key = `${v.toFixed(2)}|${i.toFixed(2)}|${p.toFixed(2)}|${r?.toFixed(2) ?? ''}`;
    if (key !== drawnKeyRef.current) {
      drawDisplayCanvas(tex.image as HTMLCanvasElement, v, i, p, r);
      tex.needsUpdate = true;
      drawnKeyRef.current = key;
      if (matRef.current && matRef.current.map !== tex) {
        matRef.current.map = tex;
        matRef.current.emissiveMap = tex;
        matRef.current.needsUpdate = true;
      }
    }
  });

  // Non-intersecting continuous spline wires routing strictly clear of spreaders, heat sink & screen
  const { redWireTube, blackWireTube, redCurve, blackCurve } = useMemo(() => {
    const euler = new THREE.Euler(...panelRot);

    // Underside bottom banana gland entry tips (below bottom casing edge y = -0.025)
    const localRedEnd = new THREE.Vector3(-0.018, -0.0275, 0.0).applyEuler(euler);
    const localBlackEnd = new THREE.Vector3(-0.006, -0.0275, 0.0).applyEuler(euler);

    const endRed = new THREE.Vector3(
      panelPos[0] + localRedEnd.x,
      panelPos[1] + localRedEnd.y,
      panelPos[2] + localRedEnd.z,
    );
    const endBlack = new THREE.Vector3(
      panelPos[0] + localBlackEnd.x,
      panelPos[1] + localBlackEnd.y,
      panelPos[2] + localBlackEnd.z,
    );

    // TEG right-edge (+X) brass stud coordinates synced strictly with TEGModule serpentine ends
    const { redZ: relRedZ, blackZ: relBlackZ } = getTEGTerminalOffsets(tegWidth, tegLength);
    const ceramicThick = Math.max(0.0011, tegThickness * 0.16);
    const yBottom = -tegThickness / 2 + ceramicThick / 2;
    const studX = tx + tegWidth / 2 + 0.0052;
    const studY = ty + yBottom + ceramicThick * 0.85 + 0.0014;
    const redZ = tz + relRedZ;
    const blackZ = tz + relBlackZ;

    const startRed = new THREE.Vector3(studX, studY, redZ);
    const startBlack = new THREE.Vector3(studX, studY, blackZ);

    // Stay above cold spreader while stepping past right wall of heat sink + flange
    const exitLevelY = Math.max(studY, yClearTop + 0.0025);
    const clearX = Math.max(clearRightX + 0.010, studX + 0.022);
    const midX = (clearX + endRed.x) * 0.5;
    const sagY = Math.max(0.012, sy + 0.013);

    const redCurve = new THREE.CatmullRomCurve3(
      [
        startRed,
        new THREE.Vector3(studX + 0.010, exitLevelY, redZ),
        new THREE.Vector3(clearX, exitLevelY - 0.004, THREE.MathUtils.lerp(redZ, endRed.z, 0.35)),
        new THREE.Vector3(midX - 0.005, sagY, THREE.MathUtils.lerp(redZ, endRed.z, 0.72)),
        new THREE.Vector3(endRed.x - 0.004, endRed.y - 0.011, endRed.z + 0.002),
        endRed,
      ],
      false,
      'centripetal',
      0.5,
    );

    const blackCurve = new THREE.CatmullRomCurve3(
      [
        startBlack,
        new THREE.Vector3(studX + 0.012, exitLevelY, blackZ),
        new THREE.Vector3(clearX + 0.004, exitLevelY - 0.006, THREE.MathUtils.lerp(blackZ, endBlack.z, 0.35)),
        new THREE.Vector3(midX + 0.003, sagY - 0.002, THREE.MathUtils.lerp(blackZ, endBlack.z, 0.75) + 0.004),
        new THREE.Vector3(endBlack.x + 0.002, endBlack.y - 0.011, endBlack.z + 0.003),
        endBlack,
      ],
      false,
      'centripetal',
      0.5,
    );

    return {
      redWireTube: new THREE.TubeGeometry(redCurve, 44, 0.0012, 8, false),
      blackWireTube: new THREE.TubeGeometry(blackCurve, 44, 0.0012, 8, false),
      redCurve,
      blackCurve,
    };
  }, [tx, ty, tz, tegWidth, tegLength, tegThickness, clearRightX, yClearTop, sx, sy, sz]);

  useEffect(() => {
    return () => {
      redWireTube.dispose();
      blackWireTube.dispose();
    };
  }, [redWireTube, blackWireTube]);

  // Animate power-scaled glowing electron pulses along external loop:
  // Black (-) lead (TEG - terminal -> Display Load), returning on Red (+) lead (Display Load -> TEG + terminal)
  const MAX_WIRE_PULSES = 14;
  const wireElectronsRef = useRef<THREE.InstancedMesh>(null);
  const wireMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const wireDummy = useMemo(() => new THREE.Object3D(), []);
  const wireClockRef = useRef(0);
  const pulsePosVec = useMemo(() => new THREE.Vector3(), []);

  useFrame((_state, delta) => {
    const mesh = wireElectronsRef.current;
    if (!showElectrons || !mesh) return;

    const pEff = Math.max(0, power);
    const pSqrt = Math.sqrt(Math.min(25, pEff));
    const pRatio = THREE.MathUtils.clamp(pSqrt / Math.sqrt(8.0), 0, 1);
    const active = pEff > 0.002 && current > 0.002;
    const activePulses = active
      ? Math.max(2, Math.min(MAX_WIRE_PULSES, Math.round(2 + pRatio * (MAX_WIRE_PULSES - 2))))
      : 0;
    mesh.count = activePulses * 2;
    if (activePulses === 0) return;

    const speed = THREE.MathUtils.clamp(0.14 + 0.36 * pSqrt + 0.16 * current, 0.14, 2.2);
    wireClockRef.current = (wireClockRef.current + delta * speed) % 1000;
    const t = wireClockRef.current;

    const energyScale = THREE.MathUtils.lerp(0.76, 1.25, pRatio);
    if (wireMatRef.current) {
      wireMatRef.current.color.set('#22d3ee').lerp(new THREE.Color('#e0f2fe'), pRatio * 0.55);
    }

    for (let i = 0; i < activePulses; i++) {
      // Negative (-) black wire: electrons flow from TEG -> Display (u = 0 -> 1)
      const uNeg = (i / activePulses + t) % 1;
      blackCurve.getPointAt(uNeg, pulsePosVec);
      wireDummy.position.copy(pulsePosVec);
      wireDummy.scale.setScalar((0.82 + 0.25 * Math.sin(uNeg * Math.PI)) * energyScale);
      wireDummy.updateMatrix();
      mesh.setMatrixAt(i, wireDummy.matrix);

      // Positive (+) red wire: electrons return from Display -> TEG (u = 1 -> 0)
      const uPos = 1 - ((i / activePulses + t) % 1);
      redCurve.getPointAt(uPos, pulsePosVec);
      wireDummy.position.copy(pulsePosVec);
      wireDummy.scale.setScalar((0.82 + 0.25 * Math.sin(uPos * Math.PI)) * energyScale);
      wireDummy.updateMatrix();
      mesh.setMatrixAt(activePulses + i, wireDummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* ── Continuous Flexible Red (+) Cable ── */}
      <mesh geometry={redWireTube} castShadow>
        <meshStandardMaterial color="#dc2626" roughness={0.35} metalness={0.15} />
      </mesh>

      {/* ── Continuous Flexible Black (-) Cable ── */}
      <mesh geometry={blackWireTube} castShadow>
        <meshStandardMaterial color="#181a1d" roughness={0.4} metalness={0.15} />
      </mesh>

      {/* ── External Circuit Electron Flow Pulses (scaled by P_elec) ── */}
      {showElectrons && (
        <instancedMesh ref={wireElectronsRef} args={[undefined, undefined, MAX_WIRE_PULSES * 2]}>
          <sphereGeometry args={[0.0018, 12, 12]} />
          <meshBasicMaterial ref={wireMatRef} color="#22d3ee" toneMapped={false} />
        </instancedMesh>
      )}

      {/* ── Mechanical Support Stand Flush on Workbench (y = 0) ── */}
      <group position={standPos}>
        <mesh position={[0, 0.0015, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.011, 0.011, 0.003, 20]} />
          <meshStandardMaterial color="#64748b" metalness={0.88} roughness={0.25} />
        </mesh>
        {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((rad, i) => (
          <mesh key={i} position={[Math.cos(rad) * 0.0075, 0.0032, Math.sin(rad) * 0.0075]} castShadow>
            <cylinderGeometry args={[0.0010, 0.0010, 0.0015, 10]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
          </mesh>
        ))}

        <mesh position={[0, postHeight * 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.0020, 0.0020, postHeight, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.18} />
        </mesh>

        <mesh position={[0, postHeight, 0]} castShadow>
          <sphereGeometry args={[0.0032, 16, 16]} />
          <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.3} />
        </mesh>
      </group>

      {/* ── Single TEG Electrical Output Display Panel (Native 3D CanvasTexture OLED) ── */}
      <group position={panelPos} rotation={panelRot}>
        {/* Brushed aluminum instrument casing */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.068, 0.050, 0.008]} />
          <meshStandardMaterial color="#1e2430" metalness={0.78} roughness={0.30} />
        </mesh>

        {/* Flush matte glass surround */}
        <mesh position={[0, 0, 0.0041]}>
          <boxGeometry args={[0.064, 0.046, 0.0008]} />
          <meshStandardMaterial color="#0b101b" roughness={0.35} metalness={0.3} />
        </mesh>

        {/* Backlit Crisp OLED Screen */}
        <mesh position={[0, 0, 0.0046]}>
          <planeGeometry args={[0.060, 0.043]} />
          <meshStandardMaterial
            ref={matRef}
            emissive="#ffffff"
            emissiveIntensity={0.85}
            roughness={0.25}
            metalness={0.05}
          />
        </mesh>

        {/* Underside bottom cable strain-relief banana glands (clear of screen face) */}
        <mesh position={[-0.018, -0.0265, 0.0]}>
          <cylinderGeometry args={[0.0020, 0.0020, 0.004, 12]} />
          <meshStandardMaterial color="#dc2626" roughness={0.3} metalness={0.35} />
        </mesh>
        <mesh position={[-0.006, -0.0265, 0.0]}>
          <cylinderGeometry args={[0.0020, 0.0020, 0.004, 12]} />
          <meshStandardMaterial color="#111827" roughness={0.4} metalness={0.35} />
        </mesh>
      </group>
    </group>
  );
}
