import React, { useState } from 'react';
import { useSimulationStore } from '../../store/simulationStore';
import {
  RotateCcw, Grid3x3, Wind, Camera, Tag,
  Maximize2, Box, Layers, Zap, Cpu, Flame, Activity
} from 'lucide-react';
import type { CameraPreset } from './CameraController';

interface SceneToolbarProps {
  onSetCameraPreset?: (preset: CameraPreset) => void;
  activePreset?: CameraPreset;
  onSelectPreset?: (preset: CameraPreset) => void;
  thermalView?: boolean;
  onToggleThermalView?: () => void;
  showLabels?: boolean;
  onToggleLabels?: () => void;
}

export function SceneToolbar({
  onSetCameraPreset,
  activePreset = 'full',
  onSelectPreset,
  thermalView = false,
  onToggleThermalView,
  showLabels = false,
  onToggleLabels,
}: SceneToolbarProps) {
  const store = useSimulationStore();
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);

  const handleScreenshot = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `teg-laboratory-assembly-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const presets = [
    { id: 'full' as CameraPreset, label: 'Full Assembly', icon: <Box size={11} /> },
    { id: 'cooling' as CameraPreset, label: 'Cooling View', icon: <Wind size={11} /> },
    { id: 'natural' as CameraPreset, label: 'Natural Conv.', icon: <Activity size={11} /> },
    { id: 'thermal' as CameraPreset, label: 'Thermal Analysis', icon: <Flame size={11} /> },
    { id: 'teg' as CameraPreset, label: 'TEG Core', icon: <Cpu size={11} /> },
    { id: 'electrical' as CameraPreset, label: 'Electrical View', icon: <Zap size={11} /> },
    { id: 'exploded' as CameraPreset, label: 'Exploded', icon: <Layers size={11} /> },
  ];

  const handlePresetClick = (pId: CameraPreset) => {
    if (onSelectPreset) onSelectPreset(pId);
    if (onSetCameraPreset) onSetCameraPreset(pId);
    setShowPresetsMenu(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 4,
        padding: '5px 8px',
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(10px)',
        borderRadius: 8,
        border: '1px solid #334155',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
      }}
    >
      {/* ── 7 Preset Visualization Modes (Requirement 9) ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {presets.map((p) => {
          const isActive = activePreset === p.id;
          return (
            <button
              key={p.id}
              onClick={() => handlePresetClick(p.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 7px',
                borderRadius: 5,
                border: `1px solid ${isActive ? '#38bdf8' : 'transparent'}`,
                background: isActive ? '#0284c733' : 'rgba(30, 41, 59, 0.5)',
                color: isActive ? '#38bdf8' : '#94a3b8',
                fontSize: 10,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.color = '#f1f5f9';
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.color = '#94a3b8';
              }}
            >
              {p.icon}
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>

      <div style={{ width: 1, height: 16, background: '#334155', margin: '0 2px' }} />

      {/* ── Visual Action Toggles ── */}
      {/* Fit to View */}
      <button
        onClick={() => onSetCameraPreset && onSetCameraPreset('fit')}
        title="Fit Assembly to View (~75% fill)"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: '4px 6px',
          borderRadius: 5,
          border: '1px solid #334155',
          background: 'rgba(30, 41, 59, 0.5)',
          color: '#cbd5e1',
          fontSize: 10,
          cursor: 'pointer',
        }}
      >
        <Maximize2 size={11} />
        <span>Fit</span>
      </button>

      {/* Thermal Gradient Heat Map Mode Toggle */}
      <button
        onClick={onToggleThermalView}
        title="Toggle Thermal Gradient Heat Map vs Realistic Materials"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: '4px 6px',
          borderRadius: 5,
          border: `1px solid ${thermalView ? '#f97316' : '#334155'}`,
          background: thermalView ? '#f9731626' : 'rgba(30, 41, 59, 0.5)',
          color: thermalView ? '#f97316' : '#94a3b8',
          fontSize: 10,
          fontWeight: thermalView ? 600 : 400,
          cursor: 'pointer',
        }}
      >
        <Flame size={11} />
        <span>Heat Map</span>
      </button>

      {/* Turntable Auto-Rotate */}
      <button
        onClick={() => store.setAutoRotate(!store.autoRotate)}
        title="Toggle Turntable Rotation"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: '4px 6px',
          borderRadius: 5,
          border: `1px solid ${store.autoRotate ? '#38bdf8' : '#334155'}`,
          background: store.autoRotate ? '#0284c726' : 'rgba(30, 41, 59, 0.5)',
          color: store.autoRotate ? '#38bdf8' : '#94a3b8',
          fontSize: 10,
          cursor: 'pointer',
        }}
      >
        <RotateCcw size={11} />
        <span>Rotate</span>
      </button>

      {/* Wireframe */}
      <button
        onClick={() => store.setWireframe(!store.wireframe)}
        title="Toggle Wireframe Mode"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: '4px 6px',
          borderRadius: 5,
          border: `1px solid ${store.wireframe ? '#38bdf8' : '#334155'}`,
          background: store.wireframe ? '#0284c726' : 'rgba(30, 41, 59, 0.5)',
          color: store.wireframe ? '#38bdf8' : '#94a3b8',
          fontSize: 10,
          cursor: 'pointer',
        }}
      >
        <Grid3x3 size={11} />
        <span>Wire</span>
      </button>

      {/* Airflow Particles Toggle */}
      <button
        onClick={() => store.setShowAirflow(!store.showAirflow)}
        title="Toggle Airflow Stream Particle Visualization"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: '4px 6px',
          borderRadius: 5,
          border: `1px solid ${store.showAirflow ? '#38bdf8' : '#334155'}`,
          background: store.showAirflow ? '#0284c726' : 'rgba(30, 41, 59, 0.5)',
          color: store.showAirflow ? '#38bdf8' : '#94a3b8',
          fontSize: 10,
          cursor: 'pointer',
        }}
      >
        <Wind size={11} />
        <span>Airflow</span>
      </button>

      {/* Charge Carriers / Electrons Toggle */}
      <button
        onClick={() => store.setShowElectrons(!store.showElectrons)}
        title="Toggle Electron (e⁻) & Hole (h⁺) Charge Carrier Flow Inside TEG & Wires"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: '4px 6px',
          borderRadius: 5,
          border: `1px solid ${store.showElectrons ? '#22d3ee' : '#334155'}`,
          background: store.showElectrons ? '#0891b226' : 'rgba(30, 41, 59, 0.5)',
          color: store.showElectrons ? '#22d3ee' : '#94a3b8',
          fontSize: 10,
          fontWeight: store.showElectrons ? 600 : 400,
          cursor: 'pointer',
        }}
      >
        <Zap size={11} />
        <span>e⁻ Flow</span>
      </button>

      {/* Engineering Callout Labels Toggle */}
      <button
        onClick={onToggleLabels}
        title="Toggle Engineering Callout Badges (Heat Source, Hot Plate, TEG, Cold Plate, Heat Sink)"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: '4px 6px',
          borderRadius: 5,
          border: `1px solid ${showLabels ? '#38bdf8' : '#334155'}`,
          background: showLabels ? '#0284c726' : 'rgba(30, 41, 59, 0.5)',
          color: showLabels ? '#38bdf8' : '#94a3b8',
          fontSize: 10,
          fontWeight: showLabels ? 600 : 400,
          cursor: 'pointer',
        }}
      >
        <Tag size={11} />
        <span>Labels</span>
      </button>

      {/* Save High-Res PNG Screenshot */}
      <button
        onClick={handleScreenshot}
        title="Export Screenshot PNG"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          padding: '4px 6px',
          borderRadius: 5,
          border: '1px solid #334155',
          background: 'rgba(30, 41, 59, 0.5)',
          color: '#94a3b8',
          fontSize: 10,
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = '#38bdf8';
          (e.currentTarget as HTMLElement).style.borderColor = '#0284c7';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = '#94a3b8';
          (e.currentTarget as HTMLElement).style.borderColor = '#334155';
        }}
      >
        <Camera size={11} />
        <span>Save</span>
      </button>
    </div>
  );
}
