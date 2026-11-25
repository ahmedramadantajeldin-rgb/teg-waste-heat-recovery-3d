import { useMemo, useState } from 'react';
import { PlotlyEngChart } from '../charts/PlotlyEngChart';
import { useSimulationStore, selectSimState } from '../../store/simulationStore';
import { calculateFinParams } from '../../physics/finAnalysis';
import { computeConvection, fanPower } from '../../physics/convection';
import { openCircuitVoltage, electricalPower, maxElectricalPower } from '../../physics/tegModel';
import { resolveInsulationMaterial } from '../../physics/insulationModel';
import { computeAssemblyGeometry } from '../../physics/assemblyGeometry';
import { C } from '../../design/theme';
import type { SimulationResults } from '../../physics/types';

interface GraphsPageProps { results: SimulationResults | null }

const TAB_NAMES = [
  '1 · Fin H vs η_f',
  '2 · N fins vs Q',
  '3 · Velocity vs h + P_fan',
  '4 · ΔT vs P_max',
  '5 · T_hot vs η_th',
  '6 · R_load vs P',
  '7 · Insulation',
  '8 · 3D: N×H → Q',
  '9 · 3D: Th×Tc → P',
];

export function GraphsPage({ results }: GraphsPageProps) {
  const [activeTab, setActiveTab] = useState(0);
  const store = useSimulationStore();
  const { fin, convection, teg } = store;
  const h = results?.convection.h ?? 15;
  const dT = results?.teg.dT_legs ?? (store.T_source - store.T_ambient) * 0.6;
  const Voc = openCircuitVoltage(teg.N_couples, teg.alpha, dT);

  const c0 = useMemo(() =>
    Array.from({ length: 25 }, (_, i) => 0.01 + i * 0.006).map((H) => {
      const f = calculateFinParams({ ...fin, H }, h, results?.teg.T_c ?? 60, store.T_ambient);
      return { H: H * 1000, eta_f: f.eta_f * 100, eta_o: f.eta_o * 100 };
    })
  , [fin, h, results, store.T_ambient]);

  const c1 = useMemo(() =>
    Array.from({ length: 25 }, (_, i) => i + 2).map((N) => ({
      N, Q: calculateFinParams({ ...fin, N }, h, results?.teg.T_c ?? 60, store.T_ambient).Q_fin,
    }))
  , [fin, h, results, store.T_ambient]);

  const c2 = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => i * 0.5).map((V) => {
      const mode = V > 0 ? 'forced' : 'natural';
      const cv = computeConvection({ ...convection, mode, V_air: V }, results?.teg.T_c ?? 60, fin.H, fin.S, fin.L);
      const P_f = V > 0 && cv.dP ? fanPower(cv.dP, V * Math.max(1, fin.N - 1) * fin.S * fin.H, convection.fanEfficiency) : 0;
      return { V, h: cv.h, P_fan: P_f };
    })
  , [convection, fin, results]);

  const c3 = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => i * 10).map((dt) => ({
      dt, P_max: maxElectricalPower(openCircuitVoltage(teg.N_couples, teg.alpha, dt), teg.R_int),
    }))
  , [teg]);

  const c4 = useMemo(() =>
    Array.from({ length: 25 }, (_, i) => 50 + i * 12).map((Th) => {
      const dt = Math.max(0, Th - store.T_ambient);
      const voc = openCircuitVoltage(teg.N_couples, teg.alpha, dt);
      const P = electricalPower(voc, store.R_load, teg.R_int);
      const Q_h = teg.K_teg * dt;
      return { Th, eta_th: Q_h > 0 ? (P / Q_h) * 100 : 0 };
    })
  , [teg, store.T_ambient, store.R_load]);

  const c5 = useMemo(() =>
    Array.from({ length: 50 }, (_, i) => 0.1 + i * 0.3).map((RL) => ({ RL, P: electricalPower(Voc, RL, teg.R_int) }))
  , [Voc, teg.R_int]);

  const c6 = useMemo(() => {
    const m = resolveInsulationMaterial(store.insulation.material);
    const geomA = computeAssemblyGeometry(selectSimState(store), false).A_insulation_geom;
    const effArea = store.insulation.autoArea === false && store.insulation.area > 0 ? store.insulation.area : geomA;
    return Array.from({ length: 20 }, (_, i) => 0.01 + i * 0.01).map((t) => {
      const R = m ? t / (m.k * effArea) : t / (0.04 * effArea);
      return { t: t * 100, Q_loss: (store.T_source - store.T_ambient) / (R + 1 / (8 * effArea)) };
    });
  }, [store, store.insulation, store.T_source, store.T_ambient]);

  const s3D_NL = useMemo(() => {
    const Ns = [4, 6, 8, 10, 12, 14, 16], Ls = [0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08];
    return { x: Ls.map(l => l * 1000), y: Ns, z: Ns.map(N => Ls.map(H => calculateFinParams({ ...fin, N, H }, h, results?.teg.T_c ?? 60, store.T_ambient).Q_fin)) };
  }, [fin, h, results, store.T_ambient]);

  const s3D_ThTc = useMemo(() => {
    const ths = Array.from({ length: 8 }, (_, i) => 100 + i * 25);
    const tcs = Array.from({ length: 8 }, (_, i) => 20 + i * 10);
    return { x: tcs, y: ths, z: ths.map(Th => tcs.map(Tc => maxElectricalPower(openCircuitVoltage(teg.N_couples, teg.alpha, Math.max(0, Th - Tc)), teg.R_int))) };
  }, [teg]);

  const charts = [
    <PlotlyEngChart key={0} title="Fin Height H vs Efficiency η_f / η_o (Eq.20, 25)"
      data={[
        { x: c0.map(d => d.H), y: c0.map(d => d.eta_f), type: 'scatter', mode: 'lines', name: 'η_f (%)', line: { color: '#58a6ff', width: 2 } },
        { x: c0.map(d => d.H), y: c0.map(d => d.eta_o), type: 'scatter', mode: 'lines', name: 'η_o (%)', line: { color: '#f97316', width: 2, dash: 'dash' } },
      ]}
      layout={{ xaxis: { title: 'H (mm)' }, yaxis: { title: 'Efficiency (%)' } }} />,
    <PlotlyEngChart key={1} title="Fin Count N vs Heat Transfer Rate Q_fin"
      data={[{ x: c1.map(d => d.N), y: c1.map(d => d.Q), type: 'scatter', mode: 'lines+markers', name: 'Q_fin (W)', line: { color: '#f97316', width: 2 } }]}
      layout={{ xaxis: { title: 'N fins' }, yaxis: { title: 'Q_fin (W)' } }} />,
    <PlotlyEngChart key={2} title="Air Velocity vs h and P_fan (Eq.5, 30)"
      data={[
        { x: c2.map(d => d.V), y: c2.map(d => d.h), type: 'scatter', mode: 'lines', name: 'h (W/m²K)', line: { color: '#58a6ff', width: 2 } },
        { x: c2.map(d => d.V), y: c2.map(d => d.P_fan), type: 'scatter', mode: 'lines', name: 'P_fan (W)', yaxis: 'y2', line: { color: C.error, width: 2, dash: 'dash' } },
      ]}
      layout={{ xaxis: { title: 'V_air (m/s)' }, yaxis: { title: 'h (W/m²K)' }, yaxis2: { title: 'P_fan (W)', overlaying: 'y', side: 'right' } }} />,
    <PlotlyEngChart key={3} title="ΔT vs P_max (Paper Eq.7.5)"
      data={[{ x: c3.map(d => d.dt), y: c3.map(d => d.P_max), type: 'scatter', mode: 'lines', name: 'P_max (W)', line: { color: '#3fb950', width: 2 } }]}
      layout={{ xaxis: { title: 'ΔT (K)' }, yaxis: { title: 'P_max (W)' } }} />,
    <PlotlyEngChart key={4} title="T_hot vs η_thermal (Paper Eq.7.6)"
      data={[{ x: c4.map(d => d.Th), y: c4.map(d => d.eta_th), type: 'scatter', mode: 'lines', name: 'η_th (%)', line: { color: '#facc15', width: 2 } }]}
      layout={{ xaxis: { title: 'T_h (°C)' }, yaxis: { title: 'η_th (%)' } }} />,
    <PlotlyEngChart key={5} title="R_load vs P_elec — Bell Curve (Eq.7.4)"
      data={[
        { x: c5.map(d => d.RL), y: c5.map(d => d.P), type: 'scatter', mode: 'lines', name: 'P_elec (W)', line: { color: '#58a6ff', width: 2 } },
        { x: [teg.R_int], y: [maxElectricalPower(Voc, teg.R_int)], type: 'scatter', mode: 'markers', name: 'P_max at R_int', marker: { color: C.error, size: 12, symbol: 'star' } },
      ]}
      layout={{ xaxis: { title: 'R_load (Ω)' }, yaxis: { title: 'P_elec (W)' } }} />,
    <PlotlyEngChart key={6} title="Insulation Thickness vs Q_loss (Eq.9)"
      data={[{ x: c6.map(d => d.t), y: c6.map(d => d.Q_loss), type: 'scatter', mode: 'lines', name: 'Q_loss (W)', line: { color: '#6ee7b7', width: 2 } }]}
      layout={{ xaxis: { title: 'Thickness (cm)' }, yaxis: { title: 'Q_loss (W)' } }} />,
    <PlotlyEngChart key={7} title="3D: Fin Count × Fin Height → Q_fin"
      data={[{ x: s3D_NL.x, y: s3D_NL.y, z: s3D_NL.z, type: 'surface', colorscale: 'Portland', name: 'Q_fin (W)' }] as any}
      layout={{ scene: { xaxis: { title: 'H (mm)' }, yaxis: { title: 'N fins' }, zaxis: { title: 'Q_fin (W)' } } }} />,
    <PlotlyEngChart key={8} title="3D: T_hot × T_cold → P_max (Eq.7.5)"
      data={[{ x: s3D_ThTc.x, y: s3D_ThTc.y, z: s3D_ThTc.z, type: 'surface', colorscale: 'Hot', name: 'P_max (W)' }] as any}
      layout={{ scene: { xaxis: { title: 'T_c (°C)' }, yaxis: { title: 'T_h (°C)' }, zaxis: { title: 'P_max (W)' } } }} />,
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: C.bg.primary }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', overflowX: 'auto', background: C.bg.secondary, borderBottom: `1px solid ${C.bg.border}`, flexShrink: 0 }}>
        {TAB_NAMES.map((name, i) => (
          <button key={i} onClick={() => setActiveTab(i)} style={{
            padding: '9px 14px', whiteSpace: 'nowrap', cursor: 'pointer',
            background: 'transparent',
            color: activeTab === i ? C.accent : C.text.secondary,
            borderBottom: `2px solid ${activeTab === i ? C.accent : 'transparent'}`,
            borderTop: 'none', borderLeft: 'none', borderRight: 'none',
            fontSize: 11, fontWeight: activeTab === i ? 600 : 400,
            transition: 'color 0.15s',
          }}>
            {name}
          </button>
        ))}
      </div>
      {/* Chart fills remaining space */}
      <div style={{ flex: 1, padding: 8, overflow: 'hidden', background: C.bg.card, borderRadius: 0 }}>
        {charts[activeTab]}
      </div>
    </div>
  );
}
