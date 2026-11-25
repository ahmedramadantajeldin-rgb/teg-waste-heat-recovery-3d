import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface AirflowParticlesProps {
  mode: 'natural' | 'forced' | 'mixed';
  V_air: number;         // m/s — drives stream count, velocity, streak elongation, swirl & thermal rise
  N_fins: number;
  fin_S: number;
  fin_t?: number;
  fin_H: number;
  fin_L: number;
  W_base: number;
  finType?: 'plate' | 'pin';
  fanX?: number;
  fanDepth?: number;
  fanSize?: number;
  fanOffsetY?: number;   // fanY - y_fin_mid so streamlines emit from true rotor hub center
  T_c?: number;
  T_ambient?: number;
  position?: [number, number, number];
}

const STREAMLINE_COUNT = 68;
const CURVE_SAMPLES = 44;
const RADIAL_SEGMENTS = 5;
const SWIRL_TRACER_COUNT = 120;

const STREAM_VERTEX_SHADER = /* glsl */ `
  attribute float aProgress;
  attribute float aSeed;
  attribute float aLineNorm;
  attribute float aSpeedMult;
  attribute float aTubeSign;

  uniform float uRadiusScale;
  uniform float uBuoyancyLift;

  varying float vProgress;
  varying float vSeed;
  varying float vLineNorm;
  varying float vSpeedMult;
  varying float vFresnel;

  void main() {
    vProgress = aProgress;
    vSeed = aSeed;
    vLineNorm = aLineNorm;
    vSpeedMult = aSpeedMult;

    // Slight dynamic tube width adjustment by air speed while preserving tapered ends
    float endTaper = smoothstep(0.0, 0.08, aProgress) * smoothstep(1.0, 0.78, aProgress);
    vec3 radialOffset = normal * ((uRadiusScale - 1.0) * 0.00055 * (0.35 + 0.65 * endTaper));

    // Real aerodynamic thermal buoyancy downstream (+X exhaust lifts smoothly at lower Re / high ΔT)
    float wakeFactor = smoothstep(0.60, 1.0, aProgress);
    float liftY = uBuoyancyLift * wakeFactor * wakeFactor * (0.65 + 0.55 * aSeed);
    float flareZ = aTubeSign * wakeFactor * 0.0035 * (0.5 + 0.5 * uBuoyancyLift * 18.0);

    vec3 displaced = position + radialOffset + vec3(0.0, liftY, flareZ);
    vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);

    vec3 viewN = normalize(normalMatrix * normal);
    vec3 viewDir = normalize(-mvPos.xyz);
    vFresnel = clamp(abs(dot(viewN, viewDir)), 0.0, 1.0);

    gl_Position = projectionMatrix * mvPos;
  }
`;

const STREAM_FRAGMENT_SHADER = /* glsl */ `
  uniform float uPhase;
  uniform float uVNorm;
  uniform float uActiveFrac;
  uniform float uPulseRepeat;
  uniform float uPulseTail;
  uniform float uThermalRise;
  uniform float uOpacity;

  varying float vProgress;
  varying float vSeed;
  varying float vLineNorm;
  varying float vSpeedMult;
  varying float vFresnel;

  void main() {
    // Smoothly scale active streamline count from 32% at low V_air up to 100% at max V_air
    float activeMask = 1.0 - smoothstep(uActiveFrac - 0.06, uActiveFrac + 0.01, vLineNorm);
    if (activeMask <= 0.01) discard;

    // Smooth entry & wake dissipation so streamlines never clip abruptly (strict edge0 < edge1!)
    float envIn = smoothstep(0.0, 0.10, vProgress);
    float envOut = 1.0 - smoothstep(0.72, 1.0, vProgress);
    float envelope = envIn * envOut;
    if (envelope <= 0.005) discard;

    // Traveling asymmetric comet pulse along the curved streamline (smooth sharp head + silky tail)
    float flowCoord = fract(vProgress * uPulseRepeat - uPhase * vSpeedMult + vSeed);
    float headZone = 1.0 - smoothstep(0.90, 1.0, flowCoord);
    float tailLen = clamp(uPulseTail, 0.16, 0.56);
    float tailZone = smoothstep(1.0 - tailLen, 0.92, flowCoord);
    float pulse = pow(tailZone, 2.0) * headZone;

    // Continuous delicate guide streamtube beneath traveling pulses (wind-tunnel streamline look)
    float guideAlpha = mix(0.05, 0.16, uVNorm) * pow(vFresnel, 0.8);
    float pulseAlpha = pulse * mix(0.62, 0.96, uVNorm) * pow(vFresnel, 0.45);
    float alpha = (guideAlpha + pulseAlpha) * envelope * activeMask * uOpacity;
    if (alpha <= 0.01) discard;

    // Physical thermal color progression: cool azure intake -> core cyan -> heated exhaust plume
    vec3 colIntake = mix(vec3(0.08, 0.56, 0.92), vec3(0.32, 0.80, 0.99), uVNorm);
    vec3 colCore = mix(vec3(0.10, 0.74, 0.95), vec3(0.68, 0.94, 1.00), uVNorm * 0.75 + pulse * 0.25);
    vec3 colWarmExit = mix(vec3(0.24, 0.82, 0.94), vec3(0.98, 0.68, 0.28), uThermalRise);

    float coreMix = smoothstep(0.22, 0.56, vProgress);
    float wakeMix = smoothstep(0.55, 0.92, vProgress);
    vec3 baseCol = mix(colIntake, colCore, coreMix);
    baseCol = mix(baseCol, colWarmExit, wakeMix);

    // Bright icy-white highlight peak inside leading pulse core
    vec3 peakCol = mix(baseCol, vec3(0.94, 0.98, 1.0), 0.78 * pulse * (0.45 + 0.55 * uVNorm));
    vec3 finalCol = mix(baseCol, peakCol, pulse);

    gl_FragColor = vec4(finalCol, clamp(alpha, 0.0, 0.95));
  }
`;

const TRACER_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aAlpha;

  uniform float uPixelRatio;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    float dist = max(0.08, -mvPos.z);
    gl_PointSize = clamp(aSize * uPixelRatio / dist, 1.5, 22.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const TRACER_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    if (r2 > 1.0) discard;
    float soft = exp(-r2 * 4.2) * (1.0 - r2);
    gl_FragColor = vec4(vColor, soft * vAlpha);
  }
`;

interface TracerSeed {
  progress: number;
  angle: number;
  radialFrac: number;
  channelZ: number;
  yFin: number;
  speedJitter: number;
}

/**
 * Low-discrepancy sequence rank in [0, 1) so throttling active streamline count
 * stays spatially balanced across the entire rotor disc & fin width.
 */
function vanDerCorput(n: number): number {
  let v = 0;
  let denom = 1;
  let x = n;
  while (x > 0) {
    denom *= 2;
    if (x & 1) v += 1 / denom;
    x >>= 1;
  }
  return v;
}

/**
 * Build merged smooth tubular geometry along N CatmullRomCurve3 CFD streamlines
 * spanning suction intake -> helical fan discharge -> fin channels -> buoyant exhaust wake.
 */
function buildStreamlinesGeometry(params: {
  N_fins: number;
  fin_S: number;
  fin_t: number;
  fin_H: number;
  fin_L: number;
  W_base: number;
  finType: 'plate' | 'pin';
  fanX: number;
  fanDepth: number;
  fanSize: number;
  fanOffsetY: number;
}): THREE.BufferGeometry {
  const {
    N_fins,
    fin_S,
    fin_t,
    fin_H,
    fin_L,
    W_base,
    finType,
    fanX,
    fanDepth,
    fanSize,
    fanOffsetY,
  } = params;

  const lengthX = fin_L > 0 ? fin_L : 0.08;
  const xIntake = fanX - fanDepth * 0.25;
  const xFanFace = fanX + fanDepth * 0.52;
  const xFinIn = -lengthX * 0.50;
  const xFinOut = lengthX * 0.50;
  const xWakeOut = lengthX * 0.50 + Math.max(0.050, lengthX * 0.65);

  const fanBoreR = fanSize * 0.435;
  const hubR = fanSize * 0.145;
  const clampedN = Math.max(2, Math.min(30, Math.round(N_fins)));
  const effectiveT = Math.max(0.0005, fin_t);
  const effectiveS = Math.max(0.001, fin_S);
  const totalFinsSpanZ = clampedN * effectiveT + (clampedN - 1) * effectiveS;
  const zGapStart = -totalFinsSpanZ * 0.5 + effectiveT + effectiveS * 0.5;
  const nGaps = Math.max(1, clampedN - 1);

  const goldenAngle = 2.399963229728653;

  // First generate fan disc origin coordinates and sort by azimuthal Z/Y for tangle-free streamlines
  const specs: {
    angle: number;
    r: number;
    yFan: number;
    zFan: number;
    zTarget: number;
    yFin: number;
    speedMult: number;
    lineNorm: number;
    seed: number;
    pinWaveAmp: number;
  }[] = [];

  for (let i = 0; i < STREAMLINE_COUNT; i++) {
    const frac = (i + 0.5) / STREAMLINE_COUNT;
    const angle = i * goldenAngle;
    const r = THREE.MathUtils.lerp(hubR * 1.18, fanBoreR * 0.90, Math.sqrt(frac));
    const yFanLocal = Math.sin(angle) * r;
    const zFan = Math.cos(angle) * r;

    // Normalized [-1, 1] across blade sweep mapped linearly to open fin channels (prevents stream tangle)
    const normZ = THREE.MathUtils.clamp(zFan / (fanBoreR * 0.92), -1, 1);
    const normY = THREE.MathUtils.clamp(yFanLocal / (fanBoreR * 0.92), -1, 1);

    let zTarget: number;
    if (finType === 'plate') {
      const gapFloat = THREE.MathUtils.clamp(((normZ + 1) * 0.5) * nGaps - 0.5, 0, Math.max(0, nGaps - 1));
      const chIdx = Math.round(gapFloat);
      const subJitter = ((i * 7 % 11) / 10 - 0.5) * Math.min(effectiveS * 0.44, 0.0022);
      zTarget = zGapStart + chIdx * (effectiveT + effectiveS) + subJitter;
    } else {
      const zSpan = Math.min(W_base * 0.84, totalFinsSpanZ);
      zTarget = normZ * (zSpan * 0.46);
    }

    const yFin = normY * (fin_H * 0.40);
    // Blade mid-span carries peak axial momentum
    const radialNorm = (r - hubR) / Math.max(0.005, fanBoreR - hubR);
    const midSpanBoost = 1.0 + 0.22 * Math.sin(radialNorm * Math.PI);

    specs.push({
      angle,
      r,
      yFan: fanOffsetY + yFanLocal,
      zFan,
      zTarget,
      yFin,
      speedMult: midSpanBoost * (0.90 + ((i * 13) % 10) * 0.02),
      lineNorm: vanDerCorput(i + 1),
      seed: ((i * 0.61803398875) % 1),
      pinWaveAmp: finType === 'pin' ? Math.min(effectiveS * 0.55, 0.0032) : 0,
    });
  }

  const ptsPerCurve = CURVE_SAMPLES + 1;
  const vertsPerCurve = ptsPerCurve * RADIAL_SEGMENTS;
  const trisPerCurve = CURVE_SAMPLES * RADIAL_SEGMENTS * 2;

  const totalVerts = STREAMLINE_COUNT * vertsPerCurve;
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const aProgress = new Float32Array(totalVerts);
  const aSeed = new Float32Array(totalVerts);
  const aLineNorm = new Float32Array(totalVerts);
  const aSpeedMult = new Float32Array(totalVerts);
  const aTubeSign = new Float32Array(totalVerts);
  const indices: number[] = [];

  const upAxis = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  const binorm = new THREE.Vector3();
  const vNorm = new THREE.Vector3();

  const xPlenum1 = THREE.MathUtils.lerp(xFanFace, xFinIn, 0.38);
  const xPlenum2 = THREE.MathUtils.lerp(xFanFace, xFinIn, 0.78);
  const xFinMid = (xFinIn + xFinOut) * 0.5;
  const xWakeMid = THREE.MathUtils.lerp(xFinOut, xWakeOut, 0.48);

  let vOffset = 0;

  for (let sIdx = 0; sIdx < STREAMLINE_COUNT; sIdx++) {
    const s = specs[sIdx];
    const swirlTwist1 = 0.28;
    const swirlTwist2 = 0.14;

    const ySwirl1 = fanOffsetY + Math.sin(s.angle + swirlTwist1) * (s.r * 0.96);
    const zSwirl1 = Math.cos(s.angle + swirlTwist1) * (s.r * 0.96);

    const ySwirl2 = THREE.MathUtils.lerp(fanOffsetY + Math.sin(s.angle + swirlTwist2) * s.r, s.yFin, 0.62);
    const zSwirl2 = THREE.MathUtils.lerp(Math.cos(s.angle + swirlTwist2) * s.r, s.zTarget, 0.68);

    const pinPhase = sIdx * 1.4;
    const wakeSide = Math.sign(s.zTarget || (sIdx % 2 === 0 ? 1 : -1));

    const ctrlPts = [
      new THREE.Vector3(xIntake, s.yFan * 0.98 + fanOffsetY * 0.02, s.zFan * 1.03),
      new THREE.Vector3(xFanFace, s.yFan, s.zFan),
      new THREE.Vector3(xPlenum1, ySwirl1, zSwirl1),
      new THREE.Vector3(xPlenum2, ySwirl2, zSwirl2),
      new THREE.Vector3(xFinIn, s.yFin, s.zTarget),
      new THREE.Vector3(
        THREE.MathUtils.lerp(xFinIn, xFinMid, 0.5),
        s.yFin,
        s.zTarget + Math.sin(pinPhase + 1.5) * s.pinWaveAmp,
      ),
      new THREE.Vector3(
        xFinMid,
        s.yFin,
        s.zTarget + Math.sin(pinPhase + 3.1) * s.pinWaveAmp,
      ),
      new THREE.Vector3(
        THREE.MathUtils.lerp(xFinMid, xFinOut, 0.5),
        s.yFin,
        s.zTarget + Math.sin(pinPhase + 4.7) * s.pinWaveAmp,
      ),
      new THREE.Vector3(xFinOut, s.yFin, s.zTarget),
      new THREE.Vector3(xWakeMid, s.yFin + 0.0018, s.zTarget + wakeSide * 0.0022),
      new THREE.Vector3(xWakeOut, s.yFin + 0.0045, s.zTarget + wakeSide * 0.0055),
    ];

    const curve = new THREE.CatmullRomCurve3(ctrlPts, false, 'catmullrom', 0.45);
    const baseRadius = 0.00058;

    for (let j = 0; j < ptsPerCurve; j++) {
      const u = j / CURVE_SAMPLES;
      const pt = curve.getPoint(u);
      curve.getTangent(u, tangent).normalize();

      side.crossVectors(tangent, upAxis);
      if (side.lengthSq() < 1e-5) side.set(0, 0, 1);
      side.normalize();
      binorm.crossVectors(side, tangent).normalize();

      // Smooth aero filament profile (gentle taper near entry/exhaust)
      const rFactor = 0.65 + 0.35 * Math.sin(u * Math.PI);
      const rad = baseRadius * rFactor;

      for (let k = 0; k < RADIAL_SEGMENTS; k++) {
        const theta = (k / RADIAL_SEGMENTS) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        vNorm.set(0, 0, 0).addScaledVector(side, cosT).addScaledVector(binorm, sinT).normalize();
        const vi = vOffset + j * RADIAL_SEGMENTS + k;

        positions[vi * 3 + 0] = pt.x + vNorm.x * rad;
        positions[vi * 3 + 1] = pt.y + vNorm.y * rad;
        positions[vi * 3 + 2] = pt.z + vNorm.z * rad;

        normals[vi * 3 + 0] = vNorm.x;
        normals[vi * 3 + 1] = vNorm.y;
        normals[vi * 3 + 2] = vNorm.z;

        aProgress[vi] = u;
        aSeed[vi] = s.seed;
        aLineNorm[vi] = s.lineNorm;
        aSpeedMult[vi] = s.speedMult;
        aTubeSign[vi] = wakeSide;
      }

      if (j < CURVE_SAMPLES) {
        for (let k = 0; k < RADIAL_SEGMENTS; k++) {
          const nextK = (k + 1) % RADIAL_SEGMENTS;
          const a = vOffset + j * RADIAL_SEGMENTS + k;
          const b = vOffset + j * RADIAL_SEGMENTS + nextK;
          const c = vOffset + (j + 1) * RADIAL_SEGMENTS + nextK;
          const d = vOffset + (j + 1) * RADIAL_SEGMENTS + k;
          indices.push(a, b, c, a, c, d);
        }
      }
    }

    vOffset += vertsPerCurve;
  }

  // Reserve capacity safety check
  if (indices.length > STREAMLINE_COUNT * trisPerCurve * 3) {
    indices.length = STREAMLINE_COUNT * trisPerCurve * 3;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('aProgress', new THREE.BufferAttribute(aProgress, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
  geo.setAttribute('aLineNorm', new THREE.BufferAttribute(aLineNorm, 1));
  geo.setAttribute('aSpeedMult', new THREE.BufferAttribute(aSpeedMult, 1));
  geo.setAttribute('aTubeSign', new THREE.BufferAttribute(aTubeSign, 1));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

/**
 * High-Detail CFD Aerodynamic Airflow Visualization:
 * - Smooth curved 3D CFD streamtubes rendered with custom Fresnel-softened traveling pulses
 * - Real physical flow progression: fan suction -> helical blade swirl -> open fin slots -> heated buoyant exhaust
 * - Volumetric soft-Gaussian helical swirl micro-tracers inside rotor discharge & wake (zero blocky particles)
 * - StrictMode-safe resource lifecycle; all flow metrics scale seamlessly with V_air & ΔT without rebuilding geometry
 */
export function AirflowParticles({
  mode,
  V_air,
  N_fins,
  fin_S,
  fin_t = 0.002,
  fin_H,
  fin_L,
  W_base,
  finType = 'plate',
  fanX = -0.084,
  fanDepth = 0.021,
  fanSize = 0.061,
  fanOffsetY = 0,
  T_c = 40,
  T_ambient = 25,
  position = [0, 0, 0],
}: AirflowParticlesProps) {
  const [streamGeo, setStreamGeo] = useState<THREE.BufferGeometry | null>(null);
  const [streamMat, setStreamMat] = useState<THREE.ShaderMaterial | null>(null);
  const [tracerGeo, setTracerGeo] = useState<THREE.BufferGeometry | null>(null);
  const [tracerMat, setTracerMat] = useState<THREE.ShaderMaterial | null>(null);

  const streamMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const tracerGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const tracerMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const tracerSeedsRef = useRef<TracerSeed[]>([]);
  const phaseRef = useRef(0);

  // ── 1. Parametric CFD Streamline Geometry (rebuilt only when mechanical geometry changes) ──
  useEffect(() => {
    const geo = buildStreamlinesGeometry({
      N_fins,
      fin_S,
      fin_t,
      fin_H,
      fin_L,
      W_base,
      finType,
      fanX,
      fanDepth,
      fanSize,
      fanOffsetY,
    });
    setStreamGeo(geo);
    return () => {
      geo.dispose();
    };
  }, [N_fins, fin_S, fin_t, fin_H, fin_L, W_base, finType, fanX, fanDepth, fanSize, fanOffsetY]);

  // ── 2. StrictMode-safe Custom ShaderMaterials & Gaussian Swirl Tracer Buffers ──
  useEffect(() => {
    const sMat = new THREE.ShaderMaterial({
      vertexShader: STREAM_VERTEX_SHADER,
      fragmentShader: STREAM_FRAGMENT_SHADER,
      uniforms: {
        uPhase: { value: 0 },
        uVNorm: { value: 0.5 },
        uActiveFrac: { value: 0.7 },
        uPulseRepeat: { value: 1.6 },
        uPulseTail: { value: 0.34 },
        uThermalRise: { value: 0.25 },
        uOpacity: { value: 0.85 },
        uRadiusScale: { value: 1.0 },
        uBuoyancyLift: { value: 0.008 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });
    streamMatRef.current = sMat;
    setStreamMat(sMat);

    // Tracer seeds for gentle helical rotor mist
    const seeds: TracerSeed[] = [];
    const posArr = new Float32Array(SWIRL_TRACER_COUNT * 3);
    const colArr = new Float32Array(SWIRL_TRACER_COUNT * 3);
    const sizeArr = new Float32Array(SWIRL_TRACER_COUNT);
    const alphaArr = new Float32Array(SWIRL_TRACER_COUNT);

    for (let i = 0; i < SWIRL_TRACER_COUNT; i++) {
      const chFrac = ((i * 7) % 23) / 22 - 0.5;
      seeds.push({
        progress: (i / SWIRL_TRACER_COUNT + Math.random() * 0.04) % 1,
        angle: Math.random() * Math.PI * 2,
        radialFrac: 0.28 + 0.66 * Math.sqrt(Math.random()),
        channelZ: chFrac,
        yFin: (Math.random() - 0.5) * 0.80,
        speedJitter: 0.84 + Math.random() * 0.32,
      });
      sizeArr[i] = 0.0018;
      alphaArr[i] = 0;
    }
    tracerSeedsRef.current = seeds;

    const tGeo = new THREE.BufferGeometry();
    tGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    tGeo.setAttribute('aColor', new THREE.BufferAttribute(colArr, 3));
    tGeo.setAttribute('aSize', new THREE.BufferAttribute(sizeArr, 1));
    tGeo.setAttribute('aAlpha', new THREE.BufferAttribute(alphaArr, 1));
    tracerGeoRef.current = tGeo;
    setTracerGeo(tGeo);

    const tMat = new THREE.ShaderMaterial({
      vertexShader: TRACER_VERTEX_SHADER,
      fragmentShader: TRACER_FRAGMENT_SHADER,
      uniforms: {
        uPixelRatio: { value: Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    tracerMatRef.current = tMat;
    setTracerMat(tMat);

    return () => {
      streamMatRef.current = null;
      tracerGeoRef.current = null;
      tracerMatRef.current = null;
      sMat.dispose();
      tGeo.dispose();
      tMat.dispose();
    };
  }, []);

  const coldColor = useRef(new THREE.Color('#38bdf8'));
  const crispColor = useRef(new THREE.Color('#bae6fd'));
  const warmColor = useRef(new THREE.Color('#fbbf24'));
  const tmpColor = useRef(new THREE.Color());

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const vEff = mode === 'natural' ? 0.35 : Math.max(0, V_air);
    const vNorm = THREE.MathUtils.clamp(vEff / 15.0, 0, 1);

    // Phase advances smoothly without jumps when dragging V_air slider
    const flowSpeed = vEff <= 0.01 ? 0 : THREE.MathUtils.lerp(0.28, 2.35, Math.pow(vNorm, 0.85));
    phaseRef.current = (phaseRef.current + flowSpeed * dt) % 1000;

    // Lower airflow mass rate warms each parcel more for the same surface heat flux
    const dTSurface = Math.max(0, T_c - T_ambient);
    const thermalStrength = THREE.MathUtils.clamp(
      (dTSurface / 65.0) * THREE.MathUtils.lerp(1.15, 0.42, vNorm),
      0,
      1,
    );

    const sMat = streamMatRef.current;
    if (sMat) {
      sMat.uniforms.uPhase.value = phaseRef.current;
      sMat.uniforms.uVNorm.value = vNorm;
      sMat.uniforms.uActiveFrac.value = vEff <= 0.01 ? 0 : THREE.MathUtils.lerp(0.32, 1.0, Math.pow(vNorm, 0.72));
      sMat.uniforms.uPulseRepeat.value = THREE.MathUtils.lerp(1.15, 2.25, vNorm);
      sMat.uniforms.uPulseTail.value = THREE.MathUtils.lerp(0.18, 0.50, vNorm);
      sMat.uniforms.uThermalRise.value = thermalStrength;
      sMat.uniforms.uOpacity.value = vEff <= 0.01 ? 0 : THREE.MathUtils.lerp(0.68, 0.96, vNorm);
      sMat.uniforms.uRadiusScale.value = THREE.MathUtils.lerp(0.84, 1.24, vNorm);
      // Buoyancy curls upward strongly at low velocity + high surface temperature, straightens into fast horizontal jet at high V_air
      sMat.uniforms.uBuoyancyLift.value = THREE.MathUtils.lerp(0.018, 0.003, vNorm) * (0.45 + 0.85 * thermalStrength);
    }

    // Update smooth Gaussian swirl tracers inside fan discharge & exhaust wake
    const tGeo = tracerGeoRef.current;
    const tMat = tracerMatRef.current;
    const seeds = tracerSeedsRef.current;
    if (tGeo && tMat && seeds.length > 0) {
      tMat.uniforms.uPixelRatio.value = Math.min(2, state.gl.getPixelRatio());
      const posAttr = tGeo.attributes.position as THREE.BufferAttribute;
      const colAttr = tGeo.attributes.aColor as THREE.BufferAttribute;
      const sizeAttr = tGeo.attributes.aSize as THREE.BufferAttribute;
      const alphaAttr = tGeo.attributes.aAlpha as THREE.BufferAttribute;

      const lengthX = fin_L > 0 ? fin_L : 0.08;
      const xStart = fanX + fanDepth * 0.45;
      const xFinIn = -lengthX * 0.50;
      const xEnd = lengthX * 0.50 + Math.max(0.050, lengthX * 0.65);
      const spanX = Math.max(0.04, xEnd - xStart);
      const plenumSpan = Math.max(0.012, xFinIn - xStart);
      const fanBoreR = fanSize * 0.42;
      const clampedN = Math.max(2, Math.min(30, Math.round(N_fins)));
      const effectiveSpanZ = Math.min(W_base * 0.86, clampedN * fin_t + (clampedN - 1) * fin_S);

      const tracerSpeed = vEff <= 0.01 ? 0 : THREE.MathUtils.lerp(0.055, 0.68, vNorm);
      const swirlOmega = THREE.MathUtils.lerp(1.4, 7.2, vNorm);
      const activeTracers = vEff <= 0.01 ? 0 : Math.round(THREE.MathUtils.lerp(36, SWIRL_TRACER_COUNT, Math.pow(vNorm, 0.7)));
      const liftMax = THREE.MathUtils.lerp(0.016, 0.003, vNorm) * (0.45 + 0.85 * thermalStrength);

      for (let i = 0; i < SWIRL_TRACER_COUNT; i++) {
        if (i >= activeTracers) {
          alphaAttr.setX(i, 0);
          continue;
        }
        const s = seeds[i];
        s.progress = (s.progress + (tracerSpeed * s.speedJitter * dt) / spanX) % 1;
        // Swirl actively while still inside fan-to-fin plenum
        const x = xStart + s.progress * spanX;
        const inFinBlend = THREE.MathUtils.smoothstep((x - xStart) / plenumSpan, 0.05, 1.05);
        s.angle += swirlOmega * (1 - inFinBlend * 0.88) * dt;

        const yFan = fanOffsetY + Math.sin(s.angle) * (s.radialFrac * fanBoreR);
        const zFan = Math.cos(s.angle) * (s.radialFrac * fanBoreR);
        const yFin = s.yFin * fin_H;
        const zFin = s.channelZ * effectiveSpanZ;

        const wakeFac = THREE.MathUtils.smoothstep(s.progress, 0.58, 1.0);
        const y = THREE.MathUtils.lerp(yFan, yFin, inFinBlend) + liftMax * wakeFac * wakeFac;
        const z = THREE.MathUtils.lerp(zFan, zFin, inFinBlend) * (1 + wakeFac * 0.10);

        posAttr.setXYZ(i, x, y, z);

        const fade = Math.sin(s.progress * Math.PI);
        sizeAttr.setX(i, THREE.MathUtils.lerp(0.0022, 0.0040, vNorm) * (0.65 + 0.5 * fade));
        alphaAttr.setX(i, fade * THREE.MathUtils.lerp(0.24, 0.58, vNorm));

        tmpColor.current.copy(coldColor.current).lerp(crispColor.current, vNorm * 0.45);
        tmpColor.current.lerp(warmColor.current, wakeFac * thermalStrength * 0.85);
        colAttr.setXYZ(i, tmpColor.current.r, tmpColor.current.g, tmpColor.current.b);
      }

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;
    }
  });

  return (
    <group position={position}>
      {streamGeo && streamMat && (
        <mesh geometry={streamGeo} material={streamMat} frustumCulled={false} renderOrder={4} />
      )}
      {tracerGeo && tracerMat && (
        <points geometry={tracerGeo} material={tracerMat} frustumCulled={false} renderOrder={5} />
      )}
    </group>
  );
}
