/**
 * TEG Simulation — Design Optimization
 *
 * Defines 5 standard design variants (A–E) and
 * provides parametric sweep utilities.
 */

import type {
  SimulationState,
  DesignLabel,
  DesignVariant,
  DesignComparisonResult,
  OptConstraints,
  OptResult,
} from './types';
import { defaultSimState } from '../store/simulationStore';
import { solveAll } from './systemSolver';

// ═══════════════════════════════════════════════════════════════════
// 1. STANDARD DESIGN VARIANTS A–E
// ═══════════════════════════════════════════════════════════════════

export const DESIGN_VARIANTS: DesignVariant[] = [
  {
    label: 'A',
    description: 'Baseline — Natural convection, 8 fins, no insulation',
    state: {
      ...defaultSimState,
      fin: { ...defaultSimState.fin, N: 8, H: 0.04, S: 0.006 },
      convection: { mode: 'natural', fanEnabled: false, V_air: 0, T_inf: 25, fanEfficiency: 0.6 },
      insulation: { ...defaultSimState.insulation, enabled: false },
    },
  },
  {
    label: 'B',
    description: 'Forced convection V=2 m/s, 8 fins, no insulation',
    state: {
      ...defaultSimState,
      fin: { ...defaultSimState.fin, N: 8, H: 0.04, S: 0.006 },
      convection: { mode: 'forced', fanEnabled: true, V_air: 2.0, T_inf: 25, fanEfficiency: 0.6 },
      insulation: { ...defaultSimState.insulation, enabled: false },
    },
  },
  {
    label: 'C',
    description: 'Forced V=3 m/s, optimised 12 fins (S=5mm), no insulation',
    state: {
      ...defaultSimState,
      fin: { ...defaultSimState.fin, N: 12, H: 0.05, S: 0.005 },
      convection: { mode: 'forced', fanEnabled: true, V_air: 3.0, T_inf: 25, fanEfficiency: 0.65 },
      insulation: { ...defaultSimState.insulation, enabled: false },
    },
  },
  {
    label: 'D',
    description: 'Natural conv, 14 optimised fins, insulation on heat source',
    state: {
      ...defaultSimState,
      fin: { ...defaultSimState.fin, N: 14, H: 0.05, S: 0.004 },
      convection: { mode: 'natural', fanEnabled: false, V_air: 0, T_inf: 25, fanEfficiency: 0.6 },
      insulation: { ...defaultSimState.insulation, enabled: true, material: 'ceramicfiber', thickness: 0.05 },
    },
  },
  {
    label: 'E',
    description: 'Forced V=2 m/s, 14 optimised fins, ceramic fibre insulation',
    state: {
      ...defaultSimState,
      fin: { ...defaultSimState.fin, N: 14, H: 0.05, S: 0.004 },
      convection: { mode: 'forced', fanEnabled: true, V_air: 2.0, T_inf: 25, fanEfficiency: 0.65 },
      insulation: { ...defaultSimState.insulation, enabled: true, material: 'ceramicfiber', thickness: 0.05 },
    },
  },
];

// ═══════════════════════════════════════════════════════════════════
// 2. DESIGN COMPARISON
// ═══════════════════════════════════════════════════════════════════

/**
 * Run all 5 standard designs and return sorted results (best P_net first).
 */
export function runDesignComparison(baseState?: SimulationState): DesignComparisonResult[] {
  return DESIGN_VARIANTS.map((v): DesignComparisonResult => {
    // Optionally override TEG and source conditions from baseState
    const stateToRun: SimulationState = baseState
      ? { ...v.state, T_source: baseState.T_source, T_ambient: baseState.T_ambient, teg: baseState.teg, R_load: baseState.R_load }
      : v.state;
    const results = solveAll(stateToRun);
    return { label: v.label, description: v.description, results };
  }).sort((a, b) => b.results.system.P_net - a.results.system.P_net);
}

// ═══════════════════════════════════════════════════════════════════
// 3. PARAMETRIC SWEEP
// ═══════════════════════════════════════════════════════════════════

export interface SweepConfig {
  N_range?: number[];     // number of fins to sweep
  S_range?: number[];     // spacing values (m)
  V_range?: number[];     // air velocity values (m/s)
}

/**
 * Run a parametric sweep over N_fins, S, V_air.
 * Returns array of OptResult sorted by P_net descending.
 */
export function parametricSweep(
  baseState: SimulationState,
  sweep: SweepConfig,
  constraints: OptConstraints = {},
): OptResult[] {
  const N_arr = sweep.N_range ?? [6, 8, 10, 12, 14, 16];
  const S_arr = sweep.S_range ?? [0.004, 0.006, 0.008, 0.010];
  const V_arr = sweep.V_range ?? [0, 1, 2, 3, 4];

  const results: OptResult[] = [];

  for (const N of N_arr) {
    for (const S of S_arr) {
      for (const V of V_arr) {
        // Respect constraints
        if (constraints.N_fins_min && N < constraints.N_fins_min) continue;
        if (constraints.N_fins_max && N > constraints.N_fins_max) continue;
        if (constraints.S_min && S < constraints.S_min) continue;
        if (constraints.S_max && S > constraints.S_max) continue;
        if (constraints.V_air_min && V < constraints.V_air_min) continue;
        if (constraints.V_air_max && V > constraints.V_air_max) continue;

        const state: SimulationState = {
          ...baseState,
          fin: { ...baseState.fin, N, S },
          convection: {
            ...baseState.convection,
            mode: V > 0 ? 'forced' : 'natural',
            fanEnabled: V > 0,
            V_air: V,
          },
        };

        try {
          const r = solveAll(state);
          const opt: OptResult = {
            N_fins: N,
            S,
            V_air: V,
            P_net: r.system.P_net,
            eta_sys: r.system.eta_sys,
            R_hs: r.fin.R_hs,
            eta_f: r.fin.eta_f,
            h: r.convection.h,
          };

          if (constraints.P_net_min && opt.P_net < constraints.P_net_min) continue;
          results.push(opt);
        } catch {
          // skip invalid configs
        }
      }
    }
  }

  // Sort by P_net descending
  results.sort((a, b) => b.P_net - a.P_net);

  return constraints.max_results ? results.slice(0, constraints.max_results) : results;
}
