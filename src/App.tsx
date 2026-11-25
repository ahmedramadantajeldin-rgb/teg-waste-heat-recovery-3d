import { useMemo } from 'react';
import {
  LayoutDashboard, Box, Layers, Wind, Shield, Zap,
  BarChart3, Settings2, FileText, RefreshCw, Settings,
  Activity, Thermometer, BatteryCharging
} from 'lucide-react';
import { useSimulationStore, selectSimState } from './store/simulationStore';
import { solveAll } from './physics/systemSolver';
import type { PageName } from './store/simulationStore';
import type { SimulationResults } from './physics/types';
import { C, FONT, NAV_H, BOTTOM_H, RIGHT_W, fmt, fmtPct, thermalColor } from './design/theme';

// Pages
import { DashboardPage } from './components/pages/DashboardPage';
import { Setup3DPage } from './components/pages/Setup3DPage';
import { FinDesignPage } from './components/pages/FinDesignPage';
import { CoolingSystemPage } from './components/pages/CoolingSystemPage';
import { InsulationPage } from './components/pages/InsulationPage';
import { TEGPerformancePage } from './components/pages/TEGPerformancePage';
import { GraphsPage } from './components/pages/GraphsPage';
import { OptimizationPage } from './components/pages/OptimizationPage';
import { ReportPage } from './components/pages/ReportPage';

// ─── Navigation definition ────────────────────────────────────────────────────
interface NavItem { page: PageName; icon: React.ReactNode; label: string }
const NAV_ITEMS: NavItem[] = [
  { page: 'setup3d',        icon: <Box size={14} />,             label: '3D Setup' },
  { page: 'findesign',      icon: <Layers size={14} />,          label: 'Fin Design' },
  { page: 'cooling',        icon: <Wind size={14} />,            label: 'Cooling System' },
  { page: 'insulation',     icon: <Shield size={14} />,          label: 'Insulation' },
  { page: 'tegperformance', icon: <Zap size={14} />,             label: 'TEG Performance' },
  { page: 'graphs',         icon: <BarChart3 size={14} />,       label: 'Graphs' },
  { page: 'optimization',   icon: <Settings2 size={14} />,       label: 'Optimization' },
  { page: 'report',         icon: <FileText size={14} />,        label: 'Report' },
];

// ─── Top Navigation Bar ───────────────────────────────────────────────────────
function TopNav({
  activePage,
  onNavigate,
  onReset,
}: {
  activePage: PageName;
  onNavigate: (p: PageName) => void;
  onReset: () => void;
}) {
  return (
    <div style={{
      height: 52,
      background: 'rgba(8, 15, 26, 0.96)',
      borderBottom: '1px solid #1e3a5f',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      flexShrink: 0,
      zIndex: 100,
      boxShadow: '0 2px 12px rgba(0, 0, 0, 0.3)',
    }}>
      {/* Brand Logo & Title (Click to view System Dashboard) */}
      <div
        onClick={() => onNavigate('dashboard')}
        title="Open System Dashboard"
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          paddingRight: 10,
          borderRight: '1px solid #1e3a5f',
          flexShrink: 0,
          minWidth: 152,
          cursor: 'pointer',
        }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#ffffff', flexShrink: 0,
          border: '1px solid rgba(56, 189, 248, 0.35)',
          boxShadow: '0 0 12px rgba(37, 99, 235, 0.4)',
        }}>
          <Settings size={15} />
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#f8fafc', lineHeight: 1.15, letterSpacing: '-0.01em' }}>
            TEG Simulation
          </div>
          <div style={{ fontSize: 8.5, color: '#94a3b8', letterSpacing: '0.01em', lineHeight: 1, marginTop: 1 }}>
            Waste Heat Recovery
          </div>
        </div>
      </div>

      {/* Nav tabs */}
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, padding: '0 4px', gap: 2, overflowX: 'auto' }}>
        {NAV_ITEMS.map(({ page, icon, label }) => {
          const isActive = activePage === page;
          return (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 6px',
                border: isActive ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                borderRadius: 6,
                background: isActive ? 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)' : 'transparent',
                color: isActive ? '#ffffff' : '#94a3b8',
                fontSize: 10.5,
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                boxShadow: isActive ? '0 0 14px rgba(37, 99, 235, 0.45)' : 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.color = '#f1f5f9';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(30, 41, 59, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.color = '#94a3b8';
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }
              }}
            >
              {icon}
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Right toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 12, borderLeft: '1px solid #1e3a5f' }}>
        <NavIconBtn icon={<RefreshCw size={14} />} title="Reset to defaults" onClick={onReset} />
        <NavIconBtn icon={<Settings size={14} />} title="Settings" onClick={() => {}} />
      </div>
    </div>
  );
}

function NavIconBtn({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 32, height: 32, borderRadius: 6,
        border: `1px solid ${C.bg.border}`,
        background: 'transparent',
        color: C.text.secondary,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = C.bg.card;
        (e.currentTarget as HTMLElement).style.color = C.text.primary;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.color = C.text.secondary;
      }}
    >
      {icon}
    </button>
  );
}

// ─── Bottom Results Strip (Sleek Compact Telemetry Bar) ─────────────────────────
function BottomStrip({ results, T_source, T_ambient }: { results: SimulationResults | null; T_source: number; T_ambient: number }) {
  const r = results;

  const pNet   = r?.system.P_net   ?? null;
  const pElec  = r?.teg.P_elec    ?? null;
  const pFan   = r?.system.P_fan   ?? null;
  const etaTh  = r?.teg.eta_th    ?? null;
  const etaFin = r?.fin.eta_f     ?? null;
  const dT     = r?.teg.dT_legs   ?? null;
  const Th     = r?.teg.T_h       ?? T_source;
  const Tc     = r?.teg.T_c       ?? T_ambient;
  const Qh     = r?.teg.Q_h       ?? null;
  const Qc     = r?.teg.Q_c       ?? null;

  return (
    <div style={{
      height: 52,
      background: '#010409',
      borderTop: '1px solid #21262d',
      display: 'flex',
      alignItems: 'center',
      padding: '0 14px',
      gap: 12,
      flexShrink: 0,
      overflowX: 'auto',
      overflowY: 'hidden',
      zIndex: 50,
    }}>
      {/* 1. Net Electrical Power (Highlight KPI) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: '#0d1520',
        padding: '4px 10px',
        borderRadius: 6,
        border: `1px solid ${pNet != null && pNet >= 0 ? '#22c55e44' : '#ef444444'}`,
        flexShrink: 0,
      }}>
        <BatteryCharging size={16} color={pNet != null && pNet >= 0 ? '#4ade80' : C.error} />
        <div>
          <div style={{ fontSize: 9, color: C.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Net Power
          </div>
          <div style={{
            fontSize: 16,
            fontFamily: FONT.mono,
            fontWeight: 700,
            color: pNet != null ? (pNet >= 0 ? '#4ade80' : C.error) : C.text.primary,
          }}>
            {fmt(pNet, 2, 'W')}
          </div>
        </div>
      </div>

      <div style={{ width: 1, height: 28, background: '#21262d' }} />

      {/* 2. Gross Electrical Power */}
      <div style={{ minWidth: 100 }}>
        <div style={{ fontSize: 9, color: C.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Gross Power
        </div>
        <div style={{ fontSize: 14, fontFamily: FONT.mono, fontWeight: 700, color: '#38bdf8' }}>
          {fmt(pElec, 2, 'W')}
          {pFan != null && pFan > 0 && (
            <span style={{ fontSize: 10, color: C.text.muted, fontWeight: 400, marginLeft: 4 }}>
              (Fan: {fmt(pFan, 2, 'W')})
            </span>
          )}
        </div>
      </div>

      <div style={{ width: 1, height: 28, background: '#21262d' }} />

      {/* 3. ΔT Across TEG */}
      <div style={{ minWidth: 90 }}>
        <div style={{ fontSize: 9, color: C.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          ΔT (TEG)
        </div>
        <div style={{ fontSize: 14, fontFamily: FONT.mono, fontWeight: 700, color: '#f59e0b' }}>
          {fmt(dT, 1, 'K')}
        </div>
      </div>

      <div style={{ width: 1, height: 28, background: '#21262d' }} />

      {/* 4. Thermal Efficiency */}
      <div style={{ minWidth: 80 }}>
        <div style={{ fontSize: 9, color: C.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          η Thermal
        </div>
        <div style={{ fontSize: 14, fontFamily: FONT.mono, fontWeight: 700, color: '#facc15' }}>
          {fmtPct(etaTh)}
        </div>
      </div>

      <div style={{ width: 1, height: 28, background: '#21262d' }} />

      {/* 5. Fin Efficiency */}
      <div style={{ minWidth: 80 }}>
        <div style={{ fontSize: 9, color: C.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          η Fin
        </div>
        <div style={{ fontSize: 14, fontFamily: FONT.mono, fontWeight: 700, color: '#7dd3fc' }}>
          {fmtPct(etaFin)}
        </div>
      </div>

      <div style={{ width: 1, height: 28, background: '#21262d' }} />

      {/* 6. Hot & Cold Temperatures */}
      <div style={{ minWidth: 120 }}>
        <div style={{ fontSize: 9, color: C.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          T Hot / T Cold
        </div>
        <div style={{ fontSize: 13, fontFamily: FONT.mono, fontWeight: 600 }}>
          <span style={{ color: thermalColor(Th) }}>{fmt(Th, 1, '°C')}</span>
          <span style={{ color: C.text.muted, margin: '0 4px' }}>/</span>
          <span style={{ color: thermalColor(Tc) }}>{fmt(Tc, 1, '°C')}</span>
        </div>
      </div>

      <div style={{ width: 1, height: 28, background: '#21262d' }} />

      {/* 7. Heat Flow Q_h / Q_c */}
      <div style={{ minWidth: 110 }}>
        <div style={{ fontSize: 9, color: C.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Q̇_in / Q̇_out
        </div>
        <div style={{ fontSize: 13, fontFamily: FONT.mono, fontWeight: 600 }}>
          <span style={{ color: '#fb923c' }}>{fmt(Qh, 1, 'W')}</span>
          <span style={{ color: C.text.muted, margin: '0 4px' }}>/</span>
          <span style={{ color: '#60a5fa' }}>{fmt(Qc, 1, 'W')}</span>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Status indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: '#0a1a0f',
        border: '1px solid #16a34a44',
        padding: '3px 8px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        color: '#4ade80',
        letterSpacing: '0.04em',
      }}>
        <Activity size={12} color="#4ade80" />
        LIVE SOLVER
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const store = useSimulationStore();
  const { activePage } = store;

  // Reactive simulation: recompute whenever any input changes
  const simState = selectSimState(store);
  const results = useMemo((): SimulationResults | null => {
    try {
      return solveAll(simState);
    } catch (e) {
      console.error('solveAll error:', e);
      return null;
    }
  }, [
    simState.T_source, simState.T_ambient, simState.q_source, simState.emissivity_source,
    simState.R_load,
    simState.fin.N, simState.fin.L, simState.fin.H, simState.fin.t,
    simState.fin.S, simState.fin.W_base, simState.fin.L_base, simState.fin.t_base,
    simState.fin.type, simState.fin.material,
    simState.convection.mode, simState.convection.V_air, simState.convection.fanEnabled,
    simState.convection.fanEfficiency,
    simState.teg.N_couples, simState.teg.alpha, simState.teg.R_int,
    simState.teg.K_teg, simState.teg.R_contact_h, simState.teg.R_contact_c, simState.teg.A_module,
    simState.insulation.enabled, simState.insulation.material,
    simState.insulation.thickness, simState.insulation.area, simState.insulation.autoArea,
    simState.insulation.location,
    simState.t_spreader_h, simState.t_spreader_c, simState.k_spreader,
  ]);

  // Render page content
  const props = { results };
  let pageContent: React.ReactNode;
  switch (activePage) {
    case 'dashboard':      pageContent = <DashboardPage {...props} T_source={simState.T_source} T_ambient={simState.T_ambient} />; break;
    case 'setup3d':        pageContent = <Setup3DPage {...props} />; break;
    case 'findesign':      pageContent = <FinDesignPage {...props} />; break;
    case 'cooling':        pageContent = <CoolingSystemPage {...props} />; break;
    case 'insulation':     pageContent = <InsulationPage {...props} />; break;
    case 'tegperformance': pageContent = <TEGPerformancePage {...props} />; break;
    case 'graphs':         pageContent = <GraphsPage {...props} />; break;
    case 'optimization':   pageContent = <OptimizationPage {...props} />; break;
    case 'report':         pageContent = <ReportPage {...props} />; break;
    default:               pageContent = <DashboardPage {...props} T_source={simState.T_source} T_ambient={simState.T_ambient} />;
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: C.bg.primary,
      color: C.text.primary,
      fontFamily: FONT.sans,
    }}>
      {/* Top navigation bar */}
      <TopNav
        activePage={activePage}
        onNavigate={store.setActivePage}
        onReset={store.resetToDefaults}
      />

      {/* Page content — fills between nav and bottom strip */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {pageContent}
      </div>

      {/* Bottom results strip on pages other than 3D Setup */}
      {activePage !== 'setup3d' && (
        <BottomStrip
          results={results}
          T_source={simState.T_source}
          T_ambient={simState.T_ambient}
        />
      )}
    </div>
  );
}
