import { useSimulationStore } from '../../store/simulationStore';
import { Warnings } from '../shared';
import { C, FONT } from '../../design/theme';
import type { SimulationResults } from '../../physics/types';
import { Download, Printer, Save } from 'lucide-react';

interface ReportPageProps { results: SimulationResults | null }

function TRow({ label, eq, formula, result, unit, odd }: { label: string; eq: string; formula: string; result: string; unit?: string; odd?: boolean }) {
  return (
    <tr style={{ background: odd ? C.bg.secondary : C.bg.card }}>
      <td style={{ padding: '6px 12px', color: C.text.secondary, fontSize: 11 }}>{label}</td>
      <td style={{ padding: '6px 8px', color: C.accent, fontSize: 10, fontFamily: FONT.mono }}>{eq}</td>
      <td style={{ padding: '6px 8px', color: C.text.muted, fontSize: 10, fontFamily: FONT.mono }}>{formula}</td>
      <td style={{ padding: '6px 12px', color: C.text.primary, fontSize: 12, fontFamily: FONT.mono, fontWeight: 600 }}>
        {result}<span style={{ fontSize: 10, color: C.text.muted, marginLeft: 3 }}>{unit}</span>
      </td>
    </tr>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, padding: '4px 0', borderBottom: `1px solid ${C.bg.border}` }}>
        {title}
      </div>
      <div style={{ overflowX: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, onClick, color = C.accent }: { icon: React.ReactNode; label: string; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '7px 14px', borderRadius: 6, cursor: 'pointer',
      background: C.bg.card, color,
      border: `1px solid ${color}44`,
      fontSize: 11, fontWeight: 600,
    }}>
      {icon}{label}
    </button>
  );
}

export function ReportPage({ results }: ReportPageProps) {
  const store = useSimulationStore();

  const exportCSV = () => {
    if (!results) return;
    const rows = [
      ['Parameter', 'Value', 'Unit'],
      ['T_source', store.T_source.toString(), '°C'],
      ['T_ambient', store.T_ambient.toString(), '°C'],
      ['Voc', results.teg.Voc.toFixed(4), 'V'],
      ['V_load', results.teg.V_load.toFixed(4), 'V'],
      ['I_load', results.teg.I_load.toFixed(4), 'A'],
      ['P_elec', results.teg.P_elec.toFixed(3), 'W'],
      ['P_max', results.teg.P_max.toFixed(3), 'W'],
      ['P_fan', results.system.P_fan.toFixed(3), 'W'],
      ['P_net', results.system.P_net.toFixed(3), 'W'],
      ['Q_h', results.teg.Q_h.toFixed(2), 'W'],
      ['Q_c', results.teg.Q_c.toFixed(2), 'W'],
      ['eta_th_%', (results.teg.eta_th * 100).toFixed(3), '%'],
      ['eta_sys_%', (results.system.eta_sys * 100).toFixed(3), '%'],
      ['eta_f_%', (results.fin.eta_f * 100).toFixed(2), '%'],
      ['R_hs', results.fin.R_hs.toFixed(4), 'K/W'],
      ['h_conv', results.convection.h.toFixed(2), 'W/m²K'],
      ['T_h_module', results.teg.T_h.toFixed(2), '°C'],
      ['T_c_module', results.teg.T_c.toFixed(2), '°C'],
      ['dT_legs', results.teg.dT_legs.toFixed(2), 'K'],
      ['E_annual', results.system.E_annual.toFixed(0), 'kWh/yr'],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `teg-report-${Date.now()}.csv`;
    a.click();
  };

  const saveCase = () => { const name = prompt('Enter case name:'); if (name) store.saveCase(name); };

  if (!results) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 48 }}>📄</div>
        <div style={{ color: C.text.secondary }}>No results yet. Run the simulation first.</div>
      </div>
    );
  }

  const { teg, fin, convection, system, insulation } = results;
  const r = store;
  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', borderRadius: 6, overflow: 'hidden', border: `1px solid ${C.bg.border}` };
  const headStyle: React.CSSProperties = { background: '#010409', color: C.text.secondary, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' };
  const thStyle: React.CSSProperties = { padding: '7px 12px', textAlign: 'left', fontWeight: 600 };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px 20px', background: C.bg.primary }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text.primary }}>Engineering Simulation Report</h2>
          <div style={{ fontSize: 11, color: C.text.secondary, marginTop: 2 }}>
            TEG Waste Heat Recovery — {new Date().toLocaleString()}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <ActionBtn icon={<Save size={12} />} label="Save Case" onClick={saveCase} />
          <ActionBtn icon={<Download size={12} />} label="Export CSV" onClick={exportCSV} color={C.success} />
          <ActionBtn icon={<Printer size={12} />} label="Print" onClick={() => window.print()} color={C.text.secondary} />
        </div>
      </div>

      <Section title="1. Operating Conditions">
        <table style={tableStyle}>
          <thead style={headStyle}><tr>
            <th style={thStyle}>Parameter</th><th style={thStyle}>Ref</th><th style={thStyle}>Formula</th><th style={thStyle}>Value</th>
          </tr></thead>
          <tbody>
            <TRow label="Hot Source Temperature" eq="Input" formula="T_source" result={r.T_source.toFixed(0)} unit="°C" odd={false} />
            <TRow label="Ambient Temperature" eq="Input" formula="T_ambient" result={r.T_ambient.toFixed(0)} unit="°C" odd />
            <TRow label="TEG Hot-Side Temperature" eq="Eq.(1)" formula="T_h = f(R_network)" result={teg.T_h.toFixed(2)} unit="°C" odd={false} />
            <TRow label="TEG Cold-Side Temperature" eq="Eq.(1)" formula="T_c = f(R_network)" result={teg.T_c.toFixed(2)} unit="°C" odd />
            <TRow label="ΔT Across Legs" eq="Eq.(1)" formula="ΔT = T_h − T_c" result={teg.dT_legs.toFixed(2)} unit="K" odd={false} />
            <TRow label="Convection Mode" eq="Input" formula="mode" result={convection.mode} odd />
            <TRow label="Air Velocity" eq="Input" formula="V_air" result={r.convection.V_air.toFixed(1)} unit="m/s" odd={false} />
            <TRow label="Conv. Coefficient h" eq="Eq.(5)" formula="Churchill-Chu / Dittus-Boelter" result={convection.h.toFixed(2)} unit="W/m²K" odd />
          </tbody>
        </table>
      </Section>

      <Section title="2. Fin Analysis (Paper Equations)">
        <table style={tableStyle}>
          <thead style={headStyle}><tr>
            <th style={thStyle}>Parameter</th><th style={thStyle}>Ref</th><th style={thStyle}>Formula</th><th style={thStyle}>Value</th>
          </tr></thead>
          <tbody>
            <TRow label="Fin Type / Number" eq="Input" formula="type, N" result={`${r.fin.type}, N=${r.fin.N}`} odd={false} />
            <TRow label="Fin Parameter m" eq="Eq.(22)" formula="m = √(h·P / k·Ac)" result={fin.m_param.toFixed(3)} unit="1/m" odd />
            <TRow label="Corrected Length Lc" eq="Eq.(23)" formula="Lc = H + t/2" result={(fin.Lc * 1000).toFixed(1)} unit="mm" odd={false} />
            <TRow label="Fin Efficiency η_f" eq="Eq.(20)" formula="η_f = tanh(m·Lc) / (m·Lc)" result={(fin.eta_f * 100).toFixed(2)} unit="%" odd />
            <TRow label="Overall Efficiency η_o" eq="Eq.(25)" formula="η_o = 1 − (Af/At)·(1−η_f)" result={(fin.eta_o * 100).toFixed(2)} unit="%" odd={false} />
            <TRow label="Fin Effectiveness ε_f" eq="Eq.(24)" formula="ε_f = Q_fin / [h·Ac·(Tb−T∞)]" result={fin.epsilon_f.toFixed(2)} odd />
            <TRow label="Total Surface Area At" eq="—" formula="Af + Ab" result={(fin.At * 1e4).toFixed(2)} unit="cm²" odd={false} />
            <TRow label="Heat Sink Resistance R_hs" eq="Eq.(19)" formula="R_hs = 1/(η_o·h·At)" result={fin.R_hs.toFixed(4)} unit="K/W" odd />
          </tbody>
        </table>
      </Section>

      <Section title="3. TEG Electrical Performance (Paper Equations)">
        <table style={tableStyle}>
          <thead style={headStyle}><tr>
            <th style={thStyle}>Parameter</th><th style={thStyle}>Ref</th><th style={thStyle}>Formula</th><th style={thStyle}>Value</th>
          </tr></thead>
          <tbody>
            <TRow label="Open-Circuit Voltage Voc" eq="Eq.(2)" formula={`N·α·ΔT = ${r.teg.N_couples}×${(r.teg.alpha * 1000).toFixed(2)}mV/K×${teg.dT_legs.toFixed(1)}K`} result={teg.Voc.toFixed(4)} unit="V" odd={false} />
            <TRow label="Load Voltage V_load" eq="—" formula="V_load = Voc·RL/(RL+Rint)" result={teg.V_load.toFixed(4)} unit="V" odd />
            <TRow label="Load Current I_load" eq="—" formula="I_load = Voc/(RL+Rint)" result={teg.I_load.toFixed(4)} unit="A" odd={false} />
            <TRow label="Electrical Power P_elec" eq="Eq.(7.4)" formula="P = Voc²·RL/(RL+Rint)²" result={teg.P_elec.toFixed(3)} unit="W" odd />
            <TRow label="Maximum Power P_max" eq="Eq.(7.5)" formula="P_max = Voc²/(4·Rint)" result={teg.P_max.toFixed(3)} unit="W" odd={false} />
            <TRow label="Heat Input Q_h" eq="Eq.(14)" formula="Q_h = ΔT_total/R_total" result={teg.Q_h.toFixed(2)} unit="W" odd />
            <TRow label="Heat Rejected Q_c" eq="Eq.(15)" formula="Q_c = Q_h − P_elec" result={teg.Q_c.toFixed(2)} unit="W" odd={false} />
            <TRow label="Thermal Efficiency η_th" eq="Eq.(7.6)" formula="η_th = P_elec/Q_h" result={(teg.eta_th * 100).toFixed(3)} unit="%" odd />
            <TRow label="Energy Balance Error" eq="Eq.(15)" formula="|Q_h − P_elec − Q_c|" result={teg.energy_balance_error.toFixed(4)} unit="W" odd={false} />
          </tbody>
        </table>
      </Section>

      <Section title="4. System-Level Metrics (Paper Equations)">
        <table style={tableStyle}>
          <thead style={headStyle}><tr>
            <th style={thStyle}>Parameter</th><th style={thStyle}>Ref</th><th style={thStyle}>Formula</th><th style={thStyle}>Value</th>
          </tr></thead>
          <tbody>
            <TRow label="Fan Power P_fan" eq="Eq.(30)" formula="P_fan = ΔP·V̇/η_fan" result={system.P_fan.toFixed(3)} unit="W" odd={false} />
            <TRow label="Net Power P_net" eq="Eq.(7.7)" formula="P_net = P_elec − P_fan" result={system.P_net.toFixed(3)} unit="W" odd />
            <TRow label="System Efficiency η_sys" eq="Eq.(7.8)" formula="η_sys = P_net/Q_h" result={(system.eta_sys * 100).toFixed(3)} unit="%" odd={false} />
            <TRow label="Exergy Input Ex" eq="Eq.(7.9)" formula="Ex = Q·(1−T0/T)" result={system.Ex_input.toFixed(2)} unit="W" odd />
            <TRow label="Exergy Efficiency η_ex" eq="Eq.(7.10)" formula="η_ex = P_net/Ex" result={(system.eta_ex * 100).toFixed(3)} unit="%" odd={false} />
            <TRow label="Annual Energy E_annual" eq="Eq.(7.12)" formula="E = P_net × 8760 h" result={system.E_annual.toFixed(0)} unit="kWh/yr" odd />
          </tbody>
        </table>
      </Section>

      <Section title="5. Insulation Analysis">
        <table style={tableStyle}>
          <thead style={headStyle}><tr>
            <th style={thStyle}>Parameter</th><th style={thStyle}>Ref</th><th style={thStyle}>Formula</th><th style={thStyle}>Value</th>
          </tr></thead>
          <tbody>
            <TRow label="Insulation Enabled" eq="Input" formula="enabled" result={r.insulation.enabled ? 'Yes' : 'No'} odd={false} />
            <TRow label="Material" eq="Input" formula="material" result={r.insulation.material} odd />
            <TRow label="R_insulation" eq="Eq.(9)" formula="R = thickness/(k·A)" result={insulation.R_insulation.toFixed(4)} unit="K/W" odd={false} />
            <TRow label="Q_loss with insulation" eq="Eq.(5)" formula="Q = ΔT/R_total" result={insulation.Q_loss_with.toFixed(2)} unit="W" odd />
            <TRow label="Q_loss without insulation" eq="Eq.(5)" formula="Q = h·A·ΔT" result={insulation.Q_loss_without.toFixed(2)} unit="W" odd={false} />
            <TRow label="Heat Loss Reduction" eq="—" formula="(Q_no − Q_with)/Q_no × 100" result={insulation.reduction_pct.toFixed(1)} unit="%" odd />
          </tbody>
        </table>
      </Section>

      {/* Saved Cases */}
      {store.savedCases.length > 0 && (
        <Section title="6. Saved Cases">
          <table style={tableStyle}>
            <thead style={headStyle}><tr>
              <th style={thStyle}>Name</th><th style={thStyle}>T_s (°C)</th><th style={thStyle}>P_net (W)</th><th style={thStyle}>η_th (%)</th><th style={thStyle}>Actions</th>
            </tr></thead>
            <tbody>
              {store.savedCases.map((c, i) => (
                <tr key={c.id} style={{ background: i % 2 === 0 ? C.bg.card : C.bg.secondary }}>
                  <td style={{ padding: '6px 12px', color: C.text.secondary, fontSize: 11 }}>{c.name}</td>
                  <td style={{ padding: '6px 12px', color: C.text.secondary, fontSize: 11, fontFamily: FONT.mono }}>{c.state.T_source}</td>
                  <td style={{ padding: '6px 12px', color: C.success, fontSize: 11, fontFamily: FONT.mono }}>{c.results?.system.P_net.toFixed(2) ?? '—'}</td>
                  <td style={{ padding: '6px 12px', color: '#facc15', fontSize: 11, fontFamily: FONT.mono }}>{c.results ? (c.results.teg.eta_th * 100).toFixed(2) : '—'}</td>
                  <td style={{ padding: '6px 8px', display: 'flex', gap: 4 }}>
                    <button onClick={() => store.loadCase(c.id)} style={{ padding: '2px 8px', border: `1px solid ${C.accent}44`, borderRadius: 4, background: C.bg.card, color: C.accent, fontSize: 10, cursor: 'pointer' }}>Load</button>
                    <button onClick={() => store.deleteCase(c.id)} style={{ padding: '2px 8px', border: `1px solid ${C.error}44`, borderRadius: 4, background: C.bg.card, color: C.error, fontSize: 10, cursor: 'pointer' }}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Warnings warnings={results.warnings} />
      <div style={{ height: 20 }} />
    </div>
  );
}
