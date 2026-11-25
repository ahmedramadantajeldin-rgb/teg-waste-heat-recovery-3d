/**
 * TEG Simulation — Unified Parametric Engineering Assembly Geometry
 *
 * Single source of truth linking physical dimensions across:
 *   - 3D CAD assembly (TEGScene & all scene3d sub-components)
 *   - Thermal & fluid solver (systemSolver, finAnalysis, insulationModel)
 *
 * Enforces:
 *   1. Dimensional consistency (TEG → spreaders → heater → heat sink base & fins)
 *   2. Guaranteed Fan-to-Fin & Fan-to-Flange safety clearances across all slider values
 *   3. Exact vertical stacking with zero Z-fighting or layer interpenetration
 *   4. Parametric insulation exposed surface area derived directly from hot components
 */

import type { SimulationState } from './types';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export interface ParametricAssemblyGeometry {
  // Heat sink base & fins
  finCount: number;
  finType: 'plate' | 'pin';
  H_fin: number;         // fin height (Y, m)
  t_fin: number;         // fin thickness or pin diameter (m)
  S_fin: number;         // fin spacing (m)
  t_base: number;        // lower & upper deck thickness (m)
  finsSpanZ: number;     // total width occupied by fins + gaps (m)
  hsLengthX: number;     // heat sink length along airflow X (m)
  hsWidthZ: number;      // heat sink width across fins Z (m)
  mountThickness: number;// bottom workbench flange thickness (m)
  mountWidthX: number;   // bottom flange X span (m)
  mountWidthZ: number;   // bottom flange Z span (m)

  // Stepped thermal layers
  coldSpreaderW: number; // X (m)
  coldSpreaderL: number; // Z (m)
  t_cold: number;        // Y (m)

  tegW: number;          // X (m)
  tegL: number;          // Z (m)
  t_teg: number;         // Y (m)
  A_teg: number;         // m²

  hotSpreaderW: number;  // X (m)
  hotSpreaderL: number;  // Z (m)
  t_hot: number;         // Y (m)

  heaterW: number;       // X (m)
  heaterL: number;       // Z (m)
  t_heater: number;      // Y (m)

  // Stack Y-coordinates (benchtop y = 0)
  y_hs_base: number;     // 0
  y_fin_mid: number;     // vertical center of fin channels
  y_hs_top: number;      // top surface of heat sink top deck
  y_cold: number;        // center Y of cold spreader
  y_teg: number;         // center Y of TEG module
  y_hot: number;         // center Y of hot spreader
  y_heater: number;      // center Y of heating block
  totalStackHeight: number;
  apparatusCenterY: number;

  // Fan sizing & parametric clearance positioning
  fanSize: number;       // square housing height/width (m)
  fanDepth: number;      // frame axial thickness (m)
  fanFootLength: number; // bench mounting foot length X (m)
  fanClearanceFins: number;   // gap between fan outlet and fins leading edge (m)
  fanClearanceFlange: number; // gap between fan foot and heat sink flange (m)
  fanX: number;          // center X of fan housing (m)
  fanY: number;          // center Y of fan rotor (never clips workbench)

  // Display & Workbench parametric coordinates
  displayX: number;
  displayZ: number;
  benchWidthX: number;
  benchDepthZ: number;

  // Parametric surface areas for thermal physics (m²)
  A_cold_spreader: number;
  A_hot_spreader: number;
  A_heater_top: number;
  A_hot_collector: number; // effective source coupling area
  A_insulation_geom: number; // exposed heated surface area (heater + hot spreader)
}

export function computeAssemblyGeometry(
  state: SimulationState,
  explodeView = false,
): ParametricAssemblyGeometry {
  const { fin, teg, t_spreader_h, t_spreader_c } = state;

  // ── 1. TEG Module (Parametric from A_module) ────────────────────────────────
  const A_teg_raw = teg.A_module > 0 ? teg.A_module : 0.0016;
  const tegSide = clamp(Math.sqrt(A_teg_raw), 0.024, 0.080);
  const tegW = tegSide;
  const tegL = tegSide;
  const t_teg = 0.0076; // 7.6 mm industrial stack (alumina ceramics + Bi2Te3 pellets + interconnects)
  const A_teg = tegW * tegL;

  // ── 2. Stepped Thermal Spreaders & Heater Block (Parametrically linked to TEG) ──
  // Compact copper hot flange (keeps TEG ceramic & pellet array clearly exposed to light)
  const hotSpreaderW = Math.max(tegW + 0.009, tegW * 1.22);
  const hotSpreaderL = Math.max(tegL + 0.009, tegL * 1.22);
  const t_hot = clamp(t_spreader_h > 0 ? t_spreader_h : 0.0035, 0.002, 0.012);

  // Heater sits squarely inside hot spreader leaving outer flange lip for clamping screws
  const heaterW = hotSpreaderW * 0.80;
  const heaterL = hotSpreaderL * 0.80;
  const t_heater = clamp(Math.max(0.014, tegSide * 0.35), 0.012, 0.028);

  // Cold spreader steps outward smoothly onto the heat sink top deck
  const coldSpreaderW = Math.max(hotSpreaderW + 0.010, tegW * 1.48);
  const coldSpreaderL = Math.max(hotSpreaderL + 0.010, tegL * 1.48);
  const t_cold = clamp(t_spreader_c > 0 ? t_spreader_c : 0.0035, 0.002, 0.012);

  // ── 3. Heat Sink & Fin Dimensions (Parametrically consistent with fins + cold plate) ──
  const finCount = Math.max(2, Math.min(30, Math.round(fin.N > 0 ? fin.N : 12)));
  const finType = fin.type === 'pin' ? 'pin' : 'plate';
  const t_fin = clamp(fin.t > 0 ? fin.t : 0.002, 0.0005, 0.010);
  const S_fin = clamp(fin.S > 0 ? fin.S : 0.005, 0.001, 0.030);
  const H_fin = clamp(fin.H > 0 ? fin.H : 0.036, 0.005, 0.150);
  const t_base = clamp(fin.t_base > 0 ? fin.t_base : 0.005, 0.002, 0.015);

  const finsSpanZ = finCount * t_fin + (finCount - 1) * S_fin;
  const sideMarginZ = 0.006; // 3 mm edge margin per side

  // Base always spans at least all fins + margin AND supports the cold spreader cleanly
  const hsWidthZ = Math.max(fin.W_base > 0 ? fin.W_base : 0.08, finsSpanZ + sideMarginZ, coldSpreaderL + 0.008);
  const hsLengthX = Math.max(fin.L > 0 ? fin.L : 0.08, coldSpreaderW + 0.008);

  const mountThickness = 0.005;
  const mountWidthX = hsLengthX + 0.022;
  const mountWidthZ = hsWidthZ + 0.022;

  // ── 4. Vertical Stack Y Coordinates (Benchtop strictly y = 0) ───────────────
  const y_hs_base = 0;
  const y_fin_mid = y_hs_base + mountThickness + t_base + H_fin / 2;
  const totalHsHeight = mountThickness + t_base + H_fin + t_base;
  const y_hs_top = y_hs_base + totalHsHeight;

  const dy_cold = explodeView ? 0.014 : 0;
  const dy_teg = explodeView ? 0.032 : 0;
  const dy_hot = explodeView ? 0.054 : 0;
  const dy_heater = explodeView ? 0.080 : 0;

  const y_cold = y_hs_top + t_cold / 2 + dy_cold;
  const y_teg = y_hs_top + t_cold + t_teg / 2 + dy_teg;
  const y_hot = y_hs_top + t_cold + t_teg + t_hot / 2 + dy_hot;
  const y_heater = y_hs_top + t_cold + t_teg + t_hot + t_heater / 2 + dy_heater;

  const totalStackHeight = y_heater + t_heater / 2;
  const apparatusCenterY = totalStackHeight * 0.48;

  // ── 5. Cooling Fan Dimensions & Guaranteed Clearance ────────────────────────
  const fanSize = clamp(
    Math.max(H_fin + 2 * t_base + 0.010, Math.min(hsWidthZ * 0.72, 0.095)),
    0.044,
    0.095,
  );
  const fanDepth = clamp(fanSize * 0.34, 0.016, 0.028);
  const fanFootLength = fanDepth * 1.45;

  // Minimum 25mm air plenum clearance from fin intake OR 25% of heat sink length,
  // AND minimum 8mm floor gap from heat sink bottom mounting flange.
  const desiredFinGap = Math.max(0.025, hsLengthX * 0.25);
  const minFlangeGap = 0.008;

  const xFanRearByFin = -hsLengthX / 2 - desiredFinGap;
  const xFanRearByFlange = -mountWidthX / 2 - minFlangeGap - fanFootLength / 2;
  const xFanRear = Math.min(xFanRearByFin, xFanRearByFlange);

  const fanX = xFanRear - fanDepth / 2;
  const fanClearanceFins = -hsLengthX / 2 - xFanRear;
  const fanClearanceFlange = -mountWidthX / 2 - (fanX + fanFootLength / 2);

  // Keep fan vertically aligned with fin channels, clamped so housing clears bench foot (6mm)
  const fanY = Math.max(y_fin_mid, fanSize / 2 + 0.006);

  // ── 6. Electrical Display & Workbench Sizing ────────────────────────────────
  const displayX = mountWidthX / 2 + 0.056;
  const displayZ = Math.max(0.022, mountWidthZ * 0.26);

  const xLeftMost = fanX - fanDepth / 2 - 0.03;
  const xRightMost = displayX + 0.05;
  const benchWidthX = Math.max(0.42, xRightMost - xLeftMost + 0.06);
  const benchDepthZ = Math.max(0.28, mountWidthZ + 0.14);

  // ── 7. Parametric Surface Areas for Thermal Solver ──────────────────────────
  const A_cold_spreader = coldSpreaderW * coldSpreaderL;
  const A_hot_spreader = hotSpreaderW * hotSpreaderL;
  const A_heater_top = heaterW * heaterL;

  // Exposed heated side walls + top shoulder + heater top that lose heat without insulation
  const A_heater_sides = 2 * (heaterW + heaterL) * t_heater;
  const A_hot_spreader_sides = 2 * (hotSpreaderW + hotSpreaderL) * t_hot;
  const A_hot_shoulder = Math.max(0, A_hot_spreader - A_heater_top);
  const A_insulation_geom = A_heater_sides + A_hot_spreader_sides + A_heater_top + A_hot_shoulder;

  // Hot collector effective contact/convection area (heater + spreader envelope)
  const A_hot_collector = Math.max(0.008, A_heater_top + A_heater_sides + A_hot_spreader_sides);

  return {
    finCount,
    finType,
    H_fin,
    t_fin,
    S_fin,
    t_base,
    finsSpanZ,
    hsLengthX,
    hsWidthZ,
    mountThickness,
    mountWidthX,
    mountWidthZ,
    coldSpreaderW,
    coldSpreaderL,
    t_cold,
    tegW,
    tegL,
    t_teg,
    A_teg,
    hotSpreaderW,
    hotSpreaderL,
    t_hot,
    heaterW,
    heaterL,
    t_heater,
    y_hs_base,
    y_fin_mid,
    y_hs_top,
    y_cold,
    y_teg,
    y_hot,
    y_heater,
    totalStackHeight,
    apparatusCenterY,
    fanSize,
    fanDepth,
    fanFootLength,
    fanClearanceFins,
    fanClearanceFlange,
    fanX,
    fanY,
    displayX,
    displayZ,
    benchWidthX,
    benchDepthZ,
    A_cold_spreader,
    A_hot_spreader,
    A_heater_top,
    A_hot_collector,
    A_insulation_geom,
  };
}
