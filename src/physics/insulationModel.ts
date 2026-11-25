/**
 * TEG Simulation — Thermal Insulation Model
 *
 * Standard Engineering correlations — NOT from paper equations directly,
 * but required to complete the energy model.
 *
 * Uses: Paper Eq.(9) R_cond = L/(k·A)  for insulation resistance
 */

import type { InsulationConfig, InsulationResult } from './types';
import { INSULATION_MATERIALS } from './constants';

const MATERIAL_ALIASES: Record<string, string> = {
  ceramic_fiber: 'ceramicfiber',
  mineral_wool: 'rockwool',
  calcium_silicate: 'calciumsilicate',
  glass_wool: 'glasswool',
  rock_wool: 'rockwool',
};

export function resolveInsulationMaterial(material: string) {
  const key = MATERIAL_ALIASES[material] ?? material;
  return INSULATION_MATERIALS[key];
}

// ═══════════════════════════════════════════════════════════════════
// 1. INSULATION RESISTANCE  (Paper Eq.9 applied to insulation layer)
// ═══════════════════════════════════════════════════════════════════

/**
 * R_insulation = thickness / (k · area)
 * Paper Eq.(9): R_cond = L / (k · A)
 */
export function insulationResistance(
  material: string,
  thickness: number,  // m
  area: number,       // m²
): number {
  const mat = resolveInsulationMaterial(material);
  if (!mat) throw new Error(`Unknown insulation material: ${material}`);
  if (area <= 0) return Infinity;
  return Math.max(0.0005, thickness) / (mat.k * area);
}

// ═══════════════════════════════════════════════════════════════════
// 2. HEAT LOSS WITH INSULATION  (Paper Eq.14 applied to single layer)
// ═══════════════════════════════════════════════════════════════════

/**
 * Q_loss = ΔT / R_total
 * R_total = R_insulation + R_conv_outer
 * h_outer ≈ 8 W/(m²·K) for natural convection at outer surface (Standard Eng.)
 */
export function heatLossWithInsulation(
  T_inner: number,  // °C  inner surface temperature
  T_ambient: number, // °C
  R_insulation: number,  // K/W
  area: number,     // m²  outer surface for natural conv.
): number {
  if (area <= 0) return 0;
  // Natural convection at outer insulation surface (Standard Engineering)
  const h_outer = 8; // W/(m²·K)  typical natural convection at ~50-80°C surface
  const R_conv = 1 / (h_outer * area);
  const R_total = R_insulation + R_conv;
  if (R_total <= 0) return 0;
  return Math.max(0, (T_inner - T_ambient) / R_total);
}

// ═══════════════════════════════════════════════════════════════════
// 3. HEAT LOSS WITHOUT INSULATION  (Paper Eq.5 — Newton's Law)
// ═══════════════════════════════════════════════════════════════════

/**
 * Q̇ = h_eff · A · (Ts - T∞)   Paper Eq.(5) + radiation linearization
 * Bare heated metallic block loses heat by natural convection (~8 W/m²K)
 * plus thermal radiation (~4-6 W/m²K at elevated T) -> default h_bare ≈ 12 W/(m²·K).
 */
export function heatLossWithoutInsulation(
  T_surface: number,  // °C
  T_ambient: number,  // °C
  area: number,       // m²
  h_nat = 12,         // W/(m²·K) — bare block natural convection + radiation
): number {
  if (area <= 0) return 0;
  return Math.max(0, h_nat * area * (T_surface - T_ambient));
}

// ═══════════════════════════════════════════════════════════════════
// 4. REDUCTION PERCENTAGE
// ═══════════════════════════════════════════════════════════════════

/** Percentage reduction in heat loss due to insulation */
export function heatLossReduction(Q_no_ins: number, Q_with_ins: number): number {
  if (Q_no_ins <= 0) return 0;
  return Math.max(0, (Q_no_ins - Q_with_ins) / Q_no_ins) * 100;
}

// ═══════════════════════════════════════════════════════════════════
// 5. TEMPERATURE LIMIT VALIDATION
// ═══════════════════════════════════════════════════════════════════

export function validateInsulationTemp(
  material: string,
  T_operating: number, // °C
): { ok: boolean; warning?: string } {
  const mat = resolveInsulationMaterial(material);
  if (!mat) return { ok: false, warning: `Unknown material: ${material}` };
  if (T_operating > mat.T_max) {
    return {
      ok: false,
      warning: `Operating temperature ${T_operating.toFixed(0)} °C exceeds max service temp for ${mat.name} (${mat.T_max} °C)`,
    };
  }
  return { ok: true };
}

/**
 * Effective thermal resistance of the parasitic side heat-loss path (K/W).
 * - With insulation: R_insulation + 1 / (h_outer * area)
 * - Without insulation: 1 / (h_bare * area)
 */
export function insulationLossResistance(config: {
  enabled: boolean;
  material: string;
  thickness: number;
  area: number;
}): number {
  if (config.area <= 0) return Infinity;
  if (!config.enabled) {
    const h_bare = 12; // W/(m²·K) natural convection + radiation from bare hot block
    return 1 / (h_bare * config.area);
  }
  const h_outer = 8; // W/(m²·K) natural convection at outer insulation jacket
  const R_ins = insulationResistance(config.material, config.thickness, config.area);
  const R_conv_out = 1 / (h_outer * config.area);
  return R_ins + R_conv_out;
}

// ═══════════════════════════════════════════════════════════════════
// 6. FULL INSULATION CALCULATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate all insulation results for a given config.
 */
export function calculateInsulation(
  config: { enabled: boolean; material: string; thickness: number; area: number; location?: string },
  T_source: number,  // °C  temperature of insulated surface
  T_ambient: number, // °C
): InsulationResult {
  if (!config.enabled) {
    // No insulation — all heat lost from bare surface
    const Q_no_ins = heatLossWithoutInsulation(T_source, T_ambient, config.area);
    return {
      R_insulation: 0,
      Q_loss_with: Q_no_ins,
      Q_loss_without: Q_no_ins,
      reduction_pct: 0,
      temperature_ok: true,
    };
  }

  const R_ins = insulationResistance(config.material, config.thickness, config.area);
  const Q_no_ins = heatLossWithoutInsulation(T_source, T_ambient, config.area);
  const Q_with_ins = heatLossWithInsulation(T_source, T_ambient, R_ins, config.area);
  const reduction_pct = heatLossReduction(Q_no_ins, Q_with_ins);
  const { ok: temperature_ok, warning } = validateInsulationTemp(config.material, T_source);

  return {
    R_insulation: R_ins,
    Q_loss_with: Q_with_ins,
    Q_loss_without: Q_no_ins,
    reduction_pct,
    temperature_ok,
    warning,
  };
}
