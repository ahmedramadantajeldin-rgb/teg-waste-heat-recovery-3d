/**
 * TEG Simulation — Design System Tokens
 * Professional engineering software aesthetic (ANSYS / COMSOL / SolidWorks style)
 */

// ─── Color Tokens ────────────────────────────────────────────────────────────

export const C = {
  // Backgrounds
  bg: {
    primary:   '#0d1117',   // main app bg
    secondary: '#161b22',   // sidebar / panels
    card:      '#1c2128',   // cards
    elevated:  '#21262d',   // hover / active cards
    border:    '#30363d',   // borders
    subtle:    '#0d1117',
  },
  // Text
  text: {
    primary:   '#e6edf3',
    secondary: '#8b949e',
    muted:     '#484f58',
    link:      '#58a6ff',
  },
  // Accent
  accent:    '#58a6ff',   // primary cyan/blue
  accentDim: '#1f6feb',
  // Semantic temperatures
  hot:  '#ef4444',   // red  — hot side
  warm: '#f97316',   // orange
  cold: '#3b82f6',   // blue — cold side
  // Status
  success: '#3fb950',
  warning: '#d29922',
  error:   '#f85149',
  // Nav
  nav: {
    bg:     '#010409',
    active: '#161b22',
    hover:  '#0d1117',
    tab:    '#1c2128',
  },
  // Engineering
  copper:  '#b87333',
  aluminum:'#a8b8c0',
  steel:   '#b8c0c8',
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────

export const FONT = {
  mono: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  sans: "-apple-system, 'Segoe UI', system-ui, sans-serif",
};

// ─── Spacing ─────────────────────────────────────────────────────────────────

export const NAV_H  = 48; // px — top navigation bar height
export const BOTTOM_H = 60; // px — compact bottom results strip height
export const RIGHT_W  = 280; // px — right control panel width

// ─── Formatting helpers ──────────────────────────────────────────────────────

/** Format a number with given decimal places and unit */
export function fmt(val: number | null | undefined, decimals = 2, unit = ''): string {
  if (val == null || isNaN(val)) return '—';
  return `${val.toFixed(decimals)}${unit ? ' ' + unit : ''}`;
}

export function fmtPct(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return '—';
  return `${(val * 100).toFixed(1)}%`;
}

/** Temperature color: blue(cold) → green → yellow → red(hot) for 0–500°C range */
export function thermalColor(T_C: number): string {
  const t = Math.min(1, Math.max(0, (T_C - 20) / 480));
  if (t < 0.33) {
    // blue → cyan
    const r = Math.round(59  + (0   - 59)  * (t / 0.33));
    const g = Math.round(130 + (200 - 130) * (t / 0.33));
    const b = Math.round(246 + (200 - 246) * (t / 0.33));
    return `rgb(${r},${g},${b})`;
  } else if (t < 0.66) {
    const p = (t - 0.33) / 0.33;
    const r = Math.round(0   + (249 - 0)   * p);
    const g = Math.round(200 + (115 - 200) * p);
    const b = Math.round(200 + (22  - 200) * p);
    return `rgb(${r},${g},${b})`;
  } else {
    const p = (t - 0.66) / 0.34;
    const r = Math.round(249 + (239 - 249) * p);
    const g = Math.round(115 + (68  - 115) * p);
    const b = Math.round(22  + (68  - 22)  * p);
    return `rgb(${r},${g},${b})`;
  }
}
