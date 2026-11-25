import { useState, useMemo } from 'react';
import { PlotlyEngChart } from '../charts/PlotlyEngChart';
import { useSimulationStore, selectSimState } from '../../store/simulationStore';
import { runDesignComparison, parametricSweep } from '../../physics/optimization';
import { C, FONT } from '../../design/theme';
import { useViewport } from '../../design/useViewport';
import type { SimulationResults, DesignComparisonResult } from '../../physics/types';
import { Play } from 'lucide-react';

interface OptimizationPageProps { results: SimulationResults | null }

const DESIGN_COLORS: Record<string, string> = {
  A: '#8b949e', B: '#58a6ff', C: '#3fb950', D: '#facc15', E: '#f97316',
};

export function OptimizationPage({ results: _results }: OptimizationPageProps) {
  const store = useSimulationStore();
  const { isCompact } = useViewport();
  const [comparison, setComparison] = useState<DesignComparisonResult[] | null>(() =>
    runDesignComparison(selectSimState(store)),
  );
  const [running, setRunning] = useState(false);

  const handleRun = () => {
    setRunning(true);
    setTimeout(() => {
      const baseState = selectSimState(store);
      setComparison(runDesignComparison(baseState));
      setRunning(false);
    }, 50);
  };

  const heatmapData = useMemo(() => {
    const baseState = selectSimState(store);
    const Ns = [4, 6, 8, 10, 12, 14, 16], Vs = [0, 1, 2, 3, 4];
    const z: number[][] = Ns.map((N) =>
      Vs.map((V) => {
        try { return parametricSweep(baseState, { N_range: [N], S_range: [store.fin.S], V_range: [V] }, { max_results: 1 })[0]?.P_net ?? 0; }
        catch { return 0; }
      })
    );
    return { x: Vs, y: Ns, z };
  }, [store]);

  const sorted = comparison ? [...comparison].sort((a, b) => b.results.system.P_net - a.results.system.P_net) : null;

  return (
    <div style={{ display: 'flex', flexDirection: isCompact ? 'column' : 'row', height: '100%', overflow: isCompact ? 'auto' : 'hidden' }}>
      {/* Left — design cards */}
      <div style={{
        width: isCompact ? '100%' : 320,
        background: C.bg.secondary,
        borderRight: isCompact ? 'none' : `1px solid ${C.bg.border}`,
        borderBottom: isCompact ? `1px solid ${C.bg.border}` : 'none',
        padding: '14px',
        overflowY: isCompact ? 'visible' : 'auto',
        flexShrink: 0,
      }}>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text.primary, marginBottom: 4 }}>Design Comparison</div>
          <div style={{ fontSize: 10, color: C.text.secondary }}>5 standard designs (A–E) evaluated at current TEG / source conditions</div>
        </div>

        <button onClick={handleRun} disabled={running} style={{
          width: '100%', padding: '10px', marginBottom: 14, borderRadius: 7, cursor: running ? 'wait' : 'pointer',
          background: running ? C.bg.card : 'linear-gradient(90deg, #1f6feb 0%, #58a6ff 100%)',
          color: running ? C.text.secondary : '#fff',
          border: `1px solid ${running ? C.bg.border : '#58a6ff44'}`,
          fontSize: 12, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          boxShadow: running ? 'none' : '0 2px 12px rgba(31,111,235,0.3)',
        }}>
          <Play size={13} />
          {running ? '⚙ Computing all 5 designs…' : 'Run All 5 Designs'}
        </button>

        {/* Best design badge */}
        {sorted && sorted[0] && (
          <div style={{ background: '#0a1f0d', border: `1px solid ${C.success}44`, borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: C.success, fontWeight: 700, marginBottom: 2 }}>🏆 BEST DESIGN</div>
            <div style={{ fontSize: 16, fontFamily: FONT.mono, fontWeight: 700, color: DESIGN_COLORS[sorted[0].label] }}>
              Design {sorted[0].label}
            </div>
            <div style={{ fontSize: 12, color: C.success, fontFamily: FONT.mono }}>
              P_net = {sorted[0].results.system.P_net.toFixed(3)} W
            </div>
          </div>
        )}

        {/* Design cards */}
        {sorted && sorted.map((d, i) => (
          <div key={d.label} style={{
            background: C.bg.card,
            border: `1px solid ${i === 0 ? DESIGN_COLORS[d.label] + '66' : C.bg.border}`,
            borderLeft: `3px solid ${DESIGN_COLORS[d.label]}`,
            borderRadius: 7, padding: '10px 12px', marginBottom: 6,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 700, color: DESIGN_COLORS[d.label], fontSize: 14 }}>Design {d.label}</span>
              <span style={{ fontFamily: FONT.mono, fontSize: 14, fontWeight: 700, color: d.results.system.P_net > 0 ? '#3fb950' : C.error }}>
                {d.results.system.P_net.toFixed(2)} W
              </span>
            </div>
            <div style={{ fontSize: 10, color: C.text.secondary, marginBottom: 6 }}>{d.description}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 14px', fontSize: 10 }}>
              {[
                ['η_th', `${(d.results.teg.eta_th * 100).toFixed(2)}%`],
                ['η_sys', `${(d.results.system.eta_sys * 100).toFixed(2)}%`],
                ['h', `${d.results.convection.h.toFixed(1)} W/m²K`],
                ['R_hs', `${d.results.fin.R_hs.toFixed(3)} K/W`],
                ['P_fan', `${d.results.system.P_fan.toFixed(2)} W`],
                ['η_f', `${(d.results.fin.eta_f * 100).toFixed(1)}%`],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, padding: '2px 0' }}>
                  <span style={{ color: C.text.muted }}>{label}:</span>
                  <span style={{ color: C.text.secondary, fontFamily: FONT.mono }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {!comparison && (
          <div style={{ textAlign: 'center', color: C.text.muted, fontSize: 11, padding: '20px 0' }}>
            Click "Run All 5 Designs" to compare configurations
          </div>
        )}
      </div>

      {/* Right — charts */}
      <div style={{
        flex: isCompact ? 'none' : 1,
        display: 'grid',
        gridTemplateColumns: isCompact ? '1fr' : '1fr 1fr',
        gridTemplateRows: isCompact ? undefined : '1fr 1fr',
        gridAutoRows: isCompact ? '290px' : undefined,
        gap: 4,
        overflow: isCompact ? 'visible' : 'hidden',
        background: C.bg.primary,
        padding: 4,
      }}>
        <div style={{ background: C.bg.card, borderRadius: 6, overflow: 'hidden' }}>
          <PlotlyEngChart title="Design Comparison — Net Power (Eq.7.7)"
            data={sorted ? [{ x: sorted.map(d => `Design ${d.label}`), y: sorted.map(d => d.results.system.P_net), type: 'bar', marker: { color: sorted.map(d => DESIGN_COLORS[d.label]) }, name: 'P_net (W)' }] : []}
            layout={{ xaxis: { title: 'Design' }, yaxis: { title: 'P_net (W)' } }} />
        </div>
        <div style={{ background: C.bg.card, borderRadius: 6, overflow: 'hidden' }}>
          <PlotlyEngChart title="Heatmap: N fins × V_air → P_net (W)"
            data={[{ x: heatmapData.x, y: heatmapData.y, z: heatmapData.z, type: 'heatmap', colorscale: 'RdYlGn', reversescale: false, colorbar: { title: 'P_net', titlefont: { color: C.text.secondary }, tickfont: { color: C.text.secondary } } }] as any}
            layout={{ xaxis: { title: 'V_air (m/s)', ticksuffix: ' m/s' }, yaxis: { title: 'N fins' } }} />
        </div>
        <div style={{ background: C.bg.card, borderRadius: 6, overflow: 'hidden' }}>
          <PlotlyEngChart title="Thermal Efficiency by Design (Eq.7.6)"
            data={sorted ? [{ x: sorted.map(d => `Design ${d.label}`), y: sorted.map(d => d.results.teg.eta_th * 100), type: 'bar', marker: { color: sorted.map(d => DESIGN_COLORS[d.label]) }, name: 'η_th (%)' }] : []}
            layout={{ xaxis: { title: 'Design' }, yaxis: { title: 'η_th (%)' } }} />
        </div>
        <div style={{ background: C.bg.card, borderRadius: 6, overflow: 'hidden' }}>
          <PlotlyEngChart title="Heat Sink Resistance by Design (Eq.19)"
            data={sorted ? [{ x: sorted.map(d => `Design ${d.label}`), y: sorted.map(d => d.results.fin.R_hs), type: 'bar', marker: { color: sorted.map(d => DESIGN_COLORS[d.label]) }, name: 'R_hs (K/W)' }] : []}
            layout={{ xaxis: { title: 'Design' }, yaxis: { title: 'R_hs (K/W)' } }} />
        </div>
      </div>
    </div>
  );
}
