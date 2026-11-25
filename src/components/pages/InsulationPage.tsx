import { useMemo } from 'react';
import { Slider, InfoRow, SectionPanel, ToggleBtn, Warnings } from '../shared';
import { PlotlyEngChart } from '../charts/PlotlyEngChart';
import { useSimulationStore, selectSimState } from '../../store/simulationStore';
import { calculateInsulation } from '../../physics/insulationModel';
import { computeAssemblyGeometry } from '../../physics/assemblyGeometry';
import { INSULATION_MATERIALS } from '../../physics/constants';
import { C } from '../../design/theme';
import { useViewport } from '../../design/useViewport';
import type { SimulationResults } from '../../physics/types';

interface InsulationPageProps { results: SimulationResults | null }

const MAT_LABELS: Record<string, string> = {
  glasswool: 'Glass Wool', rockwool: 'Rock Wool', ceramicfiber: 'Ceramic Fibre',
  calciumsilicate: 'Calcium Silicate', aerogel: 'Aerogel', polyurethane: 'Polyurethane',
};

export function InsulationPage({ results }: InsulationPageProps) {
  const store = useSimulationStore();
  const simState = selectSimState(store);
  const { insulation } = store;
  const { isCompact } = useViewport();

  const geomArea = useMemo(
    () => computeAssemblyGeometry(simState, false).A_insulation_geom,
    [simState],
  );
  const effectiveArea = insulation.autoArea === false && insulation.area > 0 ? insulation.area : geomArea;

  const thickSweep = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => 0.01 + i * 0.01).map((thick) => {
      const r = calculateInsulation({ ...insulation, enabled: true, area: effectiveArea, thickness: thick }, store.T_source, store.T_ambient);
      return { thick: thick * 100, Q_loss: r.Q_loss_with };
    })
  , [insulation, effectiveArea, store.T_source, store.T_ambient]);

  const matComparison = useMemo(() =>
    Object.keys(INSULATION_MATERIALS).map((mat) => {
      const typedMat = mat as 'glasswool' | 'rockwool' | 'ceramicfiber' | 'calciumsilicate' | 'aerogel' | 'polyurethane';
      const r = calculateInsulation({ ...insulation, enabled: true, area: effectiveArea, material: typedMat }, store.T_source, store.T_ambient);
      const m = INSULATION_MATERIALS[mat];
      return { mat: MAT_LABELS[mat] ?? mat, Q_loss: r.Q_loss_with, k: m.k, T_max: m.T_max };
    })
  , [insulation, effectiveArea, store.T_source, store.T_ambient]);

  const ins = results?.insulation;

  return (
    <div style={{ display: 'flex', flexDirection: isCompact ? 'column' : 'row', height: '100%', overflow: isCompact ? 'auto' : 'hidden' }}>
      {/* Left controls */}
      <div style={{
        width: isCompact ? '100%' : 280,
        background: C.bg.secondary,
        borderRight: isCompact ? 'none' : `1px solid ${C.bg.border}`,
        borderBottom: isCompact ? `1px solid ${C.bg.border}` : 'none',
        padding: '14px',
        overflowY: isCompact ? 'visible' : 'auto',
        flexShrink: 0,
      }}>

        <SectionPanel title="Insulation Control">
          <ToggleBtn label="Thermal Insulation Active" value={insulation.enabled}
            onChange={(v) => store.updateInsulation({ enabled: v })} colorOn="#8b5cf6" />
          <div style={{ marginTop: 6, fontSize: 10, color: C.text.muted }}>
            {insulation.enabled ? '🛡 Active — heat losses reduced' : '🔓 Disabled — full surface heat loss'}
          </div>
        </SectionPanel>

        <SectionPanel title="Material Selection" accentColor="#a78bfa">
          {Object.entries(INSULATION_MATERIALS).map(([key, m]) => {
            const overTemp = store.T_source > m.T_max;
            const isSelected = insulation.material === key;
            return (
              <button key={key}
                onClick={() => store.updateInsulation({ material: key as 'glasswool' | 'rockwool' | 'ceramicfiber' | 'calciumsilicate' | 'aerogel' | 'polyurethane' })}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '7px 10px', marginBottom: 4, borderRadius: 6, cursor: 'pointer',
                  background: isSelected ? '#8b5cf611' : C.bg.card,
                  color: isSelected ? '#a78bfa' : overTemp ? C.error : C.text.secondary,
                  border: `1px solid ${isSelected ? '#8b5cf6' : overTemp ? C.error + '44' : C.bg.border}`,
                }}>
                <div style={{ fontSize: 11, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{MAT_LABELS[key]}</span>
                  {overTemp && <span style={{ fontSize: 9, color: C.error }}>⚠ OVER T_max</span>}
                </div>
                <div style={{ fontSize: 9, color: C.text.muted, marginTop: 1 }}>
                  k={m.k} W/m·K · T_max={m.T_max}°C
                </div>
              </button>
            );
          })}
        </SectionPanel>

        <SectionPanel title="Dimensions" accentColor={C.accent}>
          <Slider label="Thickness" value={insulation.thickness * 100} min={0.5} max={20} step={0.5} unit=" cm"
            onChange={(v) => store.updateInsulation({ thickness: v / 100 })} />
          <Slider label="Insulated Area" value={effectiveArea * 1e4} min={10} max={1000} step={5} unit=" cm²"
            onChange={(v) => store.updateInsulation({ area: v / 1e4, autoArea: false })} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 9.5, color: C.text.muted, marginTop: 4 }}>
            <span>
              {insulation.autoArea === false
                ? `Manual (Assembly: ${(geomArea * 1e4).toFixed(1)} cm²)`
                : `Auto-linked to 3D Assembly (${(geomArea * 1e4).toFixed(1)} cm²)`}
            </span>
            {insulation.autoArea === false && (
              <button
                onClick={() => store.updateInsulation({ area: geomArea, autoArea: true })}
                style={{
                  background: 'transparent', border: `1px solid ${C.accent}66`, borderRadius: 4,
                  color: C.accent, fontSize: 9, padding: '2px 6px', cursor: 'pointer',
                }}
              >
                Auto
              </button>
            )}
          </div>
        </SectionPanel>

        {ins && (
          <SectionPanel title="Heat Loss Results" accentColor={C.success}>
            <InfoRow label="R_insulation (Eq.9)" value={ins.R_insulation.toFixed(2)} unit="K/W" color="#a3e635" eq="Eq.9" />
            <InfoRow label="Q_loss WITH insulation" value={ins.Q_loss_with.toFixed(1)} unit="W" color={C.success} eq="Eq.5" />
            <InfoRow label="Q_loss WITHOUT insulation" value={ins.Q_loss_without.toFixed(1)} unit="W" color={C.error} eq="Eq.5" />
            <InfoRow label="Heat Loss Reduction" value={`${ins.reduction_pct.toFixed(1)}%`} color={ins.reduction_pct > 50 ? C.success : C.warning} />
            {ins.warning && <Warnings warnings={[ins.warning]} />}
          </SectionPanel>
        )}
      </div>

      {/* Right charts */}
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
          <PlotlyEngChart title="Insulation Thickness vs Heat Loss (Eq.9)"
            data={[{ x: thickSweep.map(d => d.thick), y: thickSweep.map(d => d.Q_loss), type: 'scatter', mode: 'lines+markers', name: 'Q_loss (W)', line: { color: '#3fb950', width: 2 }, marker: { color: '#3fb950', size: 4 } }]}
            layout={{ xaxis: { title: 'Thickness (cm)' }, yaxis: { title: 'Q_loss (W)' } }} />
        </div>
        <div style={{ background: C.bg.card, borderRadius: 6, overflow: 'hidden' }}>
          <PlotlyEngChart title="Material Comparison — Q_loss"
            data={[{ x: matComparison.map(d => d.mat), y: matComparison.map(d => d.Q_loss), type: 'bar', marker: { color: matComparison.map(d => d.T_max >= store.T_source ? '#3fb950' : C.error) }, name: 'Q_loss (W)' }]}
            layout={{ margin: { b: 68 }, xaxis: { title: 'Material', tickangle: -20 }, yaxis: { title: 'Q_loss (W)' } }} />
        </div>
        <div style={{ background: C.bg.card, borderRadius: 6, overflow: 'hidden' }}>
          <PlotlyEngChart title="Thermal Conductivity by Material"
            data={[{ x: matComparison.map(d => d.mat), y: matComparison.map(d => d.k), type: 'bar', marker: { color: '#58a6ff' }, name: 'k (W/mK)' }]}
            layout={{ margin: { b: 68 }, xaxis: { title: 'Material', tickangle: -20 }, yaxis: { title: 'k (W/m·K)' } }} />
        </div>
        <div style={{ background: C.bg.card, borderRadius: 6, overflow: 'hidden' }}>
          <PlotlyEngChart title="Max Service Temperature by Material"
            data={[
              { x: matComparison.map(d => d.mat), y: matComparison.map(d => d.T_max), type: 'bar', marker: { color: matComparison.map(d => d.T_max >= store.T_source ? '#a3e635' : C.error) }, name: 'T_max (°C)' },
              { x: matComparison.map(d => d.mat), y: matComparison.map(() => store.T_source), type: 'scatter', mode: 'lines', line: { color: C.error, dash: 'dash', width: 1 }, name: 'T_source (°C)' },
            ]}
            layout={{ margin: { b: 68 }, xaxis: { title: 'Material', tickangle: -20 }, yaxis: { title: 'Temperature (°C)' } }} />
        </div>
      </div>
    </div>
  );
}
