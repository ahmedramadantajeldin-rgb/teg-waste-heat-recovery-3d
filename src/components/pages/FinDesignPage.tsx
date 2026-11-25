import { useMemo } from 'react';
import { Slider, InfoRow, SectionPanel, Warnings } from '../shared';
import { PlotlyEngChart } from '../charts/PlotlyEngChart';
import { useSimulationStore } from '../../store/simulationStore';
import { calculateFinParams } from '../../physics/finAnalysis';
import { C } from '../../design/theme';
import type { SimulationResults } from '../../physics/types';

interface FinDesignPageProps { results: SimulationResults | null }

const FIN_MATERIALS = ['aluminum', 'copper', 'steel'] as const;
const MAT_DETAILS: Record<string, { k: string; desc: string }> = {
  aluminum: { k: '237', desc: 'Aluminum 6061-T6' },
  copper:   { k: '401', desc: 'Copper (pure)' },
  steel:    { k: '50',  desc: 'Carbon Steel' },
};

export function FinDesignPage({ results }: FinDesignPageProps) {
  const store = useSimulationStore();
  const { fin } = store;

  const lengthSweep = useMemo(() => {
    const h = results?.convection.h ?? 15;
    return Array.from({ length: 20 }, (_, i) => 0.01 + i * 0.005).map((H) => {
      const f = calculateFinParams({ ...fin, H }, h, results?.teg.T_c ?? 60, store.T_ambient);
      return { L: H * 1000, eta_f: f.eta_f * 100, R_hs: f.R_hs };
    });
  }, [fin, results, store.T_ambient]);

  const nSweep = useMemo(() => {
    const h = results?.convection.h ?? 15;
    return Array.from({ length: 20 }, (_, i) => i + 2).map((N) => {
      const f = calculateFinParams({ ...fin, N }, h, results?.teg.T_c ?? 60, store.T_ambient);
      return { N, Q: f.Q_fin, eta_o: f.eta_o * 100 };
    });
  }, [fin, results, store.T_ambient]);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left — controls */}
      <div style={{ width: 270, background: C.bg.secondary, borderRight: `1px solid ${C.bg.border}`, padding: '14px 14px', overflowY: 'auto', flexShrink: 0 }}>

        <SectionPanel title="Fin Geometry">
          {/* Fin Type */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: C.text.secondary, marginBottom: 5 }}>Fin Type</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['plate', 'pin'] as const).map((ft) => (
                <button key={ft} onClick={() => store.updateFin({ type: ft })} style={{
                  flex: 1, padding: '6px', border: `1px solid ${fin.type === ft ? C.accent : C.bg.border}`,
                  borderRadius: 5, background: fin.type === ft ? '#1f6feb22' : C.bg.card,
                  color: fin.type === ft ? C.accent : C.text.secondary,
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}>
                  {ft === 'plate' ? 'Plate Fins' : 'Pin Fins'}
                </button>
              ))}
            </div>
          </div>
          <Slider label="Number of Fins N" value={fin.N} min={2} max={30} step={1} unit=" fins"
            onChange={(v) => store.updateFin({ N: Math.round(v) })} formatVal={(v) => Math.round(v).toString()} />
          <Slider label="Fin Height H" value={fin.H * 1000} min={5} max={150} step={2.5} unit=" mm"
            onChange={(v) => store.updateFin({ H: v / 1000 })} />
          <Slider label="Fin Length L (flow dir)" value={fin.L * 1000} min={10} max={200} step={5} unit=" mm"
            onChange={(v) => store.updateFin({ L: v / 1000 })} />
          <Slider label="Fin Thickness t" value={fin.t * 1000} min={0.5} max={10} step={0.25} unit=" mm"
            onChange={(v) => store.updateFin({ t: v / 1000 })} />
          <Slider label="Fin Spacing S" value={fin.S * 1000} min={1} max={30} step={0.5} unit=" mm"
            onChange={(v) => store.updateFin({ S: v / 1000 })} />
          <Slider label="Base Width W" value={fin.W_base * 1000} min={30} max={200} step={5} unit=" mm"
            onChange={(v) => store.updateFin({ W_base: v / 1000 })} />
        </SectionPanel>

        <SectionPanel title="Fin Material" accentColor="#f97316">
          {FIN_MATERIALS.map((m) => (
            <button key={m} onClick={() => store.updateFin({ material: m })} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '7px 10px', marginBottom: 4, borderRadius: 6, cursor: 'pointer',
              background: fin.material === m ? '#1f6feb11' : C.bg.card,
              color: fin.material === m ? C.accent : C.text.secondary,
              border: `1px solid ${fin.material === m ? C.accent : C.bg.border}`,
              fontSize: 11,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 1 }}>{MAT_DETAILS[m].desc}</div>
              <div style={{ fontSize: 9, color: C.text.muted }}>k = {MAT_DETAILS[m].k} W/m·K</div>
            </button>
          ))}
        </SectionPanel>

        {results && (
          <SectionPanel title="Results (Paper Eqs.)" accentColor={C.success}>
            <InfoRow label="η_f Fin Efficiency" value={(results.fin.eta_f * 100).toFixed(1)} unit="%" color="#7dd3fc" eq="Eq.20" />
            <InfoRow label="η_o Overall Efficiency" value={(results.fin.eta_o * 100).toFixed(1)} unit="%" color="#a5b4fc" eq="Eq.25" />
            <InfoRow label="ε_f Effectiveness" value={results.fin.epsilon_f.toFixed(2)} color="#6ee7b7" eq="Eq.24" />
            <InfoRow label="R_hs Heat Sink" value={results.fin.R_hs.toFixed(4)} unit="K/W" eq="Eq.19" />
            <InfoRow label="Total Area A_t" value={(results.fin.At * 1e4).toFixed(1)} unit="cm²" />
            <InfoRow label="m·Lc parameter" value={results.fin.m_param.toFixed(2)} color={results.fin.m_param > 5 ? C.error : C.text.primary} eq="Eq.22" />
            <Warnings warnings={results.fin.warnings} />
          </SectionPanel>
        )}
      </div>

      {/* Right — 2×2 chart grid */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 2, overflow: 'hidden', background: C.bg.primary, padding: 2 }}>
        <div style={{ background: C.bg.card, borderRadius: 6, overflow: 'hidden' }}>
          <PlotlyEngChart title="Fin Height H vs Efficiency η_f (Eq.20)"
            data={[{ x: lengthSweep.map(d => d.L), y: lengthSweep.map(d => d.eta_f), type: 'scatter', mode: 'lines+markers', name: 'η_f (%)', line: { color: '#58a6ff', width: 2 }, marker: { color: '#58a6ff', size: 5 } }]}
            layout={{ xaxis: { title: 'H (mm)' }, yaxis: { title: 'η_f (%)' } }} />
        </div>
        <div style={{ background: C.bg.card, borderRadius: 6, overflow: 'hidden' }}>
          <PlotlyEngChart title="Fin Count N vs Heat Transfer Rate"
            data={[{ x: nSweep.map(d => d.N), y: nSweep.map(d => d.Q), type: 'scatter', mode: 'lines+markers', name: 'Q_fin (W)', line: { color: '#f97316', width: 2 }, marker: { color: '#f97316', size: 5 } }]}
            layout={{ xaxis: { title: 'Number of fins N' }, yaxis: { title: 'Q_fin (W)' } }} />
        </div>
        <div style={{ background: C.bg.card, borderRadius: 6, overflow: 'hidden' }}>
          <PlotlyEngChart title="Heat Sink Resistance vs Fin Height (Eq.19)"
            data={[{ x: lengthSweep.map(d => d.L), y: lengthSweep.map(d => d.R_hs), type: 'scatter', mode: 'lines', name: 'R_hs (K/W)', line: { color: '#a78bfa', width: 2 } }]}
            layout={{ xaxis: { title: 'H (mm)' }, yaxis: { title: 'R_hs (K/W)' } }} />
        </div>
        <div style={{ background: C.bg.card, borderRadius: 6, overflow: 'hidden' }}>
          <PlotlyEngChart title="N Fins vs Overall Surface Efficiency (Eq.25)"
            data={[{ x: nSweep.map(d => d.N), y: nSweep.map(d => d.eta_o), type: 'scatter', mode: 'lines+markers', name: 'η_o (%)', line: { color: '#3fb950', width: 2 }, marker: { color: '#3fb950', size: 5 } }]}
            layout={{ xaxis: { title: 'Number of fins N' }, yaxis: { title: 'η_o (%)' } }} />
        </div>
      </div>
    </div>
  );
}
