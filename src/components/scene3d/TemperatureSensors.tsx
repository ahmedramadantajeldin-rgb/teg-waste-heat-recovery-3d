interface TemperatureSensorsProps {
  show: boolean;
  T_source: number;
  T_h: number;
  T_c: number;
  T_ambient: number;
}

/**
 * Physical Thermocouple Sensor Probes:
 * - Mineral-insulated stainless steel thermocouple sheath needles
 * - Inserted directly into test ports
 * - Completely clean: NO HTML or text labels
 */
export function TemperatureSensors({ show }: TemperatureSensorsProps) {
  if (!show) return null;

  return null; // The physical probes are now integrated directly into the realistic plates!
}
