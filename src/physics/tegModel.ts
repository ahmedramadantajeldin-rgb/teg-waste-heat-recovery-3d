/**
 * TEG Simulation — TEG Electrical & Thermal Model
 *
 * Paper Equations Used:
 *   Eq.(1)   ΔT = Th − Tc
 *   Eq.(2)   Voc = N·α·ΔT
 *   Eq.(8)   R_th = ΔT / Q̇
 *   Eq.(9)   R_cond = L / (k·A)
 *   Eq.(10)  R_conv = 1 / (h·A)
 *   Eq.(12)  R_c = R_c'' / A
 *   Eq.(13)  R_total = R_conv,h + R_cond,h + R_c,h + R_TEG + R_c,c + R_conv,c
 *   Eq.(14)  Q̇ = ΔT_total / R_total
 *   Eq.(15)  Q̇_h = P_elec + Q̇_c
 *   Eq.(7.4) P_elec = Voc²·RL / (RL + Rint)²
 *   Eq.(7.5) P_max = Voc² / (4·Rint)       at RL = Rint
 *   Eq.(7.6) η_th = P_elec / Q̇_h
 *   Eq.(7.7) P_net = P_gross − P_fan − P_pump − P_other
 *   Eq.(7.8) η_sys = P_net / Q̇_input
 *   Eq.(7.9)  Ex = Q·(1 − T0/T)
 *   Eq.(7.10) η_ex = P_net / Ex_input
 *   Eq.(7.11) Ex_gas = ṁ·cp·[(T−T0) − T0·ln(T/T0)]
 *   Eq.(7.12) E_annual = ∫P_net·dt
 *   Eq.(8.1) PBP = Investment / Annual_savings
 */

import type { TEGModule, TEGResult } from './types';

// ═══════════════════════════════════════════════════════════════════
// 1. OPEN-CIRCUIT VOLTAGE  — Paper Eq.(2)
// ═══════════════════════════════════════════════════════════════════

/** V_oc = N · α · ΔT   [Paper Eq.(2)] */
export function openCircuitVoltage(N: number, alpha: number, dT: number): number {
  return N * alpha * Math.max(0, dT);
}

// ═══════════════════════════════════════════════════════════════════
// 2. ELECTRICAL POWER — Paper Eq.(7.4) & (7.5)
// ═══════════════════════════════════════════════════════════════════

/** P_elec = Voc² · RL / (RL + Rint)²   [Paper Eq.(7.4)] */
export function electricalPower(Voc: number, RL: number, Rint: number): number {
  if (RL <= 0 || Rint <= 0) return 0;
  return (Voc * Voc * RL) / Math.pow(RL + Rint, 2);
}

/** P_max = Voc² / (4·Rint)   at RL = Rint   [Paper Eq.(7.5)] */
export function maxElectricalPower(Voc: number, Rint: number): number {
  if (Rint <= 0) return 0;
  return (Voc * Voc) / (4 * Rint);
}

/** Load voltage: V_load = Voc · RL / (RL + Rint) */
export function loadVoltage(Voc: number, RL: number, Rint: number): number {
  if (RL + Rint <= 0) return 0;
  return (Voc * RL) / (RL + Rint);
}

/** Load current: I = Voc / (RL + Rint) */
export function loadCurrent(Voc: number, RL: number, Rint: number): number {
  if (RL + Rint <= 0) return 0;
  return Voc / (RL + Rint);
}

// ═══════════════════════════════════════════════════════════════════
// 3. THERMAL RESISTANCE NETWORK — Paper Eq.(9),(10),(12),(13)
// ═══════════════════════════════════════════════════════════════════

export interface ResistanceNetwork {
  R_conv_h: number;   // hot-side convection resistance (K/W)
  R_cond_h: number;   // hot-side spreader conduction resistance (K/W)
  R_c_h: number;      // hot-side contact resistance (K/W)
  R_TEG: number;      // TEG module conduction resistance (K/W) = 1/K_teg
  R_c_c: number;      // cold-side contact resistance (K/W)
  R_hs: number;       // cold-side heat sink resistance (K/W)
  R_total: number;    // total series resistance (K/W) — Paper Eq.(13)
}

/**
 * Build the series thermal resistance network.
 * Paper Eq.(13): R_total = R_conv,h + R_cond,h + R_c,h + R_TEG + R_c,c + R_conv,c
 *
 * Note: R_conv,h is convection from hot source to hot spreader surface.
 *       R_hs already incorporates fin efficiency (computed separately).
 */
export function buildResistanceNetwork(
  h_hot: number,       // hot-side heat transfer coefficient W/(m²·K)
  A_hot: number,       // hot-side area (m²)
  t_spreader_h: number,// hot-side spreader thickness (m)
  k_spreader_h: number,// hot-side spreader conductivity W/(m·K)
  A_spreader: number,  // spreader area (m²)
  R_contact_h: number, // hot-side TCR (K/W)
  teg: TEGModule,
  R_contact_c: number, // cold-side TCR (K/W)
  R_hs: number,        // heat sink resistance (K/W) [includes fin efficiency]
): ResistanceNetwork {
  // Paper Eq.(10): R_conv = 1/(h·A)
  const R_conv_h = h_hot > 0 ? 1 / (h_hot * A_hot) : 0.5; // fallback if no hot-side h given

  // Paper Eq.(9): R_cond = L/(k·A)
  const R_cond_h = t_spreader_h / (k_spreader_h * A_spreader);

  // Paper Eq.(12): R_c = R_c''/ A  (input already per-module in K/W)
  const R_c_h = R_contact_h;

  // TEG internal resistance: Paper says R_TEG = 1/K_teg
  const R_TEG = teg.K_teg > 0 ? 1 / teg.K_teg : 1.667;

  const R_c_c = R_contact_c;

  // R_total — Paper Eq.(13)
  const R_total = R_conv_h + R_cond_h + R_c_h + R_TEG + R_c_c + R_hs;

  return { R_conv_h, R_cond_h, R_c_h, R_TEG, R_c_c, R_hs, R_total };
}

// ═══════════════════════════════════════════════════════════════════
// 4. TEMPERATURE SOLVER
// ═══════════════════════════════════════════════════════════════════

export interface TempSolution {
  T_h: number;    // hot-side module temperature (°C)
  T_c: number;    // cold-side module temperature (°C)
  dT: number;     // ΔT across legs (K) — Paper Eq.(1)
  Q_total: number; // heat flowing through (W) — Paper Eq.(14)
}

/**
 * Solve for module hot- and cold-side temperatures.
 * Uses series thermal resistance network.
 * Paper Eq.(14): Q̇ = (T_hot_fluid − T_cold_fluid) / R_total
 */
export function solveTemperatures(
  T_source: number,      // hot fluid/source temperature (°C)
  T_ambient: number,     // cooling air/fluid temperature (°C)
  net: ResistanceNetwork,
): TempSolution {
  // Heat flow through the whole path — Paper Eq.(14)
  const dT_total = T_source - T_ambient;
  const Q_total = dT_total / net.R_total;

  // Temperature drops across each element
  const dT_conv_h = Q_total * net.R_conv_h;
  const dT_cond_h = Q_total * net.R_cond_h;
  const dT_c_h    = Q_total * net.R_c_h;
  const dT_teg    = Q_total * net.R_TEG;
  const dT_c_c    = Q_total * net.R_c_c;

  // Module temperatures (measured at module surfaces)
  const T_h = T_source - dT_conv_h - dT_cond_h - dT_c_h;
  const T_c = T_ambient + Q_total * (net.R_hs);  // Paper Eq.(29) reversed

  const dT = T_h - T_c; // Paper Eq.(1)

  return { T_h, T_c, dT: Math.max(0, dT), Q_total };
}

// ═══════════════════════════════════════════════════════════════════
// 5. HEAT BALANCE — Paper Eq.(15)
// ═══════════════════════════════════════════════════════════════════

/** Q̇_h = P_elec + Q̇_c   (simplified, no external losses)  Paper Eq.(15) */
export function heatBalance(Q_h: number, P_elec: number): {
  Q_c: number;
  energy_balance_error: number;
} {
  const Q_c = Math.max(0, Q_h - P_elec);
  return { Q_c, energy_balance_error: Math.abs(Q_h - P_elec - Q_c) };
}

// ═══════════════════════════════════════════════════════════════════
// 6. THERMAL EFFICIENCY — Paper Eq.(7.6)
// ═══════════════════════════════════════════════════════════════════

/** η_th = P_elec / Q̇_h   Paper Eq.(7.6) */
export function thermalEfficiency(P_elec: number, Q_h: number): number {
  if (Q_h <= 0) return 0;
  return P_elec / Q_h;
}

// ═══════════════════════════════════════════════════════════════════
// 7. NET POWER — Paper Eq.(7.7)
// ═══════════════════════════════════════════════════════════════════

/** P_net = P_gross − P_fan − P_pump − P_other   Paper Eq.(7.7) */
export function netPower(P_gross: number, P_fan = 0, P_pump = 0, P_other = 0): number {
  return P_gross - P_fan - P_pump - P_other;
}

// ═══════════════════════════════════════════════════════════════════
// 8. SYSTEM EFFICIENCY — Paper Eq.(7.8)
// ═══════════════════════════════════════════════════════════════════

/** η_sys = P_net / Q̇_input   Paper Eq.(7.8) */
export function systemEfficiency(P_net: number, Q_input: number): number {
  if (Q_input <= 0) return 0;
  return P_net / Q_input;
}

// ═══════════════════════════════════════════════════════════════════
// 9. EXERGY — Paper Eq.(7.9), (7.10), (7.11)
// ═══════════════════════════════════════════════════════════════════

/** Ex = Q · (1 − T0/T)   Paper Eq.(7.9)   T in Kelvin */
export function exergy(Q: number, T_K: number, T0_K: number): number {
  if (T_K <= 0 || T0_K <= 0) return 0;
  return Q * (1 - T0_K / T_K);
}

/** Ex_gas = ṁ·cp·[(T−T0) − T0·ln(T/T0)]   Paper Eq.(7.11)   temperatures in K */
export function exergyGasStream(
  m_dot: number, cp: number,
  T_K: number, T0_K: number,
): number {
  if (T_K <= 0 || T0_K <= 0 || T_K === T0_K) return 0;
  return m_dot * cp * ((T_K - T0_K) - T0_K * Math.log(T_K / T0_K));
}

/** η_ex = P_net / Ex_input   Paper Eq.(7.10) */
export function exergyEfficiency(P_net: number, Ex_input: number): number {
  if (Ex_input <= 0) return 0;
  return P_net / Ex_input;
}

// ═══════════════════════════════════════════════════════════════════
// 10. ANNUAL ENERGY & ECONOMICS — Paper Eq.(7.12), (8.1)
// ═══════════════════════════════════════════════════════════════════

/** E_annual = P_net × operating_hours   Paper Eq.(7.12)  [kWh] */
export function annualEnergy(P_net_W: number, hours = 8760): number {
  return (P_net_W * hours) / 1000;  // kWh
}

/** PBP = Investment / Annual_net_savings   Paper Eq.(8.1)  [years] */
export function simplePayback(investment: number, annual_savings: number): number {
  if (annual_savings <= 0) return Infinity;
  return investment / annual_savings;
}

// ═══════════════════════════════════════════════════════════════════
// 11. COMPLETE TEG CALCULATION
// ═══════════════════════════════════════════════════════════════════

export function calculateTEGResult(
  teg: TEGModule,
  R_load: number,
  T_h: number,
  T_c: number,
  Q_h: number,
  R_conv_h: number,
  R_cond_h: number,
  R_c_h: number,
  R_TEG: number,
  R_c_c: number,
  R_hs: number,
): TEGResult {
  const dT = Math.max(0, T_h - T_c);                           // Paper Eq.(1)
  const Voc = openCircuitVoltage(teg.N_couples, teg.alpha, dT); // Paper Eq.(2)
  const P_elec = electricalPower(Voc, R_load, teg.R_int);       // Paper Eq.(7.4)
  const P_max  = maxElectricalPower(Voc, teg.R_int);             // Paper Eq.(7.5)
  const V_load = loadVoltage(Voc, R_load, teg.R_int);
  const I_load = loadCurrent(Voc, R_load, teg.R_int);

  const { Q_c, energy_balance_error } = heatBalance(Q_h, P_elec); // Paper Eq.(15)
  const eta_th = thermalEfficiency(P_elec, Q_h);                   // Paper Eq.(7.6)

  const warnings: string[] = [];
  if (dT < 10) warnings.push('ΔT across legs < 10 K — very low thermoelectric output');
  if (eta_th > 0.15) warnings.push('η_th > 15% — verify module properties');
  if (T_h > 300) warnings.push('T_h > 300°C — verify TEG module temperature rating');
  if (energy_balance_error > 1) warnings.push(`Energy balance error: ${energy_balance_error.toFixed(2)} W`);

  return {
    Voc,
    V_load,
    I_load,
    P_elec,
    P_max,
    eta_th,
    T_h,
    T_c,
    dT_legs: dT,
    Q_h,
    Q_c,
    Q_loss: 0,
    energy_balance_error,
    R_total: R_conv_h + R_cond_h + R_c_h + R_TEG + R_c_c + R_hs,
    R_conv_h,
    R_cond_h,
    R_c_h,
    R_TEG,
    R_c_c,
    R_hs_total: R_hs,
    warnings,
  };
}
