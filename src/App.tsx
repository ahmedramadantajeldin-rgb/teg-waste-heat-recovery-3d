import { useMemo, useState, useEffect } from 'react';
import {
  Box, Layers, Wind, Shield, Zap,
  BarChart3, Settings2, FileText, RefreshCw, Settings,
  Activity, BatteryCharging, X
} from 'lucide-react';
import { useSimulationStore, selectSimState } from './store/simulationStore';
import { solveAll } from './physics/systemSolver';
import type { PageName } from './store/simulationStore';
import type { SimulationResults } from './physics/types';
import { C, FONT, fmt, fmtPct, thermalColor } from './design/theme';
import { useViewport } from './design/useViewport';

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
  onOpenSettings,
  isMobile,
}: {
  activePage: PageName;
  onNavigate: (p: PageName) => void;
  onReset: () => void;
  onOpenSettings: () => void;
  isMobile: boolean;
}) {
  return (
    <div style={{
      height: 50,
      background: 'rgba(8, 15, 26, 0.96)',
      borderBottom: '1px solid #1e3a5f',
      display: 'flex',
      alignItems: 'center',
      padding: isMobile ? '0 8px' : '0 12px',
      flexShrink: 0,
      zIndex: 100,
      boxShadow: '0 2px 12px rgba(0, 0, 0, 0.3)',
      gap: 4,
    }}>
      {/* Brand Logo & Title (Click to view System Dashboard) */}
      <div
        onClick={() => onNavigate('dashboard')}
        title="Open System Dashboard"
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          paddingRight: isMobile ? 8 : 10,
          borderRight: '1px solid #1e3a5f',
          flexShrink: 0,
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
        {!isMobile && (
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#f8fafc', lineHeight: 1.15, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
              TEG Simulation
            </div>
            <div style={{ fontSize: 8.5, color: '#94a3b8', letterSpacing: '0.01em', lineHeight: 1, marginTop: 1, whiteSpace: 'nowrap' }}>
              Waste Heat Recovery
            </div>
          </div>
        )}
      </div>

      {/* Nav tabs */}
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, padding: '0 4px', gap: 2, overflowX: 'auto' }}>
        {NAV_ITEMS.map(({ page, icon, label }) => {
          const isActive = activePage === page;
          return (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 7px',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: isMobile ? 6 : 10, borderLeft: '1px solid #1e3a5f', flexShrink: 0 }}>
        <NavIconBtn icon={<RefreshCw size={14} />} title="Reset to defaults" onClick={onReset} />
        <NavIconBtn icon={<Settings size={14} />} title="Settings" onClick={onOpenSettings} />
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
      <div style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
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

      <div style={{ width: 1, height: 28, background: '#21262d', flexShrink: 0 }} />

      {/* 3. ΔT Across TEG */}
      <div style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
        <div style={{ fontSize: 9, color: C.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          ΔT (TEG)
        </div>
        <div style={{ fontSize: 14, fontFamily: FONT.mono, fontWeight: 700, color: '#f59e0b' }}>
          {fmt(dT, 1, 'K')}
        </div>
      </div>

      <div style={{ width: 1, height: 28, background: '#21262d', flexShrink: 0 }} />

      {/* 4. Thermal Efficiency */}
      <div style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
        <div style={{ fontSize: 9, color: C.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          η Thermal
        </div>
        <div style={{ fontSize: 14, fontFamily: FONT.mono, fontWeight: 700, color: '#facc15' }}>
          {fmtPct(etaTh)}
        </div>
      </div>

      <div style={{ width: 1, height: 28, background: '#21262d', flexShrink: 0 }} />

      {/* 5. Fin Efficiency */}
      <div style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
        <div style={{ fontSize: 9, color: C.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          η Fin
        </div>
        <div style={{ fontSize: 14, fontFamily: FONT.mono, fontWeight: 700, color: '#7dd3fc' }}>
          {fmtPct(etaFin)}
        </div>
      </div>

      <div style={{ width: 1, height: 28, background: '#21262d', flexShrink: 0 }} />

      {/* 6. Hot & Cold Temperatures */}
      <div style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
        <div style={{ fontSize: 9, color: C.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          T Hot / T Cold
        </div>
        <div style={{ fontSize: 13, fontFamily: FONT.mono, fontWeight: 600 }}>
          <span style={{ color: thermalColor(Th) }}>{fmt(Th, 1, '°C')}</span>
          <span style={{ color: C.text.muted, margin: '0 4px' }}>/</span>
          <span style={{ color: thermalColor(Tc) }}>{fmt(Tc, 1, '°C')}</span>
        </div>
      </div>

      <div style={{ width: 1, height: 28, background: '#21262d', flexShrink: 0 }} />

      {/* 7. Heat Flow Q_h / Q_c */}
      <div style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
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
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}>
        <Activity size={12} color="#4ade80" />
        LIVE SOLVER
      </div>
    </div>
  );
}

// ─── Settings Modal ──────────────────────────────────────────────────────────
function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useSimulationStore();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Simulation Settings"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(2, 6, 23, 0.72)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420,
          background: '#0f172a', border: '1px solid #1e3a5f', borderRadius: 12,
          padding: 18, boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)', color: '#e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={16} color="#38bdf8" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>Simulation Settings</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            style={{
              background: 'transparent', border: '1px solid #334155', borderRadius: 6,
              color: '#94a3b8', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
          <div style={{ background: '#0b1220', border: '1px solid #1e293b', borderRadius: 8, padding: 10 }}>
            <div style={{ fontWeight: 700, color: '#7dd3fc', marginBottom: 6, fontSize: 11 }}>3D Visualization Shortcuts</div>
            {[
              ['Airflow Streamlines', store.showAirflow, () => store.setShowAirflow(!store.showAirflow)],
              ['Electron & Hole Flow', store.showElectrons, () => store.setShowElectrons(!store.showElectrons)],
              ['Turntable Auto-Rotate', store.autoRotate, () => store.setAutoRotate(!store.autoRotate)],
              ['Component Callout Labels', store.showLabels, () => store.setShowLabels(!store.showLabels)],
              ['Exploded Assembly View', store.explodeView, () => store.setExplodeView(!store.explodeView)],
            ].map(([label, val, toggle]) => (
              <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                <span style={{ color: '#cbd5e1' }}>{label as string}</span>
                <button
                  onClick={toggle as () => void}
                  style={{
                    padding: '2px 10px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                    border: `1px solid ${val ? '#38bdf8' : '#334155'}`,
                    background: val ? '#1d4ed8' : '#1e293b',
                    color: val ? '#fff' : '#94a3b8',
                  }}
                >
                  {val ? 'ON' : 'OFF'}
                </button>
              </div>
            ))}
          </div>

          <div style={{ background: '#0b1220', border: '1px solid #1e293b', borderRadius: 8, padding: 10, fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
            <div><strong style={{ color: '#e2e8f0' }}>Solver:</strong> First-Law series-parallel coupled thermal-electrical model (Eq. 1–30).</div>
            <div><strong style={{ color: '#e2e8f0' }}>Navigation:</strong> Drag to orbit · Scroll to zoom · Right-drag to pan.</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
            <button
              onClick={() => {
                store.resetToDefaults();
                onClose();
              }}
              style={{
                padding: '7px 12px', borderRadius: 6, border: '1px solid #ef444455',
                background: '#7f1d1d33', color: '#fca5a5', fontSize: 11, fontWeight: 600,
              }}
            >
              Reset All to Defaults
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '7px 16px', borderRadius: 6, border: '1px solid #38bdf8',
                background: '#1d4ed8', color: '#fff', fontSize: 11, fontWeight: 700,
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const store = useSimulationStore();
  const { activePage } = store;
  const { isMobile } = useViewport();
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        onOpenSettings={() => setSettingsOpen(true)}
        isMobile={isMobile}
      />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

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
