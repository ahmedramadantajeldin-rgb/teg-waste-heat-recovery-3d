import { Html } from '@react-three/drei';

interface EngineeringCalloutsProps {
  visible: boolean;
  T_source: number;
  T_h: number;
  T_c: number;
  V_air: number;
  fanEnabled: boolean;
  finMaterial: string;
  y_heater: number;
  y_hot: number;
  y_teg: number;
  y_cold: number;
  y_hs: number;
  finLengthX: number;
  baseSpanZ: number;
  fanX: number;
  fanY: number;
  displayX?: number;
  displayZ?: number;
}

/**
 * Precision Engineering Callout Badges:
 * - Shows thin pointer with indicator dot anchored to each component
 * - 100% Toggleable via "Labels" toolbar button
 */
export function EngineeringCallouts({
  visible,
  T_source,
  T_h,
  T_c,
  V_air,
  fanEnabled,
  finMaterial,
  y_heater,
  y_hot,
  y_teg,
  y_cold,
  y_hs,
  finLengthX,
  baseSpanZ,
  fanX,
  fanY,
  displayX = 0.11,
  displayZ = 0.025,
}: EngineeringCalloutsProps) {
  if (!visible) return null;

  const matName = finMaterial.charAt(0).toUpperCase() + finMaterial.slice(1);

  return (
    <group>
      {/* 1. Heat Source Callout */}
      <Html position={[0, y_heater + 0.024, 0]} center pointerEvents="none">
        <div style={tagStyle('#dc2626', 'rgba(220, 38, 38, 0.25)')}>
          <div style={dotStyle('#ef4444')} />
          <span>Heat Source (T = {T_source.toFixed(0)} °C)</span>
        </div>
      </Html>

      {/* 2. Hot-Side Plate Callout */}
      <Html position={[-finLengthX * 0.42, y_hot + 0.010, baseSpanZ * 0.15]} center pointerEvents="none">
        <div style={tagStyle('#ea580c', 'rgba(234, 88, 12, 0.25)')}>
          <div style={dotStyle('#f97316')} />
          <span>Hot-Side Plate (T = {T_h.toFixed(1)} °C)</span>
        </div>
      </Html>

      {/* 3. TEG Module Callout (Prominent and clear) */}
      <Html position={[-finLengthX * 0.46, y_teg, -baseSpanZ * 0.12]} center pointerEvents="none">
        <div style={tagStyle('#0284c7', 'rgba(2, 132, 199, 0.35)')}>
          <div style={dotStyle('#38bdf8')} />
          <span>TEG Module (Ceramic Bi₂Te₃)</span>
        </div>
      </Html>

      {/* 4. Cold-Side Plate Callout */}
      <Html position={[-finLengthX * 0.46, y_cold - 0.010, baseSpanZ * 0.18]} center pointerEvents="none">
        <div style={tagStyle('#0891b2', 'rgba(8, 145, 178, 0.25)')}>
          <div style={dotStyle('#06b6d4')} />
          <span>Cold-Side Plate (T = {T_c.toFixed(1)} °C)</span>
        </div>
      </Html>

      {/* 5. Heat Sink Callout */}
      <Html position={[finLengthX * 0.48, y_hs, baseSpanZ * 0.40]} center pointerEvents="none">
        <div style={tagStyle('#2563eb', 'rgba(37, 99, 235, 0.25)')}>
          <div style={dotStyle('#60a5fa')} />
          <span>Heat Sink ({matName})</span>
        </div>
      </Html>

      {/* 6. Airflow Callout (only when fan is active) */}
      {fanEnabled && V_air > 0 && (
        <Html position={[fanX + 0.015, fanY - 0.014, baseSpanZ * 0.30]} center pointerEvents="none">
          <div style={tagStyle('#06b6d4', 'rgba(6, 182, 212, 0.25)')}>
            <span style={{ fontSize: 10, color: '#38bdf8' }}>➔</span>
            <span>Airflow ({V_air.toFixed(1)} m/s)</span>
          </div>
        </Html>
      )}

      {/* 7. Output Display Callout */}
      <Html position={[displayX, 0.085, displayZ]} center pointerEvents="none">
        <div style={tagStyle('#1d4ed8', 'rgba(29, 78, 216, 0.25)')}>
          <div style={dotStyle('#60a5fa')} />
          <span>Electrical Output Panel</span>
        </div>
      </Html>
    </group>
  );
}

function tagStyle(borderColor: string, glowColor: string): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 8px',
    background: 'rgba(8, 15, 26, 0.90)',
    border: `1px solid ${borderColor}`,
    borderRadius: 6,
    color: '#f8fafc',
    fontSize: 9.5,
    fontWeight: 600,
    letterSpacing: '0.02em',
    whiteSpace: 'nowrap',
    boxShadow: `0 2px 8px rgba(0, 0, 0, 0.6), 0 0 10px ${glowColor}`,
    userSelect: 'none',
  };
}

function dotStyle(color: string): React.CSSProperties {
  return {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: color,
    boxShadow: `0 0 6px ${color}`,
    flexShrink: 0,
  };
}
