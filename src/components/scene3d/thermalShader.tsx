import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * FEA Thermal Mode Types per Component:
 *  0 = Heating Block (cartridge heat plumes + insulation-sensitive edge loss)
 *  1 = Heat Spreader Plate (central footprint peak spreading radially via world XZ)
 *  2 = TEG Semiconductor Pellet Matrix (Fourier 1D Y gradient + slight core peak)
 *  3 = Plate / Pin Fins (Paper Eq.21 cosh(m*(H - dist))/cosh(m*H) + world XZ radial + airflow -X->+X)
 *  4 = Heat Sink Top / Lower Deck & Flange (radial footprint + airflow cooling)
 *  5 = Thermal Insulation Outer Surface (insulated exterior temperature profile)
 */
export type ThermalShaderMode = 0 | 1 | 2 | 3 | 4 | 5;

export interface ThermalFieldParams {
  mode: ThermalShaderMode;
  scaleMin: number;       // Global colormap bottom (°C), T_ambient
  scaleMax: number;       // Global colormap top (°C), T_source
  tempTop: number;        // Local hottest/top surface temp (°C)
  tempBot: number;        // Local bottom/tip temp (°C)
  tempEdge?: number;      // Perimeter corner/outer temp (°C)
  dimX: number;           // Component/assembly X extent (m)
  dimY: number;           // Mesh local Y height (m)
  dimZ: number;           // Component/assembly Z extent (m)
  coreRadius?: number;    // Heat source/TEG footprint radius in XZ (m)
  finM?: number;          // Paper Eq.(22) fin decay parameter m (1/m)
  finH?: number;          // Fin height H (m)
  airflowWarming?: number;// °C axial temperature rise along airflow (-X -> +X)
}

const GLSL_HEATMAP_COMMON = /* glsl */ `
varying vec3 vThermLocalPos;
varying vec3 vThermWorldPos;

uniform float uScaleMin;
uniform float uScaleMax;
uniform float uTempTop;
uniform float uTempBot;
uniform float uTempEdge;
uniform float uDimX;
uniform float uDimY;
uniform float uDimZ;
uniform float uCoreRadius;
uniform float uFinM;
uniform float uFinH;
uniform float uAirBias;
uniform float uMode;

vec3 scientificTurboJet(float t) {
  t = clamp(t, 0.0, 1.0);
  // 7-stop ANSYS / COMSOL high-contrast scientific rainbow spectrum
  vec3 c0 = vec3(0.11, 0.31, 0.85); // Deep Cobalt Blue (Cold)
  vec3 c1 = vec3(0.02, 0.72, 0.84); // Electric Cyan
  vec3 c2 = vec3(0.06, 0.78, 0.44); // Emerald Green
  vec3 c3 = vec3(0.94, 0.78, 0.06); // Bright Yellow
  vec3 c4 = vec3(0.98, 0.45, 0.08); // Thermal Orange
  vec3 c5 = vec3(0.94, 0.16, 0.16); // Hot Red
  vec3 c6 = vec3(0.72, 0.04, 0.08); // Peak Crimson

  if (t < 0.18) return mix(c0, c1, t / 0.18);
  if (t < 0.36) return mix(c1, c2, (t - 0.18) / 0.18);
  if (t < 0.56) return mix(c2, c3, (t - 0.36) / 0.20);
  if (t < 0.74) return mix(c3, c4, (t - 0.56) / 0.18);
  if (t < 0.90) return mix(c4, c5, (t - 0.74) / 0.16);
  return mix(c5, c6, (t - 0.90) / 0.10);
}

float evalThermalTemperature(vec3 localP, vec3 worldP) {
  float halfY = max(0.0005, uDimY * 0.5);
  float yFrac = clamp((localP.y + halfY) / max(0.001, uDimY), 0.0, 1.0);
  // Apparatus is centered at world XZ = (0, 0)
  float rXZ = length(worldP.xz);
  float maxR = max(0.005, length(vec2(uDimX * 0.5, uDimZ * 0.5)));
  float xFrac = clamp((worldP.x / max(0.005, uDimX)) + 0.5, 0.0, 1.0); // 0=fan inlet (-X), 1=exit (+X)

  if (uMode < 0.5) {
    // Mode 0: Heating Block — twin cartridge heater thermal plumes + perimeter edge loss
    float zCart1 = abs(worldP.z - uDimZ * 0.18);
    float zCart2 = abs(worldP.z + uDimZ * 0.18);
    float dCart = min(zCart1, zCart2) / max(0.004, uDimZ * 0.30);
    float cartBoost = exp(-dCart * dCart * 2.0) * (0.40 + 0.60 * yFrac);
    float edgeDist = max(abs(worldP.x) / max(0.002, uDimX * 0.5), abs(worldP.z) / max(0.002, uDimZ * 0.5));
    float baseT = mix(uTempBot, uTempTop, 0.42 * yFrac + 0.58 * cartBoost);
    return mix(baseT, uTempEdge, clamp(pow(edgeDist, 2.0), 0.0, 1.0));
  } else if (uMode < 1.5) {
    // Mode 1: Heat Spreader Plate — concentric radial plume from central TEG/Heater footprint
    float rOut = max(0.0, rXZ - uCoreRadius * 0.55);
    float spanOut = max(0.004, maxR - uCoreRadius * 0.55);
    float rNorm = clamp(rOut / spanOut, 0.0, 1.0);
    float vertT = mix(uTempBot, uTempTop, yFrac);
    return mix(vertT, uTempEdge, pow(rNorm, 1.3));
  } else if (uMode < 2.5) {
    // Mode 2: TEG Semiconductor Pellet Matrix — 1D Fourier conduction gradient along Y
    float centerWeight = 1.0 - 0.06 * clamp(rXZ / max(0.01, uCoreRadius), 0.0, 1.0);
    return mix(uTempBot, uTempTop, yFrac) * centerWeight + uTempBot * (1.0 - centerWeight);
  } else if (uMode < 3.5) {
    // Mode 3: Vertical Fin — Paper Eq.(21) hyperbolic profile cosh(m*(H - dist))/cosh(m*H) + world XZ & airflow
    float H = max(0.004, uFinH);
    float distFromRoot = clamp(halfY - localP.y, 0.0, H); // +halfY = top deck root, -halfY = bottom tip
    float mL = clamp(uFinM * H, 0.01, 6.0);
    float mRem = clamp(uFinM * (H - distFromRoot), 0.0, 6.0);
    float coshNum = 0.5 * (exp(mRem) + exp(-mRem));
    float coshDen = 0.5 * (exp(mL) + exp(-mL));
    float theta = clamp(coshNum / max(1.0, coshDen), 0.0, 1.0);
    float rOut = max(0.0, rXZ - uCoreRadius * 0.55);
    float spanOut = max(0.005, maxR - uCoreRadius * 0.55);
    float footprintR = clamp(rOut / spanOut, 0.0, 1.0);
    float localRootT = mix(uTempTop, uTempEdge, pow(footprintR, 1.25));
    float airShift = (xFrac - 0.5) * uAirBias;
    return max(uScaleMin, uScaleMin + theta * max(0.0, (localRootT + airShift) - uScaleMin));
  } else if (uMode < 4.5) {
    // Mode 4: Heat Sink Deck / Flange — radial decay + cooling air inlet bias
    float rOut = max(0.0, rXZ - uCoreRadius * 0.50);
    float spanOut = max(0.005, maxR - uCoreRadius * 0.50);
    float rNorm = clamp(rOut / spanOut, 0.0, 1.0);
    float baseT = mix(uTempTop, uTempEdge, pow(rNorm, 1.25));
    float airShift = (xFrac - 0.5) * uAirBias;
    return clamp(baseT + airShift, uScaleMin, uScaleMax);
  } else {
    // Mode 5: Thermal Insulation Outer Surface
    float rNorm = clamp(rXZ / maxR, 0.0, 1.0);
    return mix(uTempTop, uTempEdge, 0.45 * rNorm + 0.35 * abs(yFrac - 0.5) * 2.0);
  }
}
`;

function syncUniforms(u: Record<string, { value: number }>, params: ThermalFieldParams) {
  u.uScaleMin.value = params.scaleMin;
  u.uScaleMax.value = Math.max(params.scaleMin + 5, params.scaleMax);
  u.uTempTop.value = params.tempTop;
  u.uTempBot.value = params.tempBot;
  u.uTempEdge.value = params.tempEdge ?? params.tempBot;
  u.uDimX.value = params.dimX;
  u.uDimY.value = params.dimY;
  u.uDimZ.value = params.dimZ;
  u.uCoreRadius.value = params.coreRadius ?? params.dimX * 0.35;
  u.uFinM.value = params.finM ?? 15;
  u.uFinH.value = params.finH ?? params.dimY;
  u.uAirBias.value = params.airflowWarming ?? 3.5;
  u.uMode.value = params.mode;
}

export function createFEAHeatmapMaterial(params: ThermalFieldParams): THREE.MeshStandardMaterial {
  const uniforms: Record<string, { value: number }> = {
    uScaleMin: { value: params.scaleMin },
    uScaleMax: { value: Math.max(params.scaleMin + 5, params.scaleMax) },
    uTempTop: { value: params.tempTop },
    uTempBot: { value: params.tempBot },
    uTempEdge: { value: params.tempEdge ?? params.tempBot },
    uDimX: { value: params.dimX },
    uDimY: { value: params.dimY },
    uDimZ: { value: params.dimZ },
    uCoreRadius: { value: params.coreRadius ?? params.dimX * 0.35 },
    uFinM: { value: params.finM ?? 15 },
    uFinH: { value: params.finH ?? params.dimY },
    uAirBias: { value: params.airflowWarming ?? 3.5 },
    uMode: { value: params.mode },
  };

  const mat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.36,
    metalness: 0.12,
    envMapIntensity: 0.65,
  });

  mat.userData.thermalUniforms = uniforms;
  mat.customProgramCacheKey = () => 'teg_fea_heatmap_v3';

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec3 vThermLocalPos;\nvarying vec3 vThermWorldPos;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\nvThermLocalPos = position;\nvThermWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_HEATMAP_COMMON}`)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `
        #include <color_fragment>
        float thermT = evalThermalTemperature(vThermLocalPos, vThermWorldPos);
        float thermNorm = clamp((thermT - uScaleMin) / max(1.0, uScaleMax - uScaleMin), 0.0, 1.0);
        vec3 thermSrgb = scientificTurboJet(thermNorm);
        // Anti-aliased FEA isothermal contour bands
        float stepDeg = max(2.0, (uScaleMax - uScaleMin) / 14.0);
        float contourDist = abs(fract(thermT / stepDeg) - 0.5);
        float fw = 0.032;
        #if __VERSION__ >= 300
          fw = max(0.015, fwidth(thermT / stepDeg) * 1.45);
        #endif
        float contourMask = smoothstep(0.0, fw, contourDist);
        thermSrgb *= mix(0.74, 1.0, contourMask);
        vec3 thermLinear = pow(thermSrgb, vec3(2.2));
        diffuseColor.rgb = thermLinear;
        totalEmissiveRadiance += thermLinear * 0.24;
        `,
      );
  };

  return mat;
}

/**
 * StrictMode-safe React hook managing a GPU FEA thermal shader material.
 * Material instance lifecycle lives strictly inside useEffect([enabled]).
 */
export function useThermalMaterial(
  enabled: boolean,
  params: ThermalFieldParams,
): THREE.MeshStandardMaterial | null {
  const [mat, setMat] = useState<THREE.MeshStandardMaterial | null>(null);
  const latestParamsRef = useRef(params);
  latestParamsRef.current = params;

  useEffect(() => {
    if (!enabled) {
      setMat(null);
      return;
    }
    const created = createFEAHeatmapMaterial(latestParamsRef.current);
    setMat(created);
    return () => {
      created.dispose();
    };
  }, [enabled]);

  useEffect(() => {
    if (!mat) return;
    const u = mat.userData.thermalUniforms as Record<string, { value: number }> | undefined;
    if (u) syncUniforms(u, params);
  }, [
    mat,
    params.mode,
    params.scaleMin,
    params.scaleMax,
    params.tempTop,
    params.tempBot,
    params.tempEdge,
    params.dimX,
    params.dimY,
    params.dimZ,
    params.coreRadius,
    params.finM,
    params.finH,
    params.airflowWarming,
  ]);

  return mat;
}

interface ThermalLegendHUDProps {
  visible: boolean;
  T_min: number;
  T_max: number;
  T_h: number;
  T_c: number;
}

/**
 * Non-intrusive FEA Temperature Colorbar HUD (docked cleanly at bottom-left ONLY in Heat Map mode)
 */
export function ThermalLegendHUD({ visible, T_min, T_max, T_h, T_c }: ThermalLegendHUDProps) {
  if (!visible) return null;
  const span = Math.max(1, T_max - T_min);
  const tMid = T_min + span * 0.5;
  const stepDeg = Math.max(2, span / 14);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        zIndex: 25,
        background: 'rgba(8, 15, 26, 0.90)',
        backdropFilter: 'blur(10px)',
        border: '1px solid #334155',
        borderRadius: 8,
        padding: '8px 12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        pointerEvents: 'none',
        minWidth: 235,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#f8fafc', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          FEA Thermal Field (°C)
        </span>
        <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: "'JetBrains Mono', monospace" }}>
          Iso: {stepDeg.toFixed(1)} °C
        </span>
      </div>

      {/* 7-Stop Gradient Ramp matching GLSL scientificTurboJet */}
      <div
        style={{
          height: 10,
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.18)',
          background:
            'linear-gradient(90deg, #1d4ed8 0%, #06b6d4 18%, #10b981 36%, #eab308 56%, #f97316 74%, #ef4444 90%, #b91c1c 100%)',
          marginBottom: 4,
        }}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 9.5,
          fontWeight: 700,
          color: '#cbd5e1',
          fontFamily: "'JetBrains Mono', monospace",
          marginBottom: 5,
        }}
      >
        <span style={{ color: '#60a5fa' }}>{T_min.toFixed(0)}°C</span>
        <span style={{ color: '#34d399' }}>{tMid.toFixed(0)}°C</span>
        <span style={{ color: '#f87171' }}>{T_max.toFixed(0)}°C</span>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 9.5,
          fontFamily: "'JetBrains Mono', monospace",
          borderTop: '1px solid #1e293b',
          paddingTop: 4,
          color: '#94a3b8',
          gap: 8,
        }}
      >
        <span>T_h: <strong style={{ color: '#fb923c' }}>{T_h.toFixed(1)}°</strong></span>
        <span>T_c: <strong style={{ color: '#38bdf8' }}>{T_c.toFixed(1)}°</strong></span>
        <span>ΔT: <strong style={{ color: '#facc15' }}>{Math.max(0, T_h - T_c).toFixed(1)}K</strong></span>
      </div>
    </div>
  );
}
