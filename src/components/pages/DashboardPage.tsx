import { Zap, Thermometer, Wind, BatteryCharging, Activity, TrendingUp } from 'lucide-react';
import { KPICard, StatCard, InfoRow, SectionPanel, Warnings } from '../shared';
import { C, FONT, thermalColor, fmt, fmtPct } from '../../design/theme';
import type { SimulationResults } from '../../physics/types';

interface DashboardPageProps {
  results: SimulationResults | null;
  T_source: number;
  T_ambient: number;
}

function EnergyBalance({ results }: { results: SimulationResults }) {
  const err = results.teg.energy_balance_error;
  const ok = err < 0.5;
  return (
    <div style={{
      background: ok ? '#0a1f0d' : '#1a0808',
      border: `1px solid ${ok ? C.success : C.error}44`,
      borderRadius: 8, padding: '10px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{ok ? '✅' : '⚠️'}</span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: ok ? C.success : C.error, marginBottom: 2 }}>
          Energy Balance (Paper Eq.15): Q̇_h = P_elec + Q̇_c
        </div>
        <div style={{ fontSize: 12, color: C.text.secondary, fontFamily: FONT.mono }}>
          {results.teg.Q_h.toFixed(2)} W = {results.teg.P_elec.toFixed(2)} W + {results.teg.Q_c.toFixed(2)} W
          &nbsp;&nbsp;│&nbsp;&nbsp;
          <span style={{ color: ok ? C.success : C.warning }}>
            Error: {err.toFixed(3)} W {ok ? '✓ BALANCED' : '⚠ CHECK'}
          </span>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage({ results, T_source, T_ambient }: DashboardPageProps) {
  if (!results) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 48 }}>⚡</div>
        <div style={{ color: C.text.secondary }}>Calculating simulation…</div>
      </div>
    );
  }

  const { teg, fin, convection, system, warnings } = results;

  return (
    <div style={{ padding: '16px 20px', overflowY: 'auto', height: '100%', background: C.bg.primary }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text.primary, margin: 0 }}>
            System Dashboard
          </h2>
          <div style={{ fontSize: 11, color: C.text.secondary, marginTop: 2 }}>
            Thermoelectric Generator — Waste Heat Recovery Simulation
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            background: '#0a1f0d', border: `1px solid ${C.success}44`,
            color: C.success, fontSize: 10, fontWeight: 600,
            padding: '3px 10px', borderRadius: 20, letterSpacing: '0.05em',
          }}>
            ● LIVE SIMULATION
          </span>
        </div>
      </div>

      {/* Energy Balance */}
      <EnergyBalance results={results} />

      {/* Primary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))', gap: 10, marginTop: 14 }}>
        <KPICard
          label="Net Electrical Power"
          value={system.P_net}
          unit="W"
          color={system.P_net >= 0 ? '#4ade80' : C.error}
          sub={system.P_net >= 0 ? '✓ Net generation positive' : '✗ Fan consuming more than generated'}
          icon={<BatteryCharging size={14} />}
        />
        <KPICard
          label="TEG Gross Power (Eq.7.4)"
          value={teg.P_elec}
          unit="W"
          color={C.accent}
          sub={`Max: ${teg.P_max.toFixed(3)} W at R_load=R_int`}
          icon={<Zap size={14} />}
        />
        <KPICard
          label="Thermal Efficiency (Eq.7.6)"
          value={(teg.eta_th * 100).toFixed(2)}
          unit="%"
          color="#facc15"
          sub={`System η: ${(system.eta_sys * 100).toFixed(2)}%`}
          icon={<TrendingUp size={14} />}
        />
        <KPICard
          label="ΔT Across TEG (Eq.1)"
          value={teg.dT_legs}
          unit="K"
          color="#f97316"
          sub={`T_h=${teg.T_h.toFixed(1)}°C | T_c=${teg.T_c.toFixed(1)}°C`}
          icon={<Thermometer size={14} />}
        />
      </div>

      {/* Detail grids */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 10, marginTop: 14 }}>

        {/* Thermal Performance */}
        <SectionPanel title="Thermal Performance" accentColor={C.hot}>
          <InfoRow label="Heat Input Q̇_h (Eq.7.9)" value={teg.Q_h} unit="W" color={C.hot} eq="Eq.7.9" />
          <InfoRow label="Heat Rejected Q̇_c" value={teg.Q_c} unit="W" color={C.cold} eq="Eq.7.9" />
          <InfoRow label="T_hot Module (Eq.1)" value={teg.T_h} unit="°C" color={thermalColor(teg.T_h)} />
          <InfoRow label="T_cold Module" value={teg.T_c} unit="°C" color={thermalColor(teg.T_c)} />
          <InfoRow label="R_hs Heat Sink (Eq.19)" value={fin.R_hs} unit="K/W" />
          <InfoRow label="Fin Efficiency (Eq.20)" value={fmtPct(fin.eta_f)} unit="" color="#7dd3fc" />
        </SectionPanel>

        {/* Electrical Performance */}
        <SectionPanel title="Electrical Output" accentColor={C.accent}>
          <InfoRow label="Open-Circuit Voc (Eq.2)" value={teg.Voc} unit="V" color="#a3e635" eq="Eq.2" />
          <InfoRow label="Load Voltage V_L" value={teg.V_load} unit="V" color="#86efac" />
          <InfoRow label="Load Current I_L" value={teg.I_load} unit="A" color="#67e8f9" />
          <InfoRow label="Max Power P_max (Eq.7.5)" value={teg.P_max} unit="W" color="#c4b5fd" eq="Eq.7.5" />
          <InfoRow label="Gross P_elec (Eq.7.4)" value={teg.P_elec} unit="W" color={C.accent} eq="Eq.7.4" />
          <InfoRow label="Annual Energy (Eq.7.12)" value={system.E_annual.toFixed(0)} unit="kWh/yr" color={C.success} eq="Eq.7.12" />
        </SectionPanel>

        {/* Cooling Performance */}
        <SectionPanel title="Cooling System" accentColor="#7dd3fc">
          <InfoRow label="Conv. Coeff. h" value={convection.h} unit="W/m²K" />
          <InfoRow label="Mode" value={convection.mode === 'natural' ? 'Natural Conv.' : 'Forced Conv.'} />
          <InfoRow label="Fan Power (Eq.30)" value={system.P_fan} unit="W" color={C.warning} eq="Eq.30" />
          <InfoRow label="Net Power P_net (Eq.7.7)" value={system.P_net} unit="W"
            color={system.P_net >= 0 ? C.success : C.error} eq="Eq.7.7" />
          <InfoRow label="η_system (Eq.7.8)" value={fmtPct(system.eta_sys)} unit="" color="#fbbf24" eq="Eq.7.8" />
        </SectionPanel>
      </div>

      {/* Reference Cases */}
      <div style={{
        marginTop: 14,
        background: C.bg.card,
        border: `1px solid ${C.bg.border}`,
        borderRadius: 8,
        padding: '12px 16px',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.text.secondary, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
          📖 Reference Cases (from Paper — Section 8)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          <div style={{ background: C.bg.secondary, borderRadius: 6, padding: '8px 12px', border: `1px solid ${C.bg.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.accent, marginBottom: 4 }}>Amrize Cement Plant (Eq.8.1)</div>
            <div style={{ fontSize: 11, color: C.text.secondary }}>573 cartridges, peak net 7.7 kW</div>
            <div style={{ fontSize: 12, fontFamily: FONT.mono, color: C.success, marginTop: 2 }}>≈ 13.4 W / cartridge</div>
          </div>
          <div style={{ background: C.bg.secondary, borderRadius: 6, padding: '8px 12px', border: `1px solid ${C.bg.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.accent, marginBottom: 4 }}>JFE Steel Works</div>
            <div style={{ fontSize: 11, color: C.text.secondary }}>56 panels × 16 modules = 896 total</div>
            <div style={{ fontSize: 12, fontFamily: FONT.mono, color: C.success, marginTop: 2 }}>10 kW class ≈ 11.2 W / module</div>
          </div>
        </div>
      </div>

      {/* Warnings */}
      <Warnings warnings={warnings} />

      <div style={{ height: 16 }} />
    </div>
  );
}
