/**
 * TEG Simulation — Material Properties & Physical Constants
 *
 * Sources:
 *  - Incropera, Fundamentals of Heat and Mass Transfer, 7th Ed.
 *  - Cengel & Ghajar, Heat and Mass Transfer, 5th Ed.
 *  - Paper reference equations noted where applicable.
 */

// ═══════════════════════════════════════════════════════════════════
// 1. FUNDAMENTAL CONSTANTS
// ═══════════════════════════════════════════════════════════════════

/** Stefan-Boltzmann constant  σ = 5.670e-8 W/(m²·K⁴)  — Paper Eq.(6) */
export const STEFAN_BOLTZMANN = 5.670e-8; // W/(m²·K⁴)

/** Standard gravity */
export const G_STD = 9.81; // m/s²

/** Reference (ambient) temperature for exergy calculations */
export const T0_DEFAULT_C = 25; // °C
export const T0_DEFAULT_K = 298.15; // K

// ═══════════════════════════════════════════════════════════════════
// 2. FIN MATERIAL THERMAL CONDUCTIVITIES  W/(m·K)
//    (at ~25 °C unless noted)
// ═══════════════════════════════════════════════════════════════════

export interface MaterialProps {
  k: number;        // thermal conductivity W/(m·K)
  rho: number;      // density kg/m³
  cp: number;       // specific heat J/(kg·K)
  T_max: number;    // max service temperature °C
  name: string;
}

export const FIN_MATERIALS: Record<string, MaterialProps> = {
  aluminum: {
    k: 237,
    rho: 2700,
    cp: 900,
    T_max: 400,
    name: 'Aluminum (6061-T6)',
  },
  copper: {
    k: 401,
    rho: 8960,
    cp: 385,
    T_max: 300,
    name: 'Copper (pure)',
  },
  steel: {
    k: 50,
    rho: 7850,
    cp: 490,
    T_max: 600,
    name: 'Carbon Steel',
  },
};

/** Spreader / heat-spreader plate conductivities */
export const SPREADER_MATERIALS: Record<string, MaterialProps> = {
  aluminum: { ...FIN_MATERIALS.aluminum },
  copper: { ...FIN_MATERIALS.copper },
  graphite: { k: 150, rho: 2200, cp: 710, T_max: 500, name: 'Graphite composite' },
};

// ═══════════════════════════════════════════════════════════════════
// 3. INSULATION MATERIAL PROPERTIES
// ═══════════════════════════════════════════════════════════════════

export interface InsulationMaterialProps {
  k: number;        // thermal conductivity W/(m·K) at typical operating T
  rho: number;      // density kg/m³
  T_max: number;    // maximum service temperature °C
  name: string;
  note: string;
}

export const INSULATION_MATERIALS: Record<string, InsulationMaterialProps> = {
  glasswool: {
    k: 0.040,
    rho: 25,
    T_max: 300,
    name: 'Glass Wool',
    note: 'Common, low-cost; suitable up to ~300 °C',
  },
  rockwool: {
    k: 0.038,
    rho: 60,
    T_max: 750,
    name: 'Rock Wool (Mineral Wool)',
    note: 'Good acoustic + fire resistance; common in industrial settings',
  },
  ceramicfiber: {
    k: 0.14,
    rho: 128,
    T_max: 1260,
    name: 'Ceramic Fibre Blanket',
    note: 'High-temperature industrial insulation; Amrize plant default',
  },
  calciumsilicate: {
    k: 0.085,
    rho: 240,
    T_max: 1000,
    name: 'Calcium Silicate Board',
    note: 'Rigid; resistant to moisture; common in pipes & furnaces',
  },
  aerogel: {
    k: 0.015,
    rho: 150,
    T_max: 650,
    name: 'Aerogel Blanket',
    note: 'Ultra-low conductivity; premium cost',
  },
  polyurethane: {
    k: 0.025,
    rho: 40,
    T_max: 120,
    name: 'Polyurethane Foam',
    note: 'Low-temperature only; cheap; not suitable for waste-heat above 120 °C',
  },
};

// ═══════════════════════════════════════════════════════════════════
// 4. AIR PROPERTY LOOKUP TABLE
//    Temperature range: 20 – 300 °C  (1 atm, dry air)
//    Columns: T(°C), ρ(kg/m³), μ(μPa·s), k(mW/(m·K)), cp(J/(kg·K)), Pr
//    Source: Incropera App.A, Table A.4
// ═══════════════════════════════════════════════════════════════════

export interface AirTableRow {
  T: number;    // °C
  rho: number;  // kg/m³
  mu: number;   // Pa·s  (dynamic viscosity)
  k: number;    // W/(m·K)
  cp: number;   // J/(kg·K)
  Pr: number;
}

/** Tabulated air properties at 1 atm. Used by getAirProperties() in convection.ts */
export const AIR_TABLE: AirTableRow[] = [
  // T,     rho,     mu,          k,        cp,      Pr
  {T:  20, rho: 1.204, mu: 1.825e-5, k: 0.02551, cp: 1007, Pr: 0.7296},
  {T:  25, rho: 1.184, mu: 1.849e-5, k: 0.02625, cp: 1007, Pr: 0.7268},
  {T:  30, rho: 1.165, mu: 1.872e-5, k: 0.02625, cp: 1007, Pr: 0.7256},
  {T:  40, rho: 1.127, mu: 1.918e-5, k: 0.02756, cp: 1007, Pr: 0.7240},
  {T:  50, rho: 1.093, mu: 1.963e-5, k: 0.02826, cp: 1007, Pr: 0.7220},
  {T:  60, rho: 1.060, mu: 2.008e-5, k: 0.02896, cp: 1008, Pr: 0.7202},
  {T:  70, rho: 1.029, mu: 2.052e-5, k: 0.02966, cp: 1008, Pr: 0.7183},
  {T:  80, rho: 1.000, mu: 2.096e-5, k: 0.03047, cp: 1008, Pr: 0.7154},
  {T: 100, rho: 0.9458, mu: 2.181e-5, k: 0.03095, cp: 1011, Pr: 0.7111},
  {T: 120, rho: 0.8980, mu: 2.264e-5, k: 0.03279, cp: 1013, Pr: 0.7073},
  {T: 140, rho: 0.8542, mu: 2.345e-5, k: 0.03374, cp: 1016, Pr: 0.7041},
  {T: 160, rho: 0.8150, mu: 2.420e-5, k: 0.03565, cp: 1019, Pr: 0.7014},
  {T: 180, rho: 0.7788, mu: 2.504e-5, k: 0.03661, cp: 1022, Pr: 0.6986},
  {T: 200, rho: 0.7459, mu: 2.577e-5, k: 0.03779, cp: 1025, Pr: 0.6974},
  {T: 230, rho: 0.6935, mu: 2.690e-5, k: 0.03978, cp: 1030, Pr: 0.6965},
  {T: 250, rho: 0.6748, mu: 2.760e-5, k: 0.04093, cp: 1033, Pr: 0.6955},
  {T: 300, rho: 0.6072, mu: 2.934e-5, k: 0.04418, cp: 1044, Pr: 0.6937},
];

// ═══════════════════════════════════════════════════════════════════
// 5. DEFAULT TEG MODULE PARAMETERS
//    Based on a typical BiTe commercial module (40×40 mm, 127 couples)
//    Calibrated against Amrize cement-plant case study data:
//    peak net 7.7 kW / 573 cartridges  → ~13.4 W per cartridge
// ═══════════════════════════════════════════════════════════════════

export interface TEGDefaultModule {
  N_couples: number;
  alpha: number;        // V/K  (Seebeck)
  R_int: number;        // Ω
  K_teg: number;        // W/K
  R_teg: number;        // K/W
  R_contact_h: number;  // K/W
  R_contact_c: number;  // K/W
  A_module: number;     // m²
}

export const DEFAULT_TEG_MODULE: TEGDefaultModule = {
  N_couples: 127,
  alpha: 0.053,         // 53 mV/K — typical for BiTe module at 150–200 °C
  R_int: 2.5,           // Ω
  K_teg: 0.6,           // W/K
  R_teg: 1 / 0.6,      // ≈ 1.667 K/W
  R_contact_h: 0.05,   // K/W  (~ 5e-5 m²·K/W TIM over 40×40 mm)
  R_contact_c: 0.05,   // K/W
  A_module: 0.04 * 0.04, // 0.0016 m²
};

// ═══════════════════════════════════════════════════════════════════
// 6. DEFAULT SIMULATION STATE (Amrize cement-plant baseline)
// ═══════════════════════════════════════════════════════════════════

import type { SimulationState } from './types';

export const DEFAULT_STATE: SimulationState = {
  T_source: 350,          // °C  hot exhaust gas
  T_ambient: 25,          // °C
  q_source: 5000,         // W  available heat per cartridge assembly
  emissivity_source: 0.85,

  teg: { ...DEFAULT_TEG_MODULE },
  R_load: DEFAULT_TEG_MODULE.R_int, // matched load for P_max

  fin: {
    type: 'plate',
    N: 10,
    L: 0.08,     // 80 mm fin length
    H: 0.05,     // 50 mm fin height
    t: 0.002,    // 2 mm thickness
    S: 0.008,    // 8 mm spacing
    W_base: 0.10,
    L_base: 0.10,
    t_base: 0.004,
    material: 'aluminum',
  },

  convection: {
    mode: 'forced',
    fanEnabled: true,
    V_air: 2.5,
    T_inf: 25,
    fanEfficiency: 0.65,
    L_char: 0.05,  // fin height
  },

  insulation: {
    enabled: true,
    material: 'ceramicfiber',
    thickness: 0.05,   // 50 mm
    area: 0.04,        // m²
    location: 'heat_source_sides',
  },

  t_spreader_h: 0.004,
  t_spreader_c: 0.004,
  k_spreader: 237,       // aluminium spreader
};

// ═══════════════════════════════════════════════════════════════════
// 7. HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Convert °C to K */
export const toK = (C: number): number => C + 273.15;

/** Convert K to °C */
export const toC = (K: number): number => K - 273.15;

/** Clamp value within [min, max] */
export const clamp = (val: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, val));
