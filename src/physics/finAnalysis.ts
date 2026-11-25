/**
 * TEG Simulation — Fin Analysis Module
 *
 * Implements Paper Equations:
 *   Eq.(19)  R_hs = 1 / (η_o · h · A_t)
 *   Eq.(20)  η_f  = tanh(m·Lc) / (m·Lc)
 *   Eq.(21)  (fin efficiency from temperature distribution)
 *   Eq.(22)  m    = sqrt(h·P / (k·Ac))
 *   Eq.(23)  Lc   = L + t/2   (adiabatic tip correction)
 *   Eq.(24)  ε_f  = Q̇_fin / [h·Ac·(Tb - T∞)]
 *   Eq.(25)  η_o  = 1 - (Af/At)·(1 - η_f)
 *   Eq.(28)  A_req = Q̇_c / [h·η_o·(Tb - T∞)]
 *   Eq.(29)  Tb - T∞ = Q̇_c · R_hs
 */

import type { FinGeometry, FinResult } from './types';
import { FIN_MATERIALS } from './constants';

// ─────────────────────────────────────────────────────────────────
// PLATE FIN GEOMETRY
// ─────────────────────────────────────────────────────────────────

interface PlateSurfaces {
  Af: number;   // total fin area (both sides of all fins) m²
  Ab: number;   // exposed base area (between fins) m²
  At: number;   // total surface area m²
  P_fin: number; // fin perimeter for m-param  m
  Ac: number;   // fin cross-sectional area m²
}

function plateSurfaces(fin: FinGeometry): PlateSurfaces {
  const { N, L, H, t, W_base } = fin;
  const effL = Math.max(0.01, L);
  // Parametric effective base width must physically accommodate all N fins + gaps
  const finsSpan = N * t + Math.max(0, N - 1) * fin.S;
  const effW = Math.max(W_base, finsSpan);

  // Both sides of one fin + tip
  const A_one_fin = 2 * effL * H + t * effL; // two faces + tip
  const Af = N * A_one_fin;

  // Exposed base = total base - fin footprints (clamped >= 0)
  const Ab = Math.max(0, effW * effL - N * (t * effL));

  const At = Af + Ab;

  // Cross-section of a single longitudinal plate fin (flow length L × thickness t)
  const P_fin = 2 * (effL + t);
  const Ac = t * effL;

  return { Af, Ab, At, P_fin, Ac };
}

// ─────────────────────────────────────────────────────────────────
// PIN FIN GEOMETRY
// ─────────────────────────────────────────────────────────────────

interface PinSurfaces {
  Af: number;
  Ab: number;
  At: number;
  P_fin: number;
  Ac: number;
}

function pinSurfaces(fin: FinGeometry): PinSurfaces {
  // For pin fins: treat as cylinders of diameter = t, height = H
  const { N, H, t, W_base, L_base } = fin;
  const D = t; // pin diameter = thickness parameter
  const r = D / 2;

  // Lateral area of one pin + tip cap (adiabatic tip correction applied later via Lc)
  const A_one_pin = Math.PI * D * H;
  const Af = N * A_one_pin;

  // Base area minus pin footprints
  const Ab = W_base * L_base - N * Math.PI * r * r;
  const At = Af + Ab;

  // Perimeter and cross-section for m-parameter
  const P_fin = Math.PI * D;
  const Ac = Math.PI * r * r;

  return { Af, Ab, At, P_fin, Ac };
}

// ─────────────────────────────────────────────────────────────────
// CORE FIN PARAMETER CALCULATION
// ─────────────────────────────────────────────────────────────────

/**
 * Calculate fin thermal performance.
 *
 * @param fin      Fin geometry descriptor
 * @param h        Convective heat transfer coefficient W/(m²·K)
 * @param T_base   Fin base temperature °C
 * @param T_inf    Ambient / coolant temperature °C
 * @returns        FinResult with all paper-equation quantities
 */
export function calculateFinParams(
  fin: FinGeometry,
  h: number,
  T_base: number,
  T_inf: number,
): FinResult {
  const warnings: string[] = [];

  // ── Material conductivity ────────────────────────────────────────
  const mat = FIN_MATERIALS[fin.material];
  if (!mat) {
    throw new Error(`Unknown fin material: ${fin.material}`);
  }
  const k_fin = mat.k;

  // ── Temperature difference ───────────────────────────────────────
  const dT_base = T_base - T_inf; // °C (or K, same difference)

  // ── Surface areas ────────────────────────────────────────────────
  let surfaces: PlateSurfaces | PinSurfaces;
  if (fin.type === 'plate') {
    surfaces = plateSurfaces(fin);
  } else {
    surfaces = pinSurfaces(fin);
  }
  const { Af, Ab, At, P_fin, Ac } = surfaces;

  // ── Corrected length  Lc = L + t/2  (Paper Eq.23) ───────────────
  // For pin fins: Lc = H + D/4 (equivalent adiabatic tip)
  const Lc =
    fin.type === 'plate'
      ? fin.H + fin.t / 2
      : fin.H + fin.t / 4; // pin: Lc = H + D/4

  // ── Fin parameter  m = sqrt(h·P / (k·Ac))  (Paper Eq.22) ────────
  const m_param = Math.sqrt((h * P_fin) / (k_fin * Ac));

  // ── Fin efficiency  η_f = tanh(m·Lc) / (m·Lc)  (Paper Eq.20) ───
  const mLc = m_param * Lc;

  if (mLc > 5) {
    warnings.push(
      `mLc = ${mLc.toFixed(2)} > 5: fin is very long/thin relative to conductivity — ` +
        `fin efficiency will be very low (<37%). Consider shorter or thicker fins.`,
    );
  }

  const eta_f = mLc > 1e-9 ? Math.tanh(mLc) / mLc : 1.0;

  // ── Overall surface efficiency  η_o (Paper Eq.25) ────────────────
  const eta_o = 1 - (Af / At) * (1 - eta_f);

  // ── Fin effectiveness  ε_f (Paper Eq.24) ─────────────────────────
  // ε_f = Q̇_fin / [h · Ac · (Tb - T∞)]
  // Q̇_fin = η_f · h · Af_one · dT_base  (for one fin)
  // ε_f = η_f · Af_one / Ac
  const Af_one = Af / fin.N;
  const epsilon_f = (eta_f * Af_one) / Ac;

  if (epsilon_f < 2) {
    warnings.push(
      `Fin effectiveness ε_f = ${epsilon_f.toFixed(2)} < 2: fins provide minimal benefit. ` +
        `Consider increasing H or switching to higher-k material.`,
    );
  }

  // ── Heat sink resistance  R_hs (Paper Eq.19) ─────────────────────
  // R_hs = 1 / (η_o · h · A_t)
  const R_hs = 1 / (eta_o * h * At);

  // ── Total heat transfer rate ─────────────────────────────────────
  // Q̇ = (Tb - T∞) / R_hs
  const Q_fin = dT_base / R_hs;

  // ── Fin spacing check ────────────────────────────────────────────
  if (fin.S < 0.003) {
    warnings.push(
      `Fin spacing S = ${(fin.S * 1000).toFixed(1)} mm < 3 mm: ` +
        `airflow restriction likely; actual h may be significantly lower than predicted.`,
    );
  }

  // ── Fin temperature limit ────────────────────────────────────────
  if (T_base > mat.T_max) {
    warnings.push(
      `Fin base temperature ${T_base.toFixed(0)} °C exceeds maximum service temperature ` +
        `for ${mat.name} (${mat.T_max} °C).`,
    );
  }

  return {
    eta_f,
    epsilon_f,
    eta_o,
    Af,
    Ab,
    At,
    m_param,
    Lc,
    Q_fin,
    R_hs,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────
// DERIVED HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Required heat-sink area for a given cold-side heat rejection.
 * Paper Eq.(28): A_req = Q̇_c / [h · η_o · (Tb - T∞)]
 */
export function requiredHeatSinkArea(
  Q_c: number,
  h: number,
  eta_o: number,
  T_base: number,
  T_inf: number,
): number {
  const dT = T_base - T_inf;
  if (dT <= 0) return Infinity;
  return Q_c / (h * eta_o * dT);
}

/**
 * Base-to-ambient temperature difference from heat rejection.
 * Paper Eq.(29): Tb - T∞ = Q̇_c · R_hs
 */
export function baseTempRise(Q_c: number, R_hs: number): number {
  return Q_c * R_hs;
}
