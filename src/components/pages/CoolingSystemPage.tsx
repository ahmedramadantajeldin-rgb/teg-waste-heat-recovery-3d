import { useMemo } from 'react';
import { Slider, InfoRow, SectionPanel, ToggleBtn, Warnings } from '../shared';
import { PlotlyEngChart } from '../charts/PlotlyEngChart';
import { useSimulationStore } from '../../store/simulationStore';
import { computeConvection, fanPower } from '../../physics/convection';
import { C, FONT } from '../../design/theme';
import type { SimulationResults } from '../../physics/types';

interface CoolingSystemPageProps { results: SimulationResults | null }

export function CoolingSystemPage({ results }: CoolingSystemPageProps) {
  const store = useSimulationStore();
  const { convection, fin } = store;

  const vSweep = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => i * 0.5).map((V) => {
      const mode = V > 0 ? 'forced' : 'natural';
      const c = computeConvection({ ...convection, mode, V_air: V }, results?.teg.T_c ?? 60, fin.H, fin.S, fin.L);
      const N_ch = Math.max(1, fin.N - 1);
      const V_dot = V > 0 ? V * N_ch * fin.S * fin.H : 0;
      const P_f = V > 0 && c.dP ? fanPower(c.dP, V_dot, convection.fanEfficiency) : 0;
      return { V, h: c.h, P_fan: P_f };
    });
  }, [fin, convection, results]);

  const modeOptions = [
    { id: 'natural', label: '🌿 Natural Convection', desc: 'Churchill-Chu correlation (Eq.5)', color: '#3fb950' },
    { id: 'forced',  label: '🌀 Forced Convection',  desc: 'Dittus-Boelter / Gnielinski',    color: C.accent },
    { id: 'mixed',   label: '⚡ Mixed Convection',   desc: 'Richardson number Ri criterion',  color: '#f97316' },
  ] as const;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left controls */}
      <div style={{ width: 270, background: C.bg.secondary, borderRight: `1px solid ${C.bg.border}`, padding: '14px', overflowY: 'auto', flexShrink: 0 }}>

        <SectionPanel title="Convection Mode">
          {modeOptions.map((m) => (
            <button key={m.id} onClick={() => store.updateConvection({ mode: m.id, fanEnabled: m.id !== 'natural', V_air: m.id === 'natural' ? 0 : convection.V_air || 2 })}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: 5,
                borderRadius: 6, cursor: 'pointer',
                background: convection.mode === m.id ? '#1f6feb11' : C.bg.card,
                color: convection.mode === m.id ? m.color : C.text.secondary,
                border: `1px solid ${convection.mode === m.id ? m.color + '66' : C.bg.border}`,
              }}>
              <div style={{ fontSize: 11, fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontSize: 9, color: C.text.muted, marginTop: 1 }}>{m.desc}</div>
            </button>
          ))}
        </SectionPanel>

        <SectionPanel title="Fan Settings" accentColor="#7dd3fc">
          <ToggleBtn label="Fan Enabled" value={convection.fanEnabled} onChange={() => store.toggleFan()} colorOn={C.accent} />
          <div style={{ marginTop: 8 }}>
            <Slider label="Air Velocity V_air" value={convection.V_air} min={0} max={10} step={0.5} unit=" m/s"
              onChange={(v) => store.updateConvection({ V_air: v })} />
            <Slider label="Fan Efficiency η_fan" value={convection.fanEfficiency} min={0.3} max={0.9} step={0.05}
              onChange={(v) => store.updateConvection({ fanEfficiency: v })}
              formatVal={(v) => `${(v * 100).toFixed(0)}%`} />
          </div>
        </SectionPanel>

        {results && (
          <SectionPanel title="Convection Results" accentColor={C.success}>
            <InfoRow label="Conv. Coefficient h" value={results.convection.h.toFixed(1)} unit="W/m²K" color={C.accent} eq="Eq.5" />
            <InfoRow label="Fan Power" value={results.system.P_fan.toFixed(2)} unit="W" color="#f97316" eq="Eq.30" />
            <div style={{ padding: '5px 8px', fontSize: 10, color: C.text.secondary, fontFamily: FONT.mono, borderBottom: `1px solid ${C.bg.border}` }}>
              {results.convection.correlationUsed}
            </div>
            <div style={{ padding: '5px 8px', fontSize: 9, color: C.text.muted }}>
              {results.convection.validityRange}
            </div>
            <Warnings warnings={results.warnings.filter(w => w.includes('flow') || w.includes('fan') || w.includes('Fan'))} />
          </SectionPanel>
        )}
      </div>

      {/* Right content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.bg.primary }}>
        {/* Mode comparison strip */}
        <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderBottom: `1px solid ${C.bg.border}`, background: C.bg.secondary }}>
          {modeOptions.map((m) => (
            <div key={m.id} style={{
              flex: 1, background: C.bg.card, border: `1px solid ${convection.mode === m.id ? m.color + '66' : C.bg.border}`,
              borderRadius: 7, padding: '10px 12px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: m.color, marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 20, fontFamily: FONT.mono, fontWeight: 700, color: convection.mode === m.id ? m.color : C.text.secondary }}>
                {results?.convection.h.toFixed(1) ?? '—'}
                <span style={{ fontSize: 10, color: C.text.muted, marginLeft: 3 }}>W/m²K</span>
              </div>
              <div style={{ fontSize: 9, color: C.text.muted, marginTop: 2 }}>{m.desc}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, overflow: 'hidden', padding: 2 }}>
          <div style={{ background: C.bg.card, borderRadius: 6, overflow: 'hidden' }}>
            <PlotlyEngChart title="Air Velocity vs h coefficient (Eq.5)"
              data={[{ x: vSweep.map(d => d.V), y: vSweep.map(d => d.h), type: 'scatter', mode: 'lines+markers', name: 'h (W/m²K)', line: { color: '#58a6ff', width: 2 } }]}
              layout={{ xaxis: { title: 'V_air (m/s)' }, yaxis: { title: 'h (W/m²K)' } }} />
          </div>
          <div style={{ background: C.bg.card, borderRadius: 6, overflow: 'hidden' }}>
            <PlotlyEngChart title="Air Velocity vs Fan Power (Eq.30)"
              data={[
                { x: vSweep.map(d => d.V), y: vSweep.map(d => d.h), type: 'scatter', mode: 'lines', name: 'h (W/m²K)', line: { color: '#58a6ff', width: 2 } },
                { x: vSweep.map(d => d.V), y: vSweep.map(d => d.P_fan), type: 'scatter', mode: 'lines', name: 'P_fan (W)', yaxis: 'y2', line: { color: '#f97316', width: 2 } },
              ]}
              layout={{ xaxis: { title: 'V_air (m/s)' }, yaxis: { title: 'h (W/m²K)' }, yaxis2: { title: 'P_fan (W)', overlaying: 'y', side: 'right' } }} />
          </div>
        </div>
      </div>
    </div>
  );
}
