import * as THREE from 'three';

/**
 * Jet-like thermal colormap: maps a temperature value to a THREE.Color.
 * Blue (cold) → Cyan → Green → Yellow → Orange → Red (hot)
 */
export function tempToColor(T: number, T_min: number, T_max: number): THREE.Color {
  const norm = THREE.MathUtils.clamp((T - T_min) / Math.max(1, T_max - T_min), 0, 1);
  const color = new THREE.Color();

  if (norm < 0.25) {
    // Blue (#0000ff) → Cyan (#00ffff)
    const t = norm / 0.25;
    color.setRGB(0, t, 1);
  } else if (norm < 0.5) {
    // Cyan → Green (#00ff00)
    const t = (norm - 0.25) / 0.25;
    color.setRGB(0, 1, 1 - t);
  } else if (norm < 0.75) {
    // Green → Yellow/Orange (#ffaa00)
    const t = (norm - 0.5) / 0.25;
    color.setRGB(t, 1 - t * 0.33, 0);
  } else {
    // Orange → Red (#ff0000)
    const t = (norm - 0.75) / 0.25;
    color.setRGB(1, (1 - t) * 0.67, 0);
  }

  return color;
}

/**
 * Returns a hex color string for a normalized heat intensity 0–1.
 * Used for quick CSS color generation.
 */
export function heatIntensityToHex(intensity: number): string {
  return `#${tempToColor(intensity, 0, 1).getHexString()}`;
}

export const MATERIAL_COLORS: Record<string, string> = {
  aluminum: '#c0c8d4',
  copper: '#b87333',
  steel: '#8a9099',
  ceramic_hot: '#e87020',
  ceramic_cold: '#3080d0',
  insulation_glasswool: '#f5f0e0',
  insulation_aerogel: '#d0e8f5',
  insulation_ceramic: '#f0e8c0',
  insulation_rockwool: '#e8d8c0',
  insulation_calciumsilicate: '#f0ece4',
  insulation_polyurethane: '#e0f0e0',
};

/** PBR material presets for MeshStandardMaterial */
export const PBR_PRESETS: Record<string, { color: string; metalness: number; roughness: number }> = {
  aluminum: { color: '#c0c8d4', metalness: 0.85, roughness: 0.25 },
  copper:   { color: '#b87333', metalness: 0.9,  roughness: 0.3  },
  steel:    { color: '#8a9099', metalness: 0.8,  roughness: 0.4  },
  ceramic:  { color: '#e8dcc8', metalness: 0.0,  roughness: 0.7  },
  plastic:  { color: '#c8d8d0', metalness: 0.0,  roughness: 0.6  },
};
