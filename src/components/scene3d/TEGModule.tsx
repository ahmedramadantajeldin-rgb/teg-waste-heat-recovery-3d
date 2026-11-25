import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useThermalMaterial } from './thermalShader';

interface TEGModuleProps {
  T_h: number;             // hot side temperature °C
  T_c: number;             // cold side temperature °C
  T_min?: number;          // scale min °C
  T_max?: number;          // scale max °C
  I_load?: number;         // A — scales carrier drift speed
  showElectrons?: boolean; // shows translucent crystals + live e- / h+ carrier motion
  width: number;           // m (e.g. 0.040 = 40 mm)
  length: number;          // m (e.g. 0.040 = 40 mm)
  thickness: number;       // m (e.g. 0.0076 = 7.6 mm)
  Voc?: number;
  P_elec?: number;
  position?: [number, number, number];
  thermalView?: boolean;
}

/**
 * Shared exact TEG terminal Z ratios & grid sizing so external leads always align to 0.1 mm.
 */
export function getTEGTerminalOffsets(width: number, length: number) {
  const rawN = Math.round(Math.min(width, length) / 0.0066);
  const gridN = Math.max(4, Math.min(8, rawN % 2 === 0 ? rawN : rawN + 1));
  const spanZ = length * 0.78;
  const redZ = THREE.MathUtils.lerp(-spanZ / 2, spanZ / 2, (gridN - 2) / (gridN - 1));
  const blackZ = THREE.MathUtils.lerp(-spanZ / 2, spanZ / 2, (gridN - 1) / (gridN - 1));
  return { gridN, redZ, blackZ };
}

interface BridgeStrap {
  x: number;
  z: number;
  w: number;
  d: number;
  isTop: boolean;
}

interface SampledCarrierPath {
  points: THREE.Vector3[];
  phases: number[];
}

/**
 * Build a Hamiltonian serpentine path over an EVEN gridN×gridN lattice:
 * - Starts at (gridN-1, gridN-2) [P-type, Red + lead]
 * - Visits every single leg strictly alternating P -> N -> P -> N ...
 * - Ends at (gridN-1, gridN-1) [N-type, Black - lead]
 */
function buildSerpentineOrder(gridN: number): [number, number][] {
  const order: [number, number][] = [];
  for (let ix = gridN - 1; ix >= 1; ix--) {
    const goingUp = (gridN - 1 - ix) % 2 === 0;
    if (goingUp) {
      for (let iz = gridN - 2; iz >= 0; iz--) order.push([ix, iz]);
    } else {
      for (let iz = 0; iz <= gridN - 2; iz++) order.push([ix, iz]);
    }
  }
  // Column ix = 0 descends all the way to iz = gridN - 1
  for (let iz = 0; iz <= gridN - 1; iz++) order.push([0, iz]);
  // Front row iz = gridN - 1 runs left -> right ending at (gridN - 1, gridN - 1)
  for (let ix = 1; ix <= gridN - 1; ix++) order.push([ix, gridN - 1]);
  return order;
}

/**
 * Sample a Three.js Curve3 evenly into N+1 cached Vector3 points for allocation-free useFrame animation.
 */
function sampleCurve(curve: THREE.Curve<THREE.Vector3>, samples = 28): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= samples; i++) {
    pts.push(curve.getPointAt(i / samples));
  }
  return pts;
}

function interpolateSampled(pts: THREE.Vector3[], u: number, target: THREE.Vector3) {
  const clamped = THREE.MathUtils.clamp(u, 0, 0.9999);
  const fIdx = clamped * (pts.length - 1);
  const idx = Math.floor(fIdx);
  const frac = fIdx - idx;
  target.lerpVectors(pts[idx], pts[Math.min(pts.length - 1, idx + 1)], frac);
}

/**
 * High-Detail Thermoelectric Generator (TEG) Module:
 * - Authentic Direct Bonded Copper (DBC) Al2O3 Ceramic Top & Bottom Substrates
 * - Continuous Hamiltonian Serpentine Copper Shunt Bridges connecting all P-N couples in series
 * - Metallic Nickel-Tin Diffusion Barrier Solder Caps between every copper strap and Bi2Te3 pellet
 * - Corner Ceramic Alignment Spacer Posts for realistic mechanical assembly
 * - Semi-translucent crystal Bi2Te3 legs with edge outlines when Electron Flow is ON
 * - Physically accurate continuous curved Electron (e⁻) streamlines (Top Bridge -> N-leg -> Bottom Bridge -> Out Black -)
 *   plus Amber Hole (h⁺) transport down every P-leg (Hot -> Cold), with speed modulated by T(y) & I_load
 */
export function TEGModule({
  T_h,
  T_c,
  T_min = 25,
  T_max = 150,
  I_load = 0.7,
  P_elec = 0.98,
  showElectrons = true,
  width = 0.040,
  length = 0.040,
  thickness = 0.0076,
  position = [0, 0, 0],
  thermalView = false,
}: TEGModuleProps) {
  const ceramicThick = Math.max(0.0011, thickness * 0.16);
  const copperPadThick = 0.00042;
  const niCapThick = 0.00022; // 0.22 mm Ni diffusion barrier + solder cap at top & bottom of every pellet
  const totalInner = thickness - 2 * ceramicThick - 2 * copperPadThick;
  const pelletHeight = Math.max(0.0022, totalInner - 2 * niCapThick);

  const { gridN, redZ, blackZ } = useMemo(
    () => getTEGTerminalOffsets(width, length),
    [width, length],
  );
  const pelletSize = (Math.min(width, length) * 0.70) / (gridN * 1.48);

  const y_top_cer = thickness / 2 - ceramicThick / 2;
  const y_bot_cer = -thickness / 2 + ceramicThick / 2;
  const y_top_cu = y_top_cer - ceramicThick / 2 - copperPadThick / 2;
  const y_bot_cu = y_bot_cer + ceramicThick / 2 + copperPadThick / 2;
  const y_top_ni = y_top_cu - copperPadThick / 2 - niCapThick / 2;
  const y_bot_ni = y_bot_cu + copperPadThick / 2 + niCapThick / 2;

  const crystalXray = showElectrons && !thermalView;

  const {
    pellets,
    pelletEdgesGeo,
    bridges,
    electronStreams,
    totalElectrons,
    holeStreams,
    totalHoles,
    posLeadPadX,
    negLeadPadX,
  } = useMemo(() => {
    const spanX = width * 0.78;
    const spanZ = length * 0.78;
    const coord = (ix: number, iz: number) => ({
      x: THREE.MathUtils.lerp(-spanX / 2, spanX / 2, ix / (gridN - 1)),
      z: THREE.MathUtils.lerp(-spanZ / 2, spanZ / 2, iz / (gridN - 1)),
      isP: (ix + iz) % 2 === 1, // Start (gridN-1, gridN-2) is P (+); End (gridN-1, gridN-1) is N (-)
    });

    const items: { x: number; z: number; isP: boolean }[] = [];
    for (let iz = 0; iz < gridN; iz++) {
      for (let ix = 0; ix < gridN; ix++) {
        items.push(coord(ix, iz));
      }
    }

    const order = buildSerpentineOrder(gridN);
    const strapList: BridgeStrap[] = [];
    const eStreams: SampledCarrierPath[] = [];
    const hStreams: SampledCarrierPath[] = [];

    const padW = pelletSize * 1.05;

    // 1. Build alternating copper shunt bridges & continuous electron stream per P-N couple
    for (let k = 0; k < order.length - 1; k++) {
      const [ixA, izA] = order[k];
      const [ixB, izB] = order[k + 1];
      const A = coord(ixA, izA);
      const B = coord(ixB, izB);
      const isTop = k % 2 === 0; // P -> N occurs at top hot ceramic; N -> P occurs at bottom cold ceramic

      const minX = Math.min(A.x, B.x);
      const maxX = Math.max(A.x, B.x);
      const minZ = Math.min(A.z, B.z);
      const maxZ = Math.max(A.z, B.z);

      strapList.push({
        x: (minX + maxX) * 0.5,
        z: (minZ + maxZ) * 0.5,
        w: (maxX - minX) + padW,
        d: (maxZ - minZ) + padW,
        isTop,
      });

      if (isTop) {
        // Couple k/2: Top Hot Bridge (A=P -> B=N) -> Down N-leg (B) -> Next Bottom Cold Bridge (B -> C=next P or Neg terminal)
        const hasNext = k + 2 < order.length;
        const nextCoord = hasNext ? coord(order[k + 2][0], order[k + 2][1]) : null;
        const exitPoint = nextCoord
          ? new THREE.Vector3((B.x + nextCoord.x) * 0.5, y_bot_cu, (B.z + nextCoord.z) * 0.5)
          : new THREE.Vector3(width * 0.5 + 0.002, y_bot_cu, B.z); // Straight out to Negative (-) Black lead!

        const pts = [
          new THREE.Vector3((A.x + B.x) * 0.5, y_top_cu, (A.z + B.z) * 0.5),
          new THREE.Vector3(B.x, y_top_cu, B.z),
          new THREE.Vector3(B.x, pelletHeight * 0.22, B.z),
          new THREE.Vector3(B.x, -pelletHeight * 0.22, B.z),
          new THREE.Vector3(B.x, y_bot_cu, B.z),
          exitPoint,
        ];
        const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.35);
        const sampled = sampleCurve(curve, 28);
        const phaseOffset = (k * 0.137) % 1;
        // Max 6 carrier slots per couple stream; active subset scales dynamically with P_elec
        eStreams.push({
          points: sampled,
          phases: [
            phaseOffset,
            (phaseOffset + 1 / 6) % 1,
            (phaseOffset + 2 / 6) % 1,
            (phaseOffset + 3 / 6) % 1,
            (phaseOffset + 4 / 6) % 1,
            (phaseOffset + 5 / 6) % 1,
          ],
        });
      }

      // Hole transport down each P-leg (Hot top -> Cold bottom)
      if (A.isP) {
        const pCurve = new THREE.CatmullRomCurve3(
          [
            new THREE.Vector3(A.x, y_top_ni, A.z),
            new THREE.Vector3(A.x, pelletHeight * 0.15, A.z),
            new THREE.Vector3(A.x, -pelletHeight * 0.15, A.z),
            new THREE.Vector3(A.x, y_bot_ni, A.z),
          ],
          false,
          'centripetal',
          0.4,
        );
        const phaseH = (k * 0.173) % 1;
        hStreams.push({
          points: sampleCurve(pCurve, 18),
          phases: [
            phaseH,
            (phaseH + 0.2) % 1,
            (phaseH + 0.4) % 1,
            (phaseH + 0.6) % 1,
            (phaseH + 0.8) % 1,
          ],
        });
      }
    }

    const boxGeo = new THREE.BoxGeometry(pelletSize, pelletHeight, pelletSize);
    const edges = new THREE.EdgesGeometry(boxGeo);
    boxGeo.dispose();

    const first = coord(order[0][0], order[0][1]);
    const last = coord(order[order.length - 1][0], order[order.length - 1][1]);

    return {
      pellets: items,
      pelletEdgesGeo: edges,
      bridges: strapList,
      electronStreams: eStreams,
      totalElectrons: eStreams.reduce((acc, s) => acc + s.phases.length, 0),
      holeStreams: hStreams,
      totalHoles: hStreams.reduce((acc, s) => acc + s.phases.length, 0),
      posLeadPadX: first.x,
      negLeadPadX: last.x,
    };
  }, [width, length, gridN, pelletHeight, pelletSize, y_top_cu, y_bot_cu, y_top_ni, y_bot_ni]);

  useEffect(() => {
    return () => {
      pelletEdgesGeo.dispose();
    };
  }, [pelletEdgesGeo]);

  const electronCoreRef = useRef<THREE.InstancedMesh>(null);
  const electronHaloRef = useRef<THREE.InstancedMesh>(null);
  const electronHaloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const holeCoreRef = useRef<THREE.InstancedMesh>(null);
  const progressRef = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const posTmp = useMemo(() => new THREE.Vector3(), []);

  const dT = Math.max(0, T_h - T_c);

  useFrame((_state, delta) => {
    if (!crystalXray) return;

    // Power-proportional electron dynamics (P_elec = V * I):
    // Scales active carrier count, drift velocity, bead scale, and glow intensity cleanly with P_elec
    const pEff = Math.max(0, P_elec);
    const pSqrt = Math.sqrt(Math.min(25, pEff)); // perceptive curve across 0.05..15+ W
    const active = dT > 0.5 && pEff > 0.002 && I_load > 0.002;
    const speed = active ? THREE.MathUtils.clamp(0.18 + 0.42 * pSqrt + 0.20 * I_load, 0.18, 3.0) : 0;
    progressRef.current = (progressRef.current + delta * speed) % 1000;
    const tClock = progressRef.current;

    // Scale active carriers per couple from 1 (tiny P) -> 3 (~1 W) -> 6 (high P >= 6 W)
    const pRatio = THREE.MathUtils.clamp(pSqrt / Math.sqrt(8.0), 0, 1);
    const activeElectronsPerStream = !active
      ? 0
      : Math.max(1, Math.min(6, Math.round(1 + pRatio * 5)));
    const activeHolesPerStream = !active
      ? 0
      : Math.max(1, Math.min(5, Math.round(1 + pRatio * 4)));

    const energyScale = THREE.MathUtils.lerp(0.76, 1.24, pRatio);
    const haloScaleMult = THREE.MathUtils.lerp(1.45, 2.25, pRatio);

    if (electronHaloMatRef.current) {
      electronHaloMatRef.current.opacity = active ? THREE.MathUtils.lerp(0.24, 0.76, pRatio) : 0.12;
    }

    // Update continuous corner-filleted Electron streamlines (Bridge -> N-leg -> Bridge)
    let eIdx = 0;
    for (let s = 0; s < electronStreams.length; s++) {
      const stream = electronStreams[s];
      for (let p = 0; p < activeElectronsPerStream; p++) {
        // Space active carriers evenly around [0..1) cycle according to active count
        const basePhase = (stream.phases[0] + p / activeElectronsPerStream) % 1;
        const uLinear = (basePhase + tClock) % 1;
        const uPhys = THREE.MathUtils.clamp(uLinear + 0.04 * Math.sin(uLinear * Math.PI * 2), 0, 0.9999);
        interpolateSampled(stream.points, uPhys, posTmp);

        const jitter = active ? Math.sin(uLinear * 12.56 + eIdx) * pelletSize * 0.045 : 0;
        dummy.position.set(posTmp.x + jitter, posTmp.y, posTmp.z - jitter);
        const fade = (0.72 + 0.32 * Math.sin(uLinear * Math.PI)) * energyScale;
        dummy.scale.setScalar(fade);
        dummy.updateMatrix();

        if (electronCoreRef.current) electronCoreRef.current.setMatrixAt(eIdx, dummy.matrix);
        if (electronHaloRef.current) {
          dummy.scale.setScalar(fade * haloScaleMult);
          dummy.updateMatrix();
          electronHaloRef.current.setMatrixAt(eIdx, dummy.matrix);
        }
        eIdx++;
      }
    }
    if (electronCoreRef.current) {
      electronCoreRef.current.count = eIdx;
      electronCoreRef.current.instanceMatrix.needsUpdate = true;
    }
    if (electronHaloRef.current) {
      electronHaloRef.current.count = eIdx;
      electronHaloRef.current.instanceMatrix.needsUpdate = true;
    }

    // Update positive Hole transport (Hot -> Cold down P-type legs)
    let hIdx = 0;
    if (holeCoreRef.current) {
      for (let s = 0; s < holeStreams.length; s++) {
        const stream = holeStreams[s];
        for (let p = 0; p < activeHolesPerStream; p++) {
          const basePhase = (stream.phases[0] + p / activeHolesPerStream) % 1;
          const u = (basePhase + tClock * 0.85) % 1;
          interpolateSampled(stream.points, u, posTmp);
          const jitter = active ? Math.cos(u * 9.42 + hIdx) * pelletSize * 0.055 : 0;
          dummy.position.set(posTmp.x + jitter, posTmp.y, posTmp.z + jitter * 0.7);
          dummy.scale.setScalar((0.68 + 0.38 * Math.sin(u * Math.PI)) * energyScale);
          dummy.updateMatrix();
          holeCoreRef.current.setMatrixAt(hIdx, dummy.matrix);
          hIdx++;
        }
      }
      holeCoreRef.current.count = hIdx;
      holeCoreRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  const topCeramicMat = useThermalMaterial(thermalView, {
    mode: 1,
    scaleMin: T_min,
    scaleMax: T_max,
    tempTop: T_h + 1.5,
    tempBot: T_h,
    tempEdge: Math.max(T_min, T_h - 3.0),
    dimX: width,
    dimY: ceramicThick,
    dimZ: length,
    coreRadius: width * 0.36,
  });

  const botCeramicMat = useThermalMaterial(thermalView, {
    mode: 1,
    scaleMin: T_min,
    scaleMax: T_max,
    tempTop: T_c + 1.0,
    tempBot: T_c,
    tempEdge: Math.max(T_min, T_c - 3.0),
    dimX: width,
    dimY: ceramicThick,
    dimZ: length,
    coreRadius: width * 0.36,
  });

  const pelletThermalMat = useThermalMaterial(thermalView, {
    mode: 2,
    scaleMin: T_min,
    scaleMax: T_max,
    tempTop: T_h,
    tempBot: T_c,
    dimX: width,
    dimY: pelletHeight,
    dimZ: length,
    coreRadius: width * 0.5,
  });

  const electronRadius = Math.max(0.00044, pelletSize * 0.16);
  const holeRadius = Math.max(0.00040, pelletSize * 0.145);

  const cornerOffsetX = width * 0.455;
  const cornerOffsetZ = length * 0.455;

  return (
    <group position={position}>
      {/* ── 1. Top Alumina (Al2O3) DBC Ceramic Substrate ── */}
      <mesh key={topCeramicMat ? 'top-thm' : 'top-pbr'} position={[0, y_top_cer, 0]} material={topCeramicMat ?? undefined} castShadow receiveShadow>
        <boxGeometry args={[width, ceramicThick, length]} />
        {!topCeramicMat && (
          <meshStandardMaterial
            color="#ffffff"
            roughness={0.22}
            metalness={0.04}
            emissive="#cbd5e1"
            emissiveIntensity={0.10}
          />
        )}
      </mesh>

      {/* ── 2. Bottom Alumina (Al2O3) DBC Ceramic Substrate ── */}
      <mesh key={botCeramicMat ? 'bot-thm' : 'bot-pbr'} position={[0, y_bot_cer, 0]} material={botCeramicMat ?? undefined} castShadow receiveShadow>
        <boxGeometry args={[width, ceramicThick, length]} />
        {!botCeramicMat && (
          <meshStandardMaterial
            color="#ffffff"
            roughness={0.22}
            metalness={0.04}
            emissive="#cbd5e1"
            emissiveIntensity={0.10}
          />
        )}
      </mesh>

      {/* ── 3. Hamiltonian Serpentine Top & Bottom Copper Shunt Bridges ── */}
      {bridges.map((b, idx) => {
        const y = b.isTop ? y_top_cu : y_bot_cu;
        const m = b.isTop ? topCeramicMat : botCeramicMat;
        return (
          <mesh
            key={`br-${idx}-${m ? 'thm' : 'pbr'}`}
            position={[b.x, y, b.z]}
            material={m ?? undefined}
          >
            <boxGeometry args={[b.w, copperPadThick, b.d]} />
            {!m && <meshStandardMaterial color="#d97736" metalness={0.92} roughness={0.22} />}
          </mesh>
        );
      })}

      {/* Bottom Cold Lead-Out Copper Traces connecting Leg 0 (+ Red) and Leg Last (- Black) directly to Terminals */}
      <mesh position={[(posLeadPadX + width / 2) * 0.5, y_bot_cu, redZ]}>
        <boxGeometry args={[Math.max(0.002, width / 2 - posLeadPadX + pelletSize), copperPadThick, pelletSize * 0.95]} />
        <meshStandardMaterial color="#d97736" metalness={0.92} roughness={0.22} />
      </mesh>
      <mesh position={[(negLeadPadX + width / 2) * 0.5, y_bot_cu, blackZ]}>
        <boxGeometry args={[Math.max(0.002, width / 2 - negLeadPadX + pelletSize), copperPadThick, pelletSize * 0.95]} />
        <meshStandardMaterial color="#d97736" metalness={0.92} roughness={0.22} />
      </mesh>

      {/* ── 4. 4 Corner Ceramic Structural Standoff Pins (subtle architectural detail) ── */}
      {[-cornerOffsetX, cornerOffsetX].map((cx, xi) =>
        [-cornerOffsetZ, cornerOffsetZ].map((cz, zi) => (
          <mesh key={`st-${xi}-${zi}`} position={[cx, 0, cz]}>
            <cylinderGeometry args={[0.00055, 0.00055, thickness - 2 * ceramicThick, 8]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.5} metalness={0.05} />
          </mesh>
        ))
      )}

      {/* ── 5. Bi2Te3 Semiconductor Pellets + Ni/Sn Diffusion Barrier Solder Caps ── */}
      {pellets.map(({ x, z, isP }, i) => (
        <group key={i} position={[x, 0, z]}>
          {/* Top Nickel/Solder Diffusion Barrier Cap */}
          <mesh position={[0, y_top_ni, 0]}>
            <boxGeometry args={[pelletSize * 1.03, niCapThick, pelletSize * 1.03]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.20} />
          </mesh>

          {/* Bottom Nickel/Solder Diffusion Barrier Cap */}
          <mesh position={[0, y_bot_ni, 0]}>
            <boxGeometry args={[pelletSize * 1.03, niCapThick, pelletSize * 1.03]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.20} />
          </mesh>

          {/* Bi2Te3 Crystal Column */}
          <mesh
            key={`pel-${pelletThermalMat ? 'thm' : crystalXray ? 'xray' : 'solid'}`}
            material={pelletThermalMat ?? undefined}
            castShadow={!crystalXray}
          >
            <boxGeometry args={[pelletSize, pelletHeight, pelletSize]} />
            {!pelletThermalMat && (
              crystalXray ? (
                <meshStandardMaterial
                  color={isP ? '#f59e0b' : '#0284c7'}
                  transparent
                  opacity={0.24}
                  roughness={0.14}
                  metalness={0.22}
                  depthWrite={false}
                />
              ) : (
                <meshStandardMaterial
                  color={isP ? '#94a3b8' : '#475569'}
                  metalness={0.82}
                  roughness={0.28}
                />
              )
            )}
          </mesh>

          {/* Crisp Crystal Structural Wireframe Edges when in X-Ray Electron mode */}
          {crystalXray && (
            <lineSegments geometry={pelletEdgesGeo}>
              <lineBasicMaterial
                color={isP ? '#fbbf24' : '#38bdf8'}
                transparent
                opacity={0.42}
              />
            </lineSegments>
          )}
        </group>
      ))}

      {/* ── 6. Continuous Serpentine Electron (e⁻) Cores + Glow Halos & Hole (h⁺) Carriers ── */}
      {crystalXray && (
        <>
          {/* Bright Electron Cores */}
          <instancedMesh
            key={`ec-${totalElectrons}`}
            ref={electronCoreRef}
            args={[undefined, undefined, totalElectrons]}
          >
            <sphereGeometry args={[electronRadius, 10, 10]} />
            <meshBasicMaterial color="#e0f2fe" toneMapped={false} />
          </instancedMesh>

          {/* Additive Cyan Electron Glow Aura */}
          <instancedMesh
            key={`eh-${totalElectrons}`}
            ref={electronHaloRef}
            args={[undefined, undefined, totalElectrons]}
          >
            <sphereGeometry args={[electronRadius, 10, 10]} />
            <meshBasicMaterial
              ref={electronHaloMatRef}
              color="#06b6d4"
              transparent
              opacity={0.45}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </instancedMesh>

          {/* Positive Hole (h⁺) Cores in P-type legs */}
          <instancedMesh
            key={`hc-${totalHoles}`}
            ref={holeCoreRef}
            args={[undefined, undefined, totalHoles]}
          >
            <sphereGeometry args={[holeRadius, 10, 10]} />
            <meshBasicMaterial color="#fbbf24" toneMapped={false} />
          </instancedMesh>
        </>
      )}

      {/* ── 7. Right-Edge (+X) Terminal Lugs aligned strictly to Red (+) & Black (-) Copper Tabs ── */}
      {/* Positive (+) Red Terminal Lug at row gridN-2 */}
      <group position={[width / 2 + 0.0022, y_bot_cer + ceramicThick * 0.85, redZ]}>
        <mesh castShadow>
          <boxGeometry args={[0.0044, 0.0020, 0.0042]} />
          <meshStandardMaterial color="#d48446" metalness={0.92} roughness={0.22} />
        </mesh>
        <mesh position={[0.0012, 0.0014, 0]} castShadow>
          <boxGeometry args={[0.0036, 0.0028, 0.0046]} />
          <meshStandardMaterial color="#dc2626" roughness={0.38} />
        </mesh>
        <mesh position={[0.0032, 0.0014, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.0012, 0.0012, 0.0032, 12]} />
          <meshStandardMaterial color="#eab308" metalness={0.94} roughness={0.18} />
        </mesh>
      </group>

      {/* Negative (-) Black Terminal Lug at row gridN-1 */}
      <group position={[width / 2 + 0.0022, y_bot_cer + ceramicThick * 0.85, blackZ]}>
        <mesh castShadow>
          <boxGeometry args={[0.0044, 0.0020, 0.0042]} />
          <meshStandardMaterial color="#d48446" metalness={0.92} roughness={0.22} />
        </mesh>
        <mesh position={[0.0012, 0.0014, 0]} castShadow>
          <boxGeometry args={[0.0036, 0.0028, 0.0046]} />
          <meshStandardMaterial color="#181a1d" roughness={0.38} />
        </mesh>
        <mesh position={[0.0032, 0.0014, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.0012, 0.0012, 0.0032, 12]} />
          <meshStandardMaterial color="#eab308" metalness={0.94} roughness={0.18} />
        </mesh>
      </group>
    </group>
  );
}
