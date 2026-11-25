/**
 * TEG Simulation — Shared UI Components
 * Professional engineering design system components
 */
import React from 'react';
import { C, FONT } from '../design/theme';

// ─── Engineering Slider ───────────────────────────────────────────────────────
interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  formatVal?: (v: number) => string;
}

export function Slider({ label, value, min, max, step, unit = '', onChange, formatVal }: SliderProps) {
  const display = formatVal ? formatVal(value) : value.toFixed(step < 0.01 ? 4 : step < 1 ? 2 : 0);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: C.text.secondary }}>{label}</span>
        <span style={{
          fontSize: 12, fontFamily: FONT.mono, fontWeight: 600,
          color: C.text.primary, letterSpacing: '-0.02em',
        }}>
          {display}
          <span style={{ fontSize: 9, color: C.text.muted, marginLeft: 2 }}>{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.text.muted, marginTop: 1 }}>
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

// ─── KPI / Stat Card ──────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: number | string;
  unit?: string;
  color?: string;
  sub?: string;
  good?: boolean;
  accentBorder?: string;
}

export function StatCard({ label, value, unit = '', color, sub, good, accentBorder }: StatCardProps) {
  const display = typeof value === 'number'
    ? (Math.abs(value) >= 1000 ? value.toFixed(0) : Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(3))
    : value;
  return (
    <div style={{
      background: C.bg.card,
      border: `1px solid ${C.bg.border}`,
      borderLeft: accentBorder ? `3px solid ${accentBorder}` : undefined,
      borderRadius: 6,
      padding: '8px 10px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {good !== undefined && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          width: 0, height: 0,
          borderTop: `16px solid ${good ? C.success : C.error}44`,
          borderLeft: '16px solid transparent',
        }} />
      )}
      <div style={{ fontSize: 9, color: C.text.secondary, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{
        fontSize: 18, fontFamily: FONT.mono, fontWeight: 700,
        color: color ?? C.text.primary, letterSpacing: '-0.03em', lineHeight: 1.1,
      }}>
        {display}
        <span style={{ fontSize: 10, fontWeight: 400, color: C.text.muted, marginLeft: 3 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 10, color: C.text.muted, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

// ─── Large KPI Card ───────────────────────────────────────────────────────────
export function KPICard({ label, value, unit = '', color, sub, icon }: {
  label: string; value: number | string; unit?: string; color?: string; sub?: string; icon?: React.ReactNode;
}) {
  const display = typeof value === 'number'
    ? (Math.abs(value) >= 1000 ? value.toFixed(0) : Math.abs(value) >= 10 ? value.toFixed(2) : value.toFixed(3))
    : value;
  return (
    <div style={{
      background: C.bg.card,
      border: `1px solid ${C.bg.border}`,
      borderTop: `2px solid ${color ?? C.accent}`,
      borderRadius: 8,
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {icon && <span style={{ color: color ?? C.accent }}>{icon}</span>}
        <span style={{ fontSize: 10, color: C.text.secondary, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{
        fontSize: 28, fontFamily: FONT.mono, fontWeight: 700,
        color: color ?? C.text.primary, letterSpacing: '-0.03em', lineHeight: 1,
      }}>
        {display}
        <span style={{ fontSize: 13, fontWeight: 400, color: C.text.secondary, marginLeft: 4 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 11, color: C.text.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── Section Panel ────────────────────────────────────────────────────────────
export function SectionPanel({ title, children, accentColor, action }: {
  title: string; children: React.ReactNode; accentColor?: string; action?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8, paddingBottom: 6,
        borderBottom: `1px solid ${C.bg.border}`,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: accentColor ?? C.accent,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            width: 3, height: 10, borderRadius: 2,
            background: accentColor ?? C.accent,
            display: 'inline-block',
          }} />
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Section Title ────────────────────────────────────────────────────────────
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
      color: C.text.secondary, marginBottom: 8, marginTop: 16,
    }}>
      {children}
    </div>
  );
}

// ─── Info Row (key-value table row) ──────────────────────────────────────────
export function InfoRow({ label, value, unit, color, eq }: {
  label: string; value: string | number; unit?: string; color?: string; eq?: string;
}) {
  const disp = typeof value === 'number'
    ? (isNaN(value) ? '—' : Math.abs(value) >= 1000 ? value.toFixed(0) : Math.abs(value) >= 10 ? value.toFixed(2) : value.toFixed(4))
    : (value ?? '—');
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '5px 8px',
      borderBottom: `1px solid ${C.bg.border}`,
    }}>
      <span style={{ fontSize: 11, color: C.text.secondary, flex: 1 }}>{label}</span>
      {eq && <span style={{ fontSize: 9, color: C.text.muted, marginRight: 8 }}>{eq}</span>}
      <span style={{ fontSize: 12, fontFamily: FONT.mono, fontWeight: 600, color: color ?? C.text.primary }}>
        {disp}
        {unit && <span style={{ fontSize: 9, color: C.text.muted, marginLeft: 2 }}>{unit}</span>}
      </span>
    </div>
  );
}

// ─── Toggle Button ────────────────────────────────────────────────────────────
export function ToggleBtn({ label, value, onChange, colorOn = C.accent }: {
  label: string; value: boolean; onChange: (v: boolean) => void; colorOn?: string;
}) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', cursor: 'pointer' }}
      onClick={() => onChange(!value)}
    >
      <span style={{ fontSize: 11, color: C.text.secondary }}>{label}</span>
      <div style={{
        width: 36, height: 20, borderRadius: 10,
        background: value ? colorOn : C.bg.border,
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute',
          top: 2, left: value ? 18 : 2,
          width: 16, height: 16,
          borderRadius: 8,
          background: '#fff',
          transition: 'left 0.2s',
        }} />
      </div>
    </div>
  );
}

// ─── Warnings ─────────────────────────────────────────────────────────────────
export function Warnings({ warnings }: { warnings?: string[] }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      {warnings.map((w, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          background: '#1a1200',
          border: `1px solid ${C.warning}44`,
          borderRadius: 6,
          padding: '7px 10px',
          marginBottom: 4,
          fontSize: 11,
          color: C.warning,
        }}>
          <span style={{ flexShrink: 0 }}>⚠</span>
          {w}
        </div>
      ))}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
export function StatusBadge({ label, variant = 'info' }: {
  label: string;
  variant?: 'success' | 'warning' | 'error' | 'info';
}) {
  const colors = {
    success: { bg: '#0d2818', border: C.success, text: C.success },
    warning: { bg: '#1a1200', border: C.warning, text: C.warning },
    error:   { bg: '#1a0505', border: C.error,   text: C.error   },
    info:    { bg: '#091830', border: C.accent,  text: C.accent  },
  }[variant];
  return (
    <span style={{
      background: colors.bg,
      border: `1px solid ${colors.border}44`,
      color: colors.text,
      fontSize: 10,
      fontWeight: 600,
      padding: '2px 7px',
      borderRadius: 4,
      letterSpacing: '0.04em',
    }}>
      {label}
    </span>
  );
}

// ─── Material Button Group ────────────────────────────────────────────────────
export function BtnGroup({ options, value, onChange }: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', border: `1px solid ${C.bg.border}`, borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
      {options.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1,
            padding: '6px 4px',
            border: 'none',
            borderRight: i < options.length - 1 ? `1px solid ${C.bg.border}` : 'none',
            background: value === opt.value ? C.accentDim : C.bg.card,
            color: value === opt.value ? '#fff' : C.text.secondary,
            fontSize: 11,
            fontWeight: value === opt.value ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
