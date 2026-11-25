/**
 * TEG Simulation — Convection Heat Transfer Module
 *
 * Implements Paper Equations:
 *   Eq.(5)   Q̇ = h · A · (Ts - T∞)   [Newton's Law of Cooling]
 *   Eq.(10)  R_conv = 1 / (h · A)
 *   Eq.(30)  P_fan  = Δp · V̇ / η_fan
 *
 * Correlations (from Incropera / Cengel):
 *   - Churchill-Chu (vertical plate, all Ra) for natural convection
 *   - Dittus-Boelter / Graetz for forced convection in channels
 *   - Mixed: Richardson-number based superposition
 */

import type { AirProperties, ConvectionResult, ConvectionConditions } from './types';
import { AIR_TABLE, G_STD } from './constants';

// ═══════════════════════════════════════════════════════════════════
// 1. AIR PROPERTY INTERPOLATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Linearly interpolate air properties at a given film temperature.
 * Table range: 20 – 300 °C.  Values outside the range are clamped.
 */
export function getAirProperties(T_film_C: number): AirProperties {
  const table = AIR_TABLE;
  const T = Math.max(table[0].T, Math.min(table[table.length - 1].T, T_film_C));

  // Find surrounding rows
  let i = 0;
  while (i < table.length - 1 && table[i + 1].T <= T) i++;
  if (i >= table.length - 1) i = table.length - 2;

  const lo = table[i];
  const hi = table[i + 1];
  const frac = (T - lo.T) / (hi.T - lo.T);

  const lerp = (a: number, b: number) => a + frac * (b - a);

  const rho = lerp(lo.rho, hi.rho);
  const mu  = lerp(lo.mu,  hi.mu);
  const k   = lerp(lo.k,   hi.k);
  const cp  = lerp(lo.cp,  hi.cp);
  const Pr  = lerp(lo.Pr,  hi.Pr);

  const nu = mu / rho;                    // kinematic viscosity m²/s
  const alpha_th = k / (rho * cp);        // thermal diffusivity m²/s
  const beta = 1 / (T_film_C + 273.15);  // ideal gas β = 1/T_K

  return { T_C: T_film_C, rho, mu, k, cp, Pr, nu, alpha_th, beta };
}

// ═══════════════════════════════════════════════════════════════════
// 2. NATURAL CONVECTION — Churchill-Chu (vertical plate)
// ═══════════════════════════════════════════════════════════════════

interface NatConvParams {
  T_surface: number;  // °C
  T_inf: number;      // °C
  L_char: number;     // m  characteristic length (fin height or plate height)
  air?: AirProperties;
}

/**
 * Natural convection — Churchill-Chu correlation for a vertical plate.
 *
 * Nu = { 0.825 + [0.387·Ra^(1/6)] / [1+(0.492/Pr)^(9/16)]^(8/27) }²
 *
 * Valid for: 10⁻¹ < Ra < 10¹²
 */
export function naturalConvection(params: NatConvParams): ConvectionResult {
  const { T_surface, T_inf, L_char } = params;
  const T_film = (T_surface + T_inf) / 2;
  const air = params.air ?? getAirProperties(T_film);

  const dT = T_surface - T_inf; // could be negative (cooler surface)

  // Grashof number: Gr = g·β·|ΔT|·L³ / ν²
  const Gr = (G_STD * air.beta * Math.abs(dT) * Math.pow(L_char, 3)) / (air.nu * air.nu);

  // Rayleigh number: Ra = Gr·Pr
  const Ra = Gr * air.Pr;

  // Churchill-Chu correlation
  const inner = 1 + Math.pow(0.492 / air.Pr, 9 / 16);
  const denom = Math.pow(inner, 8 / 27);
  const Nu = Math.pow(0.825 + (0.387 * Math.pow(Ra, 1 / 6)) / denom, 2);

  const h = (Nu * air.k) / L_char;

  const inRange = Ra >= 0.1 && Ra <= 1e12;
  const validityRange = `10⁻¹ < Ra < 10¹²  (Ra=${Ra.toExponential(2)}) ${inRange ? '✓' : '⚠ outside range'}`;

  return {
    mode: 'natural',
    Gr,
    Ra,
    Pr: air.Pr,
    Nu,
    h,
    correlationUsed: 'Churchill-Chu (vertical plate, all Ra)',
    validityRange,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 3. FORCED CONVECTION — Channel / duct flow
// ═══════════════════════════════════════════════════════════════════

interface ForceConvParams {
  T_surface: number;  // °C
  T_inf: number;      // °C
  V: number;          // m/s  mean air velocity
  /** Hydraulic diameter of fin channel */
  D_h: number;        // m
  /** Channel length in flow direction */
  L_channel: number;  // m
  /** Uniform wall temperature (true) or uniform heat flux (false) */
  uniformT?: boolean;
  air?: AirProperties;
}

/**
 * Forced convection in a fin channel.
 *
 * Laminar (Re < 2300):
 *   - Uniform T  → Nu = 3.66 (fully developed)
 *   - Uniform q  → Nu = 4.36 (fully developed)
 *   - Entrance effects: Sieder-Tate / Lévêque if L_channel/D_h < 60
 *
 * Transition (2300 ≤ Re ≤ 10000):
 *   - Gnielinski: Nu = (f/8)·(Re-1000)·Pr / [1+12.7·√(f/8)·(Pr²/³-1)]
 *
 * Turbulent (Re > 10000):
 *   - Dittus-Boelter: Nu = 0.023·Re^0.8·Pr^0.4  (heating)
 *
 * Pressure drop: Darcy-Weisbach  ΔP = f·(L/D_h)·(ρV²/2)
 */
export function forcedConvection(params: ForceConvParams): ConvectionResult {
  const { T_surface, T_inf, V, D_h, L_channel, uniformT = true } = params;
  const T_film = (T_surface + T_inf) / 2;
  const air = params.air ?? getAirProperties(T_film);

  if (V <= 0) {
    // Degenerate — return near-zero forced result; caller should switch to natural
    return {
      mode: 'forced',
      Re: 0,
      Pr: air.Pr,
      Nu: 0,
      h: 0,
      dP: 0,
      correlationUsed: 'None (V=0)',
      validityRange: 'V must be > 0 for forced convection',
    };
  }

  // Reynolds number: Re = V·D_h / ν
  const Re = (V * D_h) / air.nu;
  const L_D = L_channel / D_h; // slenderness

  let Nu: number;
  let correlationUsed: string;
  let validityRange: string;

  if (Re < 2300) {
    // ── Laminar ─────────────────────────────────────────────────
    const Nu_fd = uniformT ? 3.66 : 4.36;

    // Entrance-length correction (Graetz / thermal entry length)
    // For short channels: use Hausen correlation
    // Nu = Nu_fd + [0.0668·(D_h/L)·Re·Pr] / [1 + 0.04·((D_h/L)·Re·Pr)^(2/3)]
    const Gz = (D_h / L_channel) * Re * air.Pr; // Graetz number
    if (L_D < 60) {
      Nu = Nu_fd + (0.0668 * Gz) / (1 + 0.04 * Math.pow(Gz, 2 / 3));
      correlationUsed = `Hausen (laminar, thermal entrance, Gz=${Gz.toFixed(1)})`;
      validityRange = `Re=${Re.toFixed(0)} < 2300, L/D=${L_D.toFixed(1)}`;
    } else {
      Nu = Nu_fd;
      correlationUsed = `Fully-developed laminar (${uniformT ? 'uniform T' : 'uniform q'})`;
      validityRange = `Re=${Re.toFixed(0)} < 2300, L/D=${L_D.toFixed(1)} (fully developed)`;
    }
  } else if (Re <= 10000) {
    // ── Transition — Gnielinski ──────────────────────────────────
    const f = Math.pow(0.790 * Math.log(Re) - 1.64, -2); // Petukhov friction factor
    Nu = ((f / 8) * (Re - 1000) * air.Pr) /
      (1 + 12.7 * Math.sqrt(f / 8) * (Math.pow(air.Pr, 2 / 3) - 1));
    Nu = Math.max(Nu, 3.66); // floor at laminar value
    correlationUsed = 'Gnielinski (transition/turbulent)';
    validityRange = `2300 ≤ Re=${Re.toFixed(0)} ≤ 5×10⁶, 0.5 ≤ Pr ≤ 2000`;
  } else {
    // ── Turbulent — Dittus-Boelter ───────────────────────────────
    Nu = 0.023 * Math.pow(Re, 0.8) * Math.pow(air.Pr, 0.4); // heating (n=0.4)
    // Entrance correction for short tubes: multiply by [1 + (D_h/L)^(2/3)]
    if (L_D < 60) {
      Nu *= 1 + Math.pow(D_h / L_channel, 2 / 3);
      correlationUsed = `Dittus-Boelter (turbulent, entrance correction, L/D=${L_D.toFixed(1)})`;
    } else {
      correlationUsed = 'Dittus-Boelter (turbulent, fully developed)';
    }
    validityRange = `Re=${Re.toFixed(0)} > 10 000, 0.6 < Pr < 160`;
  }

  const h = (Nu * air.k) / D_h;

  // ── Pressure drop: Darcy-Weisbach ────────────────────────────────
  // f_darcy for laminar: 64/Re;  turbulent: Petukhov or Colebrook (smooth)
  let f_darcy: number;
  if (Re < 2300) {
    f_darcy = 64 / Math.max(Re, 1);
  } else if (Re <= 10000) {
    f_darcy = Math.pow(0.790 * Math.log(Re) - 1.64, -2);
  } else {
    // Petukhov for smooth pipes
    f_darcy = Math.pow(0.790 * Math.log(Re) - 1.64, -2);
  }
  const dP = f_darcy * (L_channel / D_h) * (0.5 * air.rho * V * V);

  return {
    mode: 'forced',
    Re,
    Pr: air.Pr,
    Nu,
    h,
    dP,
    correlationUsed,
    validityRange,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 4. MIXED CONVECTION
// ═══════════════════════════════════════════════════════════════════

interface MixedConvParams {
  T_surface: number;
  T_inf: number;
  V: number;
  D_h: number;
  L_channel: number;
  L_char: number;
  uniformT?: boolean;
  air?: AirProperties;
}

/**
 * Mixed convection using Richardson number classification and
 * conservative superposition.
 *
 * Ri = Gr/Re²
 *   Ri > 10   → natural dominates
 *   Ri < 0.1  → forced dominates
 *   otherwise → Nu_mix³ = Nu_forced³ + Nu_natural³
 */
export function mixedConvection(params: MixedConvParams): ConvectionResult {
  const { T_surface, T_inf, V, D_h, L_channel, L_char } = params;
  const T_film = (T_surface + T_inf) / 2;
  const air = params.air ?? getAirProperties(T_film);

  // Natural component
  const natResult = naturalConvection({ T_surface, T_inf, L_char, air });

  // Forced component (only meaningful if V > 0)
  if (V <= 0) {
    return { ...natResult, mode: 'mixed→natural (V=0)' };
  }

  const forcedResult = forcedConvection({ T_surface, T_inf, V, D_h, L_channel, air });

  const Re = forcedResult.Re ?? 0;
  const Gr = natResult.Gr ?? 0;
  const Ri = Re > 0 ? Gr / (Re * Re) : Infinity;

  let Nu: number;
  let mode: string;
  let correlationUsed: string;

  if (Ri > 10) {
    Nu = natResult.Nu;
    mode = 'mixed→natural (Ri>10)';
    correlationUsed = `Natural dominates (Ri=${Ri.toFixed(1)}); Churchill-Chu`;
  } else if (Ri < 0.1) {
    Nu = forcedResult.Nu;
    mode = 'mixed→forced (Ri<0.1)';
    correlationUsed = `Forced dominates (Ri=${Ri.toFixed(3)}); ${forcedResult.correlationUsed}`;
  } else {
    // Conservative superposition:  Nu_mix³ = Nu_nat³ + Nu_forced³
    Nu = Math.cbrt(
      Math.pow(natResult.Nu, 3) + Math.pow(forcedResult.Nu, 3),
    );
    mode = 'mixed';
    correlationUsed = `Superposition (Ri=${Ri.toFixed(2)}): Nu³ = Nu_nat³ + Nu_forced³`;
  }

  const h = (Nu * air.k) / L_char;

  return {
    mode,
    Re,
    Gr,
    Ra: natResult.Ra,
    Pr: air.Pr,
    Nu,
    h,
    dP: forcedResult.dP,
    correlationUsed,
    validityRange: `Ri=${Ri.toFixed(2)}, Re=${Re.toFixed(0)}, Ra=${(natResult.Ra ?? 0).toExponential(2)}`,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 5. FAN POWER
// ═══════════════════════════════════════════════════════════════════

/**
 * Fan (blower) electrical power.
 * Paper Eq.(30): P_fan = Δp · V̇ / η_fan
 *
 * @param dP       Pressure drop across heat sink  [Pa]
 * @param V_dot    Volumetric air flow rate  [m³/s]
 * @param eta_fan  Fan efficiency (0–1)
 * @returns        Fan power  [W]
 */
export function fanPower(dP: number, V_dot: number, eta_fan: number): number {
  if (eta_fan <= 0) throw new Error('Fan efficiency must be > 0');
  return (dP * V_dot) / eta_fan;
}

// ═══════════════════════════════════════════════════════════════════
// 6. CONVECTION DISPATCHER
// ═══════════════════════════════════════════════════════════════════

/**
 * Top-level convection router: calls natural/forced/mixed based on
 * ConvectionConditions mode flag.
 */
export function computeConvection(
  cond: ConvectionConditions,
  T_surface: number,
  fin_H: number,         // fin height (characteristic length for natural conv.)
  fin_S: number,         // fin spacing (channel width for forced conv.)
  fin_L: number,         // base length in flow direction
): ConvectionResult {
  const { mode, V_air, T_inf } = cond;
  const L_char = cond.L_char ?? fin_H;

  // Hydraulic diameter of fin channel (rectangular slot: W × H)
  // D_h = 4·A_c / P_wetted  = 4·(fin_S × fin_H) / [2(fin_S + fin_H)]
  const D_h = (4 * fin_S * fin_H) / (2 * (fin_S + fin_H));
  const L_channel = cond.L_channel ?? fin_L;

  if (mode === 'natural') {
    return naturalConvection({ T_surface, T_inf, L_char });
  } else if (mode === 'forced') {
    return forcedConvection({ T_surface, T_inf, V: V_air, D_h, L_channel });
  } else {
    return mixedConvection({ T_surface, T_inf, V: V_air, D_h, L_channel, L_char });
  }
}
