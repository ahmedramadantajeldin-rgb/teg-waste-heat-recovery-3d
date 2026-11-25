/**
 * TEG Simulation — Master System Solver
 *
 * Orchestrates all coupled sub-models via unified parametric geometry:
 *   1. Parametric assembly geometry (computeAssemblyGeometry)
 *   2. Convection (natural / forced / mixed) with actual fin channel dimensions
 *   3. Fin efficiency and heat sink resistance (Paper Eq.19-25)
 *   4. Parallel-series thermal resistance network WITH insulation branch:
 *        Hot source --[R_conv_h]--> T_hot_block
 *          ├── Useful TEG branch  --[R_cond_h + R_c_h + R_TEG + R_c_c + R_cond_c + R_hs]--> T_ambient
 *          └── Side loss branch   --[R_loss (insulated or bare)]---------------------------> T_ambient
 *   5. TEG electrical + thermal energy balance (Paper Eq.1,2,14,15,7.4-7.12,30)
 */

import type { SimulationState, SimulationResults } from './types';
import { computeAssemblyGeometry } from './assemblyGeometry';
import { computeConvection, fanPower } from './convection';
import { calculateFinParams } from './finAnalysis';
import {
  buildResistanceNetwork,
  calculateTEGResult,
  netPower,
  systemEfficiency,
  exergy,
  exergyEfficiency,
  annualEnergy,
} from './tegModel';
import { calculateInsulation, insulationLossResistance } from './insulationModel';
import { FIN_MATERIALS, toK, T0_DEFAULT_K } from './constants';

export function solveAll(state: SimulationState): SimulationResults {
  const {
    T_source,
    T_ambient,
    fin,
    convection,
    teg,
    R_load,
    insulation,
    k_spreader,
  } = state;

  const warnings: string[] = [];

  // ── 1. Unified Parametric Assembly Geometry ──────────────────────
  const geom = computeAssemblyGeometry(state, false);

  // Sync fin geometry used by physics with parametric manufacturing bounds
  const finGeomEff = {
    ...fin,
    N: geom.finCount,
    type: geom.finType,
    L: geom.hsLengthX,
    L_base: geom.hsLengthX,
    W_base: geom.hsWidthZ,
    H: geom.H_fin,
    t: geom.t_fin,
    S: geom.S_fin,
    t_base: geom.t_base,
  };

  // Parametric insulated area (unless user explicitly customized in Insulation page)
  const A_ins_eff =
    insulation.autoArea === false && insulation.area > 0
      ? insulation.area
      : geom.A_insulation_geom;

  const insConfig = {
    ...insulation,
    area: A_ins_eff,
  };

  // Hot collector coupling conductance & resistance (independent of cold fin L)
  const h_hot = 220; // W/(m²·K) pressurized collector / cartridge interface conductance
  const A_hot_collector = geom.A_hot_collector;
  const k_cold_spreader = FIN_MATERIALS.aluminum.k;

  // Cold spreader conduction resistance Eq.(9)
  const R_cond_c = geom.t_cold / (k_cold_spreader * geom.A_cold_spreader);
  // Parasitic side heat-loss thermal resistance (bare vs insulated)
  const R_loss = insulationLossResistance(insConfig);

  // ── 2. Iterative Thermal-Convective Solve ────────────────────────
  let T_hs_base_guess = T_ambient + 15;
  let convResult = computeConvection(
    { ...convection, T_inf: T_ambient },
    T_hs_base_guess,
    geom.H_fin,
    geom.S_fin,
    geom.hsLengthX,
  );
  let finResult = calculateFinParams(finGeomEff, convResult.h, T_hs_base_guess, T_ambient);

  let net = buildResistanceNetwork(
    h_hot,
    A_hot_collector,
    geom.t_hot,
    k_spreader > 0 ? k_spreader : 385,
    geom.A_hot_spreader,
    teg.R_contact_h,
    teg,
    teg.R_contact_c + R_cond_c,
    finResult.R_hs,
  );

  let T_hot_block = T_source;
  let Q_total = 0;
  let Q_h_teg = 0;
  let Q_loss_sides = 0;
  let T_h_teg = T_source;
  let T_c_teg = T_ambient;
  let T_hs_base = T_hs_base_guess;

  for (let iter = 0; iter < 50; iter++) {
    convResult = computeConvection(
      { ...convection, T_inf: T_ambient },
      T_hs_base_guess,
      geom.H_fin,
      geom.S_fin,
      geom.hsLengthX,
    );

    finResult = calculateFinParams(finGeomEff, convResult.h, T_hs_base_guess, T_ambient);

    net = buildResistanceNetwork(
      h_hot,
      A_hot_collector,
      geom.t_hot,
      k_spreader > 0 ? k_spreader : 385,
      geom.A_hot_spreader,
      teg.R_contact_h,
      teg,
      teg.R_contact_c + R_cond_c,
      finResult.R_hs,
    );

    // Parallel split at heated block node (T_hot_block):
    //   Branch 1 (Useful TEG path): R_useful = R_cond_h + R_c_h + R_TEG + (R_c_c + R_cond_c) + R_hs
    //   Branch 2 (Side heat loss):  R_loss   = insulation resistance + outer conv (or bare surface conv+rad)
    const R_useful = net.R_cond_h + net.R_c_h + net.R_TEG + net.R_c_c + net.R_hs;
    const R_parallel = Number.isFinite(R_loss)
      ? (R_useful * R_loss) / (R_useful + R_loss)
      : R_useful;

    const dT_overall = Math.max(0, T_source - T_ambient);
    Q_total = dT_overall / (net.R_conv_h + R_parallel);
    T_hot_block = T_source - Q_total * net.R_conv_h;

    const dT_block = Math.max(0, T_hot_block - T_ambient);
    Q_h_teg = dT_block / R_useful;
    Q_loss_sides = Number.isFinite(R_loss) ? dT_block / R_loss : 0;

    T_h_teg = T_hot_block - Q_h_teg * (net.R_cond_h + net.R_c_h);
    T_c_teg = T_ambient + Q_h_teg * (net.R_hs + net.R_c_c);
    T_hs_base = T_ambient + Q_h_teg * net.R_hs;

    const error = Math.abs(T_hs_base - T_hs_base_guess);
    T_hs_base_guess = T_hs_base;
    if (error < 0.05) break;
  }

  // Evaluate final insulation metrics using exact converged hot block temperature
  const insulationResult = calculateInsulation(insConfig, T_hot_block, T_ambient);

  // Sync finResult Q_fin cleanly to final converged heat rejection
  finResult = calculateFinParams(finGeomEff, convResult.h, T_hs_base, T_ambient);

  // ── 3. TEG Electrical & Thermal Calculation ──────────────────────
  const tegResult = calculateTEGResult(
    teg,
    R_load,
    T_h_teg,
    T_c_teg,
    Q_h_teg,
    net.R_conv_h,
    net.R_cond_h,
    net.R_c_h,
    net.R_TEG,
    net.R_c_c,
    net.R_hs,
  );
  tegResult.Q_loss = Q_loss_sides;

  // ── 4. Fan Power — Paper Eq.(30) ─────────────────────────────────
  let P_fan = 0;
  if (convection.fanEnabled && convection.V_air > 0 && convResult.dP != null) {
    const N_channels = Math.max(1, geom.finCount - 1);
    const V_dot = convection.V_air * N_channels * geom.S_fin * geom.H_fin;
    P_fan = fanPower(convResult.dP, V_dot, convection.fanEfficiency);
  }

  // ── 5. System Metrics — Paper Eq.(7.7 - 7.12) ────────────────────
  const P_net = netPower(tegResult.P_elec, P_fan);
  const eta_sys = systemEfficiency(P_net, Q_total);

  const T0_K = T0_DEFAULT_K;
  const T_source_K = toK(T_source);
  const Ex_input = exergy(Q_total, T_source_K, T0_K);
  const eta_ex = exergyEfficiency(P_net, Ex_input);
  const E_annual = annualEnergy(P_net);

  // ── 6. Engineering Warnings ──────────────────────────────────────
  warnings.push(...tegResult.warnings);
  warnings.push(...finResult.warnings);
  if (insulationResult.warning) warnings.push(insulationResult.warning);
  if (P_net < 0) {
    warnings.push(`Net power is negative (${P_net.toFixed(2)} W) — fan consumes more than TEG generates.`);
  }
  if (Math.abs(tegResult.energy_balance_error) > 0.5) {
    warnings.push(
      `Energy balance error: ${tegResult.energy_balance_error.toFixed(2)} W — check model inputs.`,
    );
  }
  if (Q_total > 0 && Q_loss_sides > Q_total * 0.35 && !insulation.enabled) {
    warnings.push(
      `Uninsulated side heat loss is ${Q_loss_sides.toFixed(1)} W (${((Q_loss_sides / Q_total) * 100).toFixed(0)}%) — enabling thermal insulation improves output.`,
    );
  }

  return {
    convection: convResult,
    fin: finResult,
    teg: tegResult,
    insulation: insulationResult,
    system: {
      P_net,
      P_fan,
      P_pump: 0,
      eta_sys,
      Ex_input,
      eta_ex,
      E_annual,
    },
    warnings,
    timestamp: Date.now(),
  };
}
