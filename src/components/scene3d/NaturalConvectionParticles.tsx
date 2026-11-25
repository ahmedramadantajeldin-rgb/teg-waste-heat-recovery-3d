import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface NaturalConvectionParticlesProps {
  fin_H: number;
  fin_L: number;
  W_base: number;
  T_c?: number;
  T_ambient?: number;
  position?: [number, number, number];
}

const PLUME_COUNT = 28;
const PLUME_SAMPLES = 28;
const RADIAL_SEGS = 4;
const WISP_COUNT = 72;

const PLUME_VERT = /* glsl */ `
  attribute float aProgress;
  attribute float aSeed;
  varying float vProgress;
  varying float vSeed;
  varying float vFresnel;

  void main() {
    vProgress = aProgress;
    vSeed = aSeed;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vec3 viewN = normalize(normalMatrix * normal);
    vec3 viewDir = normalize(-mvPos.xyz);
    vFresnel = clamp(abs(dot(viewN, viewDir)), 0.0, 1.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const PLUME_FRAG = /* glsl */ `
  uniform float uPhase;
  uniform float uHeatNorm;

  varying float vProgress;
  varying float vSeed;
  varying float vFresnel;

  void main() {
    float env = smoothstep(0.0, 0.16, vProgress) * (1.0 - smoothstep(0.68, 1.0, vProgress));
    if (env <= 0.005) discard;

    float flowCoord = fract(vProgress * 1.45 - uPhase + vSeed);
    float head = 1.0 - smoothstep(0.88, 1.0, flowCoord);
    float tail = smoothstep(0.50, 0.90, flowCoord);
    float pulse = pow(tail, 1.8) * head;

    float alpha = (0.04 + 0.58 * pulse) * env * pow(vFresnel, 0.55) * mix(0.45, 0.85, uHeatNorm);
    if (alpha <= 0.01) discard;

    vec3 warmCol = mix(vec3(0.96, 0.64, 0.24), vec3(0.99, 0.48, 0.20), uHeatNorm);
    vec3 coolCol = vec3(0.45, 0.80, 0.98);
    vec3 col = mix(warmCol, coolCol, smoothstep(0.20, 0.88, vProgress));
    col = mix(col, vec3(1.0, 0.95, 0.88), pulse * 0.40);

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.85));
  }
`;

const WISP_VERT = /* glsl */ `
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
    gl_PointSize = clamp(aSize * uPixelRatio / dist, 1.5, 18.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const WISP_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    if (r2 > 1.0) discard;
    float soft = exp(-r2 * 4.5) * (1.0 - r2);
    gl_FragColor = vec4(vColor, soft * vAlpha);
  }
`;

/**
 * Natural Convection Buoyant Thermal Plumes:
 * - Curved rising S-streamtubes carrying warm convective pulses up and outward from heated fins
 * - Soft radial-Gaussian rising micro-wisps (zero blocky square pixels)
 * - Scales speed & warm thermal contrast directly with ΔT = T_c - T_ambient
 */
export function NaturalConvectionParticles({
  fin_H,
  fin_L,
  W_base,
  T_c = 45,
  T_ambient = 25,
  position = [0, 0, 0],
}: NaturalConvectionParticlesProps) {
  const [plumeGeo, setPlumeGeo] = useState<THREE.BufferGeometry | null>(null);
  const [plumeMat, setPlumeMat] = useState<THREE.ShaderMaterial | null>(null);
  const [wispGeo, setWispGeo] = useState<THREE.BufferGeometry | null>(null);
  const [wispMat, setWispMat] = useState<THREE.ShaderMaterial | null>(null);

  const plumeMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const wispGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const wispMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const wispSeedsRef = useRef<{ x: number; z: number; phase: number; speed: number }[]>([]);
  const phaseRef = useRef(0);

  useEffect(() => {
    const spanX = Math.max(0.04, fin_L * 0.92);
    const spanZ = Math.max(0.04, W_base * 0.92);
    const yBottom = -fin_H * 0.42;
    const yTop = fin_H * 1.15 + 0.025;

    const ptsPerCurve = PLUME_SAMPLES + 1;
    const vertsPerCurve = ptsPerCurve * RADIAL_SEGS;
    const totalVerts = PLUME_COUNT * vertsPerCurve;
    const positions = new Float32Array(totalVerts * 3);
    const normals = new Float32Array(totalVerts * 3);
    const aProgress = new Float32Array(totalVerts);
    const aSeed = new Float32Array(totalVerts);
    const indices: number[] = [];

    const sideAxis = new THREE.Vector3(1, 0, 0);
    const tangent = new THREE.Vector3();
    const right = new THREE.Vector3();
    const binorm = new THREE.Vector3();
    const nTmp = new THREE.Vector3();

    let vOff = 0;
    for (let i = 0; i < PLUME_COUNT; i++) {
      // Golden-ratio grid around heat sink perimeter + center plume
      const fx = ((i * 0.6180339887) % 1) - 0.5;
      const fz = ((i * 0.3819660113 + 0.25) % 1) - 0.5;
      const x0 = fx * spanX;
      const z0 = fz * spanZ;
      const dirX = Math.sign(x0 || 1) * 0.005;
      const dirZ = Math.sign(z0 || 1) * 0.005;

      const pts = [
        new THREE.Vector3(x0, yBottom, z0),
        new THREE.Vector3(x0 + dirX * 0.6, THREE.MathUtils.lerp(yBottom, yTop, 0.35), z0 + dirZ * 0.5),
        new THREE.Vector3(x0 + dirX * 1.4, THREE.MathUtils.lerp(yBottom, yTop, 0.70), z0 + dirZ * 1.3),
        new THREE.Vector3(x0 + dirX * 1.9, yTop, z0 + dirZ * 1.8),
      ];
      const curve = new THREE.CatmullRomCurve3(pts);
      const baseRad = 0.00048;

      for (let j = 0; j < ptsPerCurve; j++) {
        const u = j / PLUME_SAMPLES;
        const pt = curve.getPoint(u);
        curve.getTangent(u, tangent).normalize();
        right.crossVectors(tangent, sideAxis);
        if (right.lengthSq() < 1e-5) right.set(0, 0, 1);
        right.normalize();
        binorm.crossVectors(right, tangent).normalize();

        const rad = baseRad * (0.6 + 0.4 * Math.sin(u * Math.PI));
        for (let k = 0; k < RADIAL_SEGS; k++) {
          const th = (k / RADIAL_SEGS) * Math.PI * 2;
          nTmp.set(0, 0, 0).addScaledVector(right, Math.cos(th)).addScaledVector(binorm, Math.sin(th)).normalize();
          const vi = vOff + j * RADIAL_SEGS + k;
          positions[vi * 3 + 0] = pt.x + nTmp.x * rad;
          positions[vi * 3 + 1] = pt.y + nTmp.y * rad;
          positions[vi * 3 + 2] = pt.z + nTmp.z * rad;
          normals[vi * 3 + 0] = nTmp.x;
          normals[vi * 3 + 1] = nTmp.y;
          normals[vi * 3 + 2] = nTmp.z;
          aProgress[vi] = u;
          aSeed[vi] = (i * 0.37) % 1;
        }
        if (j < PLUME_SAMPLES) {
          for (let k = 0; k < RADIAL_SEGS; k++) {
            const nk = (k + 1) % RADIAL_SEGS;
            const a = vOff + j * RADIAL_SEGS + k;
            const b = vOff + j * RADIAL_SEGS + nk;
            const c = vOff + (j + 1) * RADIAL_SEGS + nk;
            const d = vOff + (j + 1) * RADIAL_SEGS + k;
            indices.push(a, b, c, a, c, d);
          }
        }
      }
      vOff += vertsPerCurve;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('aProgress', new THREE.BufferAttribute(aProgress, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
    geo.setIndex(indices);
    setPlumeGeo(geo);

    return () => geo.dispose();
  }, [fin_H, fin_L, W_base]);

  useEffect(() => {
    const pMat = new THREE.ShaderMaterial({
      vertexShader: PLUME_VERT,
      fragmentShader: PLUME_FRAG,
      uniforms: {
        uPhase: { value: 0 },
        uHeatNorm: { value: 0.4 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });
    plumeMatRef.current = pMat;
    setPlumeMat(pMat);

    const posArr = new Float32Array(WISP_COUNT * 3);
    const colArr = new Float32Array(WISP_COUNT * 3);
    const sizeArr = new Float32Array(WISP_COUNT);
    const alphaArr = new Float32Array(WISP_COUNT);
    const seeds: { x: number; z: number; phase: number; speed: number }[] = [];

    for (let i = 0; i < WISP_COUNT; i++) {
      seeds.push({
        x: (Math.random() - 0.5) * 0.9,
        z: (Math.random() - 0.5) * 0.9,
        phase: Math.random(),
        speed: 0.75 + Math.random() * 0.5,
      });
    }
    wispSeedsRef.current = seeds;

    const wGeo = new THREE.BufferGeometry();
    wGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    wGeo.setAttribute('aColor', new THREE.BufferAttribute(colArr, 3));
    wGeo.setAttribute('aSize', new THREE.BufferAttribute(sizeArr, 1));
    wGeo.setAttribute('aAlpha', new THREE.BufferAttribute(alphaArr, 1));
    wispGeoRef.current = wGeo;
    setWispGeo(wGeo);

    const wMat = new THREE.ShaderMaterial({
      vertexShader: WISP_VERT,
      fragmentShader: WISP_FRAG,
      uniforms: {
        uPixelRatio: { value: Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    wispMatRef.current = wMat;
    setWispMat(wMat);

    return () => {
      plumeMatRef.current = null;
      wispGeoRef.current = null;
      wispMatRef.current = null;
      pMat.dispose();
      wGeo.dispose();
      wMat.dispose();
    };
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const heatNorm = THREE.MathUtils.clamp((T_c - T_ambient) / 60, 0.1, 1);
    const riseRate = THREE.MathUtils.lerp(0.28, 0.72, heatNorm);
    phaseRef.current = (phaseRef.current + riseRate * dt) % 1000;

    if (plumeMatRef.current) {
      plumeMatRef.current.uniforms.uPhase.value = phaseRef.current;
      plumeMatRef.current.uniforms.uHeatNorm.value = heatNorm;
    }

    const wGeo = wispGeoRef.current;
    const wMat = wispMatRef.current;
    const seeds = wispSeedsRef.current;
    if (wGeo && wMat && seeds.length > 0) {
      wMat.uniforms.uPixelRatio.value = Math.min(2, state.gl.getPixelRatio());
      const posAttr = wGeo.attributes.position as THREE.BufferAttribute;
      const colAttr = wGeo.attributes.aColor as THREE.BufferAttribute;
      const sizeAttr = wGeo.attributes.aSize as THREE.BufferAttribute;
      const alphaAttr = wGeo.attributes.aAlpha as THREE.BufferAttribute;

      const spanX = fin_L * 0.9;
      const spanZ = W_base * 0.9;
      const yMin = -fin_H * 0.40;
      const yMax = fin_H * 1.15 + 0.025;

      for (let i = 0; i < WISP_COUNT; i++) {
        const s = seeds[i];
        s.phase = (s.phase + riseRate * 0.45 * s.speed * dt) % 1;
        const y = THREE.MathUtils.lerp(yMin, yMax, s.phase);
        const sway = Math.sin(phaseRef.current * 2.0 + i * 1.7) * 0.0025;
        const x = s.x * spanX + sway;
        const z = s.z * spanZ + Math.cos(phaseRef.current * 1.5 + i) * 0.002;
        posAttr.setXYZ(i, x, y, z);

        const fade = Math.sin(s.phase * Math.PI);
        sizeAttr.setX(i, THREE.MathUtils.lerp(0.0022, 0.0036, heatNorm) * fade);
        alphaAttr.setX(i, fade * 0.42);
        colAttr.setXYZ(
          i,
          THREE.MathUtils.lerp(0.96, 0.45, s.phase),
          THREE.MathUtils.lerp(0.60, 0.82, s.phase),
          THREE.MathUtils.lerp(0.24, 0.98, s.phase),
        );
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;
    }
  });

  return (
    <group position={position}>
      {plumeGeo && plumeMat && (
        <mesh geometry={plumeGeo} material={plumeMat} frustumCulled={false} renderOrder={4} />
      )}
      {wispGeo && wispMat && (
        <points geometry={wispGeo} material={wispMat} frustumCulled={false} renderOrder={5} />
      )}
    </group>
  );
}
