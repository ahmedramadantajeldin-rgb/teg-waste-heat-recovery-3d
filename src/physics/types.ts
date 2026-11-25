/**
 * TEG Waste Heat Recovery Simulation — Type Definitions
 * All interfaces used across the physics engine modules.
 */

export interface FinGeometry {
  type: 'plate' | 'pin';
  N: number;         // fin count
  L: number;         // fin length (m)
  H: number;         // fin height (m)
  t: number;         // fin thickness (m)
  S: number;         // fin spacing (m)
  W_base: number;    // base width (m)
  L_base: number;    // base length (m)
  t_base: number;    // base thickness (m)
  material: 'aluminum' | 'copper' | 'steel';
}

export interface TEGModule {
  N_couples: number;   // number of thermocouple pairs
  alpha: number;       // Seebeck coefficient (V/K)
  R_int: number;       // internal electrical resistance (Ω)
  K_teg: number;       // thermal conductance (W/K)
  R_teg: number;       // thermal resistance (K/W)
  R_contact_h: number; // hot-side contact resistance (K/W)
  R_contact_c: number; // cold-side contact resistance (K/W)
  A_module: number;    // module area (m²)
}

export interface InsulationConfig {
  enabled: boolean;
  material: 'glasswool' | 'rockwool' | 'ceramicfiber' | 'calciumsilicate' | 'aerogel' | 'polyurethane';
  thickness: number;   // m
  area: number;        // m²
  autoArea?: boolean;  // true = parametrically derived from hot assembly geometry
  location: 'heat_source_sides' | 'spreader_sides' | 'both';
}

export interface ConvectionConditions {
  mode: 'natural' | 'forced' | 'mixed';
  fanEnabled: boolean;
  V_air: number;       // m/s (for forced)
  T_inf: number;       // ambient °C
  fanEfficiency: number; // 0-1
  /** characteristic length for convection (fin height or duct hydraulic diameter) */
  L_char?: number;     // m
  /** fin channel width (m) for duct hydraulic diameter calculation */
  W_channel?: number;  // m
  /** duct/channel length in flow direction (m) */
  L_channel?: number;  // m
}

export interface SimulationState {
  // Heat source
  T_source: number;    // °C hot side source
  T_ambient: number;   // °C ambient
  q_source: number;    // W available heat
  emissivity_source: number;

  // TEG module
  teg: TEGModule;
  R_load: number;      // load resistance (Ω)

  // Fin geometry
  fin: FinGeometry;

  // Convection
  convection: ConvectionConditions;

  // Insulation
  insulation: InsulationConfig;

  // Spreader plate
  t_spreader_h: number;  // hot-side spreader thickness (m)
  t_spreader_c: number;  // cold-side spreader thickness (m)
  k_spreader: number;    // spreader thermal conductivity W/(m·K)
}

// ─── Intermediate / result types ────────────────────────────────────────────

export interface AirProperties {
  T_C: number;   // film temperature °C
  rho: number;   // density kg/m³
  mu: number;    // dynamic viscosity Pa·s
  k: number;     // thermal conductivity W/(m·K)
  cp: number;    // specific heat J/(kg·K)
  Pr: number;    // Prandtl number
  nu: number;    // kinematic viscosity m²/s
  alpha_th: number; // thermal diffusivity m²/s
  beta: number;  // thermal expansion coefficient 1/K  (ideal gas: 1/(T_K))
}

export interface ConvectionResult {
  mode: string;
  Re?: number;
  Gr?: number;
  Ra?: number;
  Pr: number;
  Nu: number;
  h: number;           // W/(m²·K)
  dP?: number;         // Pa pressure drop
  correlationUsed: string;
  validityRange: string;
}

export interface FinResult {
  eta_f: number;       // fin efficiency 0-1   (Paper Eq.20)
  epsilon_f: number;   // fin effectiveness    (Paper Eq.24)
  eta_o: number;       // overall surface efficiency (Paper Eq.25)
  Af: number;          // total fin area m²
  Ab: number;          // exposed base area m²
  At: number;          // total area m²
  m_param: number;     // fin parameter m (1/m)  (Paper Eq.22)
  Lc: number;          // corrected length m     (Paper Eq.23)
  Q_fin: number;       // heat transfer rate W
  R_hs: number;        // heat sink resistance K/W  (Paper Eq.19)
  warnings: string[];
}

export interface TEGResult {
  Voc: number;         // V   (Paper Eq.2)
  V_load: number;      // V
  I_load: number;      // A
  P_elec: number;      // W   (Paper Eq.7.4)
  P_max: number;       // W (at matched load) (Paper Eq.7.5)
  eta_th: number;      // thermal efficiency  (Paper Eq.7.6)
  T_h: number;         // actual hot-side module temp °C
  T_c: number;         // actual cold-side module temp °C
  dT_legs: number;     // ΔT across legs   (Paper Eq.1)
  Q_h: number;         // W heat input
  Q_c: number;         // W heat rejected
  Q_loss: number;      // W heat loss to environment
  energy_balance_error: number; // W (should be near 0) — Eq.15 check
  // Resistance network (Paper Eq.13)
  R_total: number;     // K/W
  R_conv_h: number;    // K/W
  R_cond_h: number;    // K/W
  R_c_h: number;       // K/W
  R_TEG: number;       // K/W
  R_c_c: number;       // K/W
  R_hs_total: number;  // K/W
  warnings: string[];
}

export interface InsulationResult {
  R_insulation: number;     // K/W
  Q_loss_with: number;      // W
  Q_loss_without: number;   // W
  reduction_pct: number;    // %
  temperature_ok: boolean;  // within material limit
  warning?: string;
}

export interface SystemResult {
  P_net: number;       // W   (Paper Eq.27 / Eq.7.7)
  P_fan: number;       // W   (Paper Eq.30)
  P_pump: number;      // W
  eta_sys: number;     // overall system efficiency (Paper Eq.7.8)
  Ex_input: number;    // W exergy input (Paper Eq.7.9)
  eta_ex: number;      // exergy efficiency (Paper Eq.7.10)
  E_annual: number;    // kWh/year (Paper Eq.7.12)
}

export interface SimulationResults {
  convection: ConvectionResult;
  fin: FinResult;
  teg: TEGResult;
  insulation: InsulationResult;
  system: SystemResult;
  warnings: string[];
  timestamp: number;
}

// ─── Optimisation types ─────────────────────────────────────────────────────

export interface OptConstraints {
  N_fins_min?: number;
  N_fins_max?: number;
  S_min?: number;      // m
  S_max?: number;      // m
  V_air_min?: number;  // m/s
  V_air_max?: number;  // m/s
  P_net_min?: number;  // W  — discard configs below this threshold
  max_results?: number;
}

export interface OptResult {
  N_fins: number;
  S: number;           // m
  V_air: number;       // m/s
  P_net: number;       // W
  eta_sys: number;
  R_hs: number;        // K/W
  eta_f: number;
  h: number;           // W/(m²·K)
}

// ─── Saved case type ────────────────────────────────────────────────────────

export interface SavedCase {
  id: string;
  name: string;
  timestamp: number;
  state: SimulationState;
  results: SimulationResults | null;
}

export type DesignLabel = 'A' | 'B' | 'C' | 'D' | 'E';

export interface DesignVariant {
  label: DesignLabel;
  description: string;
  state: SimulationState;
}

export interface DesignComparisonResult {
  label: DesignLabel;
  description: string;
  results: SimulationResults;
}
