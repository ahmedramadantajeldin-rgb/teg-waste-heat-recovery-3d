import React from 'react';
import { Zap, TrendingUp, BarChart2, Info } from 'lucide-react';
import type { SimulationResults } from '../../physics/types';
import { useSimulationStore } from '../../store/simulationStore';

interface Setup3DBottomCardsProps {
  results: SimulationResults | null;
}

/**
 * 4 Bottom Telemetry & Analytics Cards (Matching the reference user image):
 * 1. Key Results: Net Power, Thermal Efficiency, ΔT (TEG), Heat Dissipation
 * 2. Temperature Distribution: Color scale gradient + Mini 3D heat map preview
 * 3. Performance Graph: Dual-axis Power & Efficiency vs ΔT curves
 * 4. System Info: Heat Transfer Rate, Fin Efficiency, Pressure Drop, Fan Power, Overall Efficiency
 */
export function Setup3DBottomCards({ results }: Setup3DBottomCardsProps) {
  const store = useSimulationStore();

  // Metrics from results or fallback defaults from reference image
  const pNetW = results?.system.P_net ?? 1.5495;
  const pNetStr = (pNetW * 1000).toFixed(2) + ' mW';
  const etaThStr = ((results?.teg.eta_th ?? 0.622) * 100).toFixed(1) + ' %';
  const dTStr = (results?.teg.dT_legs ?? 100.4).toFixed(1) + ' °C';
  const qDissStr = (results?.teg.Q_c ?? 85.7).toFixed(1) + ' W';

  const qConvStr = (results?.fin.Q_fin ?? 85.7).toFixed(1) + ' W';
  const etaFinStr = ((results?.fin.eta_f ?? 0.943) * 100).toFixed(1) + ' %';
  const deltaPStr = (results?.convection.dP ?? 28.5).toFixed(1) + ' Pa';
  const pFanStr = (results?.system.P_fan ?? 0.72).toFixed(2) + ' W';
  const etaOverallStr = (((results?.system.eta_sys ?? 0.587) * 100)).toFixed(1) + ' %';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        padding: '10px 14px',
        background: 'rgba(8, 15, 26, 0.94)',
        borderTop: '1px solid #1e3a5f',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.4)',
        zIndex: 30,
        height: 175,
        boxSizing: 'border-box',
      }}
    >
      {/* ── CARD 1: Key Results ── */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div style={{ ...iconBadgeStyle, background: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}>
            <Zap size={13} />
          </div>
          <span style={cardTitleStyle}>Key Results</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, justifyContent: 'center' }}>
          <MetricRow
            color="#22c55e"
            label="Net Power"
            value={pNetStr}
            isHighlight
            valColor="#4ade80"
          />
          <MetricRow
            color="#38bdf8"
            label="Thermal Efficiency"
            value={etaThStr}
            valColor="#38bdf8"
          />
          <MetricRow
            color="#f97316"
            label="ΔT (TEG)"
            value={dTStr}
            valColor="#fb923c"
          />
          <MetricRow
            color="#a855f7"
            label="Heat Dissipation"
            value={qDissStr}
            valColor="#c084fc"
          />
        </div>
      </div>

      {/* ── CARD 2: Temperature Distribution ── */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div style={{ ...iconBadgeStyle, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
            <TrendingUp size={13} />
          </div>
          <span style={cardTitleStyle}>Temperature Distribution</span>
        </div>

        {/* Color scale gradient bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace' }}>
            {store.T_ambient.toFixed(0)}°C
          </span>
          <div
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              background: 'linear-gradient(90deg, #3b82f6 0%, #06b6d4 25%, #10b981 50%, #eab308 75%, #ef4444 100%)',
              boxShadow: '0 0 6px rgba(56, 189, 248, 0.3)',
            }}
          />
          <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace' }}>
            {store.T_source.toFixed(0)}°C
          </span>
        </div>

        {/* Miniature 3D Isometric Heat Map Preview Illustration */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="170" height="88" viewBox="0 0 170 88" style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="heaterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f87171" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
              <linearGradient id="hotGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fb923c" />
                <stop offset="100%" stopColor="#ea580c" />
              </linearGradient>
              <linearGradient id="tegGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#84cc16" />
              </linearGradient>
              <linearGradient id="coldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
              <linearGradient id="finGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>

            {/* Heat Source (Top Red Block) */}
            <polygon points="85,6 122,19 85,32 48,19" fill="url(#heaterGrad)" stroke="#fca5a5" strokeWidth="0.5" />
            <polygon points="48,19 85,32 85,39 48,26" fill="#dc2626" />
            <polygon points="85,32 122,19 122,26 85,39" fill="#b91c1c" />

            {/* Hot Plate (Orange) */}
            <polygon points="42,27 85,41 128,27 85,13" fill="none" />
            <polygon points="42,27 85,41 85,45 42,31" fill="#ea580c" />
            <polygon points="85,41 128,27 128,31 85,45" fill="#c2410c" />

            {/* TEG Module (Yellow/Green) */}
            <polygon points="46,33 85,46 124,33 85,20" fill="none" />
            <polygon points="46,33 85,46 85,50 46,37" fill="#84cc16" />
            <polygon points="85,46 124,33 124,37 85,50" fill="#65a30d" />

            {/* Cold Plate (Cyan) */}
            <polygon points="40,39 85,53 130,39 85,25" fill="none" />
            <polygon points="40,39 85,53 85,56 40,42" fill="#0284c7" />
            <polygon points="85,53 130,39 130,42 85,56" fill="#0369a1" />

            {/* Heat Sink Base & Vertical Fins (Cyan -> Blue) */}
            <polygon points="34,44 85,59 136,44 85,29" fill="url(#finGrad)" stroke="#60a5fa" strokeWidth="0.5" />
            <polygon points="34,44 85,59 85,64 34,49" fill="#1d4ed8" />
            <polygon points="85,59 136,44 136,49 85,64" fill="#1e40af" />

            {/* Array of vertical fins underneath */}
            {[-38, -26, -14, -2, 10, 22, 34].map((xOff, i) => (
              <g key={i}>
                <line x1={85 + xOff} y1={60 + Math.abs(xOff) * 0.1} x2={85 + xOff} y2={76 + Math.abs(xOff) * 0.1} stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
                <line x1={85 + xOff + 1} y1={60 + Math.abs(xOff) * 0.1} x2={85 + xOff + 1} y2={76 + Math.abs(xOff) * 0.1} stroke="#1d4ed8" strokeWidth="1" />
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* ── CARD 3: Performance Graph ── */}
      <div style={cardStyle}>
        <div style={{ ...cardHeaderStyle, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ ...iconBadgeStyle, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
              <BarChart2 size={13} />
            </div>
            <span style={cardTitleStyle}>Performance Graph</span>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8' }} />
              <span style={{ color: '#94a3b8' }}>Power</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 5, height: 5, background: '#f59e0b' }} />
              <span style={{ color: '#94a3b8' }}>Efficiency</span>
            </div>
          </div>
        </div>

        {/* Dual Axis Plot (SVG) */}
        <div style={{ flex: 1, position: 'relative' }}>
          <svg width="100%" height="100%" viewBox="0 0 220 95" preserveAspectRatio="none">
            {/* Axis grid lines */}
            <line x1="26" y1="12" x2="194" y2="12" stroke="#1e293b" strokeDasharray="2,2" />
            <line x1="26" y1="32" x2="194" y2="32" stroke="#1e293b" strokeDasharray="2,2" />
            <line x1="26" y1="52" x2="194" y2="52" stroke="#1e293b" strokeDasharray="2,2" />
            <line x1="26" y1="72" x2="194" y2="72" stroke="#334155" />

            {/* Y Left Axis labels: Power (W) */}
            <text x="6" y="15" fill="#64748b" fontSize="7" fontFamily="monospace">2.0</text>
            <text x="6" y="35" fill="#64748b" fontSize="7" fontFamily="monospace">1.5</text>
            <text x="6" y="55" fill="#64748b" fontSize="7" fontFamily="monospace">1.0</text>
            <text x="6" y="75" fill="#64748b" fontSize="7" fontFamily="monospace">0.0</text>

            {/* Y Right Axis labels: Efficiency (%) */}
            <text x="198" y="15" fill="#64748b" fontSize="7" fontFamily="monospace">100</text>
            <text x="198" y="35" fill="#64748b" fontSize="7" fontFamily="monospace">75</text>
            <text x="198" y="55" fill="#64748b" fontSize="7" fontFamily="monospace">50</text>
            <text x="198" y="75" fill="#64748b" fontSize="7" fontFamily="monospace">0</text>

            {/* X Axis labels: ΔT (°C) */}
            <text x="26" y="87" fill="#64748b" fontSize="7" fontFamily="monospace">0</text>
            <text x="68" y="87" fill="#64748b" fontSize="7" fontFamily="monospace">25</text>
            <text x="110" y="87" fill="#64748b" fontSize="7" fontFamily="monospace">50</text>
            <text x="152" y="87" fill="#64748b" fontSize="7" fontFamily="monospace">75</text>
            <text x="185" y="87" fill="#64748b" fontSize="7" fontFamily="monospace">100</text>

            <text x="110" y="94" fill="#94a3b8" fontSize="7" textAnchor="middle" fontWeight="bold">ΔT (°C)</text>

            {/* Power Curve (Blue with dots) */}
            <path
              d="M 26,72 Q 70,38 110,26 T 194,18"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
            />
            {[[26, 72], [68, 46], [110, 26], [152, 21], [194, 18]].map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r="2.5" fill="#38bdf8" stroke="#0f172a" strokeWidth="1" />
            ))}

            {/* Efficiency Curve (Orange with squares) */}
            <path
              d="M 26,72 Q 70,50 110,34 T 194,22"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
            />
            {[[26, 72], [68, 54], [110, 34], [152, 26], [194, 22]].map(([cx, cy], i) => (
              <rect key={i} x={cx - 2} y={cy - 2} width="4" height="4" fill="#f59e0b" stroke="#0f172a" strokeWidth="1" />
            ))}
          </svg>
        </div>
      </div>

      {/* ── CARD 4: System Info ── */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div style={{ ...iconBadgeStyle, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
            <Info size={13} />
          </div>
          <span style={cardTitleStyle}>System Info</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, justifyContent: 'center' }}>
          <SystemInfoRow label="Heat Transfer Rate" value={qConvStr} />
          <SystemInfoRow label="Fin Efficiency" value={etaFinStr} />
          <SystemInfoRow label="Pressure Drop" value={deltaPStr} />
          <SystemInfoRow label="Fan Power" value={pFanStr} />
          <SystemInfoRow label="Overall Efficiency" value={etaOverallStr} />
        </div>
      </div>
    </div>
  );
}

function MetricRow({
  color,
  label,
  value,
  isHighlight = false,
  valColor,
}: {
  color: string;
  label: string;
  value: string;
  isHighlight?: boolean;
  valColor?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
        <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>{label}</span>
      </div>
      <span
        style={{
          fontSize: isHighlight ? 12 : 11,
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: isHighlight ? 800 : 700,
          color: valColor ?? '#f8fafc',
          textShadow: isHighlight ? `0 0 8px ${color}66` : 'none',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function SystemInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10 }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#64748b' }}>:</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#f1f5f9', minWidth: 50, textAlign: 'right' }}>
          {value}
        </span>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(11, 20, 36, 0.85)',
  border: '1px solid #1e3a5f',
  borderRadius: 8,
  padding: '8px 12px',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
  overflow: 'hidden',
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 6,
  borderBottom: '1px solid #1e293b',
  paddingBottom: 4,
};

const iconBadgeStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: 5,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#f8fafc',
  letterSpacing: '0.02em',
};
