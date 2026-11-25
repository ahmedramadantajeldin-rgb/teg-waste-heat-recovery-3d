import { useMemo } from 'react';
import { Slider, InfoRow, SectionPanel, Warnings } from '../shared';
import { PlotlyEngChart } from '../charts/PlotlyEngChart';
import { useSimulationStore } from '../../store/simulationStore';
import { openCircuitVoltage, electricalPower, maxElectricalPower, loadVoltage, loadCurrent } from '../../physics/tegModel';
import { C, FONT } from '../../design/theme';
import type { SimulationResults } from '../../physics/types';

interface TEGPerformancePageProps { results: SimulationResults | null }

export function TEGPerformancePage({ results }: TEGPerformancePageProps) {
  const store = useSimulationStore();
  const { teg } = store;

  const dT = results?.teg.dT_legs ?? (store.T_source - store.T_ambient) * 0.6;
  const Voc = openCircuitVoltage(teg.N_couples, teg.alpha, dT);

  const rlSweep = useMemo(() => {
    return Array.from({ length: 50 }, (_, i) => 0.1 + i * 0.3).map((RL) => ({
      RL, P: electricalPower(Voc, RL, teg.R_int),
      V: loadVoltage(Voc, RL, teg.R_int), I: loadCurrent(Voc, RL, teg.R_int),
    }));
  }, [Voc, teg.R_int]);

  const dtSweep = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => i * 10).map((dt) => {
      const voc = openCircuitVoltage(teg.N_couples, teg.alpha, dt);
      return { dt, P_max: maxElectricalPower(voc, teg.R_int), Voc: voc };
    });
  }, [teg]);

  const thSweep = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => 50 + i * 10).map((Th) => {
      const dt = Math.max(0, Th - store.T_ambient);
      const voc = openCircuitVoltage(teg.N_couples, teg.alpha, dt);
      const P = electricalPower(voc, store.R_load, teg.R_int);
      const Q_h_est = dt > 0 ? (Th - store.T_ambient) / (teg.R_teg || 1.667) : 0;
      return { Th, eta_th: Q_h_est > 0 ? (P / Q_h_est) * 100 : 0 };
    });
  }, [teg, store.T_ambient, store.R_load]);

  const tresult = results?.teg;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left controls */}
      <div style={{ width: 280, background: C.bg.secondary, borderRight: `1px solid ${C.bg.border}`, padding: '14px', overflowY: 'auto', flexShrink: 0 }}>

        <SectionPanel title="TEG Module Parameters">
          <Slider label="Module Size (Side)" value={Math.round(Math.sqrt(teg.A_module || 0.0016) * 1000)} min={24} max={64} step={2} unit=" mm"
            onChange={(sideMm) => {
              const sideM = sideMm / 1000;
              const newArea = sideM * sideM;
              const newK = 0.6 * (newArea / 0.0016);
              store.updateTEG({ A_module: newArea, K_teg: newK, R_teg: 1 / newK });
            }} formatVal={(v) => `${Math.round(v)}×${Math.round(v)}`} />
          <Slider label="N (thermocouple pairs)" value={teg.N_couples} min={10} max={300} step={1} unit=" pairs"
            onChange={(v) => store.updateTEG({ N_couples: Math.round(v) })} formatVal={(v) => Math.round(v).toString()} />
          <Slider label="Seebeck α (per couple)" value={teg.alpha * 1000} min={0.1} max={2.0} step={0.05} unit=" mV/K"
            onChange={(v) => store.updateTEG({ alpha: v / 1000 })} />
          <Slider label="R_int (Ω)" value={teg.R_int} min={0.5} max={10} step={0.1} unit=" Ω"
            onChange={(v) => store.updateTEG({ R_int: v })} />
          <Slider label="K_teg (W/K)" value={teg.K_teg} min={0.1} max={2.0} step={0.05} unit=" W/K"
            onChange={(v) => store.updateTEG({ K_teg: v, R_teg: 1 / v })} />
        </SectionPanel>

        <SectionPanel title="Thermal Contact Resistances" accentColor="#f97316">
          <Slider label="R_contact_hot (K/W)" value={teg.R_contact_h} min={0} max={0.5} step={0.01} unit=" K/W"
            onChange={(v) => store.updateTEG({ R_contact_h: v })} />
          <Slider label="R_contact_cold (K/W)" value={teg.R_contact_c} min={0} max={0.5} step={0.01} unit=" K/W"
            onChange={(v) => store.updateTEG({ R_contact_c: v })} />
        </SectionPanel>

        <SectionPanel title="Load Resistance (Eq.7.4)" accentColor={C.accent}>
          <Slider label="R_load (Ω)" value={store.R_load} min={0.1} max={20} step={0.1} unit=" Ω"
            onChange={store.setR_load} />
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {[teg.R_int * 0.5, teg.R_int, teg.R_int * 2].map((v, i) => (
              <button key={i} onClick={() => store.setR_load(v)} style={{
                flex: 1, padding: '4px 2px', border: `1px solid ${C.bg.border}`, borderRadius: 5,
                background: C.bg.card, color: C.text.secondary, fontSize: 9, cursor: 'pointer',
              }}>
                {i === 0 ? '½R_int' : i === 1 ? 'R_int (P_max)' : '2×R_int'}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: C.text.muted, padding: '0 8px' }}>
            R_int = {teg.R_int.toFixed(1)} Ω — set R_load = R_int for P_max
          </div>
        </SectionPanel>

        {tresult && (
          <SectionPanel title="Electrical Results" accentColor={C.success}>
            <InfoRow label="V_oc (Eq.2)"    value={tresult.Voc.toFixed(3)}     unit="V"  color="#a3e635" eq="Eq.2" />
            <InfoRow label="V_load"           value={tresult.V_load.toFixed(3)}  unit="V"  color="#86efac" />
            <InfoRow label="I_load"           value={tresult.I_load.toFixed(3)}  unit="A"  color="#67e8f9" />
            <InfoRow label="P_elec (Eq.7.4)" value={tresult.P_elec.toFixed(3)}  unit="W"  color={C.accent} eq="Eq.7.4" />
            <InfoRow label="P_max (Eq.7.5)"  value={tresult.P_max.toFixed(3)}   unit="W"  color="#c4b5fd" eq="Eq.7.5" />
            <InfoRow label="η_th (Eq.7.6)"   value={`${(tresult.eta_th * 100).toFixed(2)}%`} color="#facc15" eq="Eq.7.6" />
            <InfoRow label="ΔT_legs (Eq.1)"  value={tresult.dT_legs.toFixed(1)} unit="K"  color="#fde68a" eq="Eq.1" />
            {/* Energy balance check */}
            <div style={{
              margin: '8px 0 0', padding: '6px 8px',
              background: tresult.energy_balance_error < 0.5 ? '#0a1f0d' : '#1a0808',
              borderRadius: 5, border: `1px solid ${tresult.energy_balance_error < 0.5 ? C.success : C.error}44`,
              fontSize: 10, fontFamily: FONT.mono, color: C.text.secondary,
            }}>
              <span style={{ color: tresult.energy_balance_error < 0.5 ? C.success : C.error, fontWeight: 700 }}>
                {tresult.energy_balance_error < 0.5 ? '✓' : '⚠'}
              </span>
              {' '}Balance error: {tresult.energy_balance_error.toFixed(3)} W
            </div>
            <Warnings warnings={tresult.warnings} />
          </SectionPanel>
        )}
      </div>

      {/* Right charts */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 2, overflow: 'hidden', background: C.bg.primary, padding: 2 }}>
        <div style={{ background: C.bg.card, borderRadius: 6, overflow: 'hidden' }}>
          <PlotlyEngChart title="R_load vs P_elec — Bell Curve (Eq.7.4)"
            data={[
              { x: rlSweep.map(d => d.RL), y: rlSweep.map(d => d.P), type: 'scatter', mode: 'lines', name: 'P_elec (W)', line: { color: '#58a6ff', width: 2 } },
              { x: [store.R_load], y: [electricalPower(Voc, store.R_load, teg.R_int)], type: 'scatter', mode: 'markers', name: 'Operating Point', marker: { color: C.error, size: 10, symbol: 'star' } },
            ]}
            layout={{ xaxis: { title: 'R_load (Ω)' }, yaxis: { title: 'P_elec (W)' } }} />
        </div>
        <div style={{ background: C.bg.card, borderRadius: 6, overflow: 'hidden' }}>
          <PlotlyEngChart title="ΔT vs P_max (Eq.7.5)"
            data={[
              { x: dtSweep.map(d => d.dt), y: dtSweep.map(d => d.P_max), type: 'scatter', mode: 'lines', name: 'P_max (W)', line: { color: '#f97316', width: 2 } },
              { x: [dT], y: [maxElectricalPower(Voc, teg.R_int)], type: 'scatter', mode: 'markers', name: 'Current ΔT', marker: { color: '#3fb950', size: 10, symbol: 'star' } },
            ]}
            layout={{ xaxis: { title: 'ΔT (K)' }, yaxis: { title: 'P_max (W)' } }} />
        </div>
        <div style={{ background: C.bg.card, borderRadius: 6, overflow: 'hidden' }}>
          <PlotlyEngChart title="T_hot vs η_thermal (Eq.7.6)"
            data={[{ x: thSweep.map(d => d.Th), y: thSweep.map(d => d.eta_th), type: 'scatter', mode: 'lines', name: 'η_th (%)', line: { color: '#facc15', width: 2 } }]}
            layout={{ xaxis: { title: 'T_h (°C)' }, yaxis: { title: 'η_th (%)' } }} />
        </div>
        <div style={{ background: C.bg.card, borderRadius: 6, overflow: 'hidden' }}>
          <PlotlyEngChart title="R_load vs Voltage & Current"
            data={[
              { x: rlSweep.map(d => d.RL), y: rlSweep.map(d => d.V), type: 'scatter', mode: 'lines', name: 'V_load (V)', line: { color: '#3fb950', width: 2 } },
              { x: rlSweep.map(d => d.RL), y: rlSweep.map(d => d.I), type: 'scatter', mode: 'lines', name: 'I_load (A)', yaxis: 'y2', line: { color: '#f43f5e', width: 2, dash: 'dash' } },
            ]}
            layout={{ xaxis: { title: 'R_load (Ω)' }, yaxis: { title: 'V (V)' }, yaxis2: { title: 'I (A)', overlaying: 'y', side: 'right' } }} />
        </div>
      </div>
    </div>
  );
}
