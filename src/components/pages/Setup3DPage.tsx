import React, { useState, useMemo } from 'react';
import { TEGScene } from '../scene3d/TEGScene';
import { useSimulationStore, selectSimState } from '../../store/simulationStore';
import { computeAssemblyGeometry } from '../../physics/assemblyGeometry';
import { resolveInsulationMaterial } from '../../physics/insulationModel';
import type { SimulationResults } from '../../physics/types';
import {
  Thermometer, Layers, Wind, Shield, Play, CheckCircle2,
  ChevronDown, ChevronRight, Crosshair, Cpu
} from 'lucide-react';

interface Setup3DPageProps {
  results: SimulationResults | null;
}

// ─── Custom Engineering Slider with Live Dragging & Min/Max ──────────────────
interface EngineeringSliderProps {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step?: number;
  decimals?: number;
  onChange: (val: number) => void;
}

function EngineeringSlider({
  label,
  value,
  unit,
  min,
  max,
  step = 1,
  decimals = 0,
  onChange,
}: EngineeringSliderProps) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 500 }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
          <span style={{ fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace", color: '#38bdf8', fontWeight: 700 }}>
            {value.toFixed(decimals)}
          </span>
          <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>{unit}</span>
        </div>
      </div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{
            width: '100%',
            height: 4,
            borderRadius: 2,
            background: `linear-gradient(90deg, #1d4ed8 0%, #38bdf8 ${pct}%, #1e293b ${pct}%, #1e293b 100%)`,
            outline: 'none',
            cursor: 'pointer',
            accentColor: '#38bdf8',
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 1, fontSize: 8.5, color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

// ─── Custom Dropdown Select Row ─────────────────────────────────────────────
function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
      <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 500 }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid #1e3a5f',
          borderRadius: 6,
          padding: '3px 8px',
          color: '#f8fafc',
          fontSize: 10.5,
          fontWeight: 600,
          outline: 'none',
          cursor: 'pointer',
          minWidth: 125,
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} style={{ background: '#0f172a', color: '#f8fafc' }}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Custom Toggle Switch Row ────────────────────────────────────────────────
function ToggleSwitchRow({
  icon,
  label,
  enabled,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: enabled ? '#38bdf8' : '#64748b', display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 600 }}>{label}</span>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        style={{
          padding: '2px 10px',
          borderRadius: 12,
          border: `1px solid ${enabled ? '#38bdf8' : '#334155'}`,
          background: enabled ? 'linear-gradient(90deg, #1d4ed8 0%, #2563eb 100%)' : '#1e293b',
          color: enabled ? '#ffffff' : '#64748b',
          fontSize: 9.5,
          fontWeight: 800,
          cursor: 'pointer',
          letterSpacing: '0.04em',
          boxShadow: enabled ? '0 0 8px rgba(37, 99, 235, 0.5)' : 'none',
          transition: 'all 0.15s ease',
        }}
      >
        {enabled ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}

// ─── Collapsible Panel Section ───────────────────────────────────────────────
function CollapsibleSection({
  icon,
  title,
  isOpen,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: '1px solid #1e3a5f', paddingBottom: 8, marginBottom: 4 }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
          border: 'none',
          padding: '6px 0',
          cursor: 'pointer',
          color: '#f8fafc',
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {icon}
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', color: '#f8fafc' }}>
            {title}
          </span>
        </div>
        <div style={{ color: '#64748b', display: 'flex', alignItems: 'center' }}>
          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </div>
      </button>
      {isOpen && <div style={{ paddingTop: 6 }}>{children}</div>}
    </div>
  );
}

// ─── Right Sidebar: Quick Controls ─────────────────────────────────────────
function QuickControlsSidebar({ results }: { results: SimulationResults | null }) {
  const store = useSimulationStore();
  const simState = selectSimState(store);

  const geom = useMemo(() => computeAssemblyGeometry(simState, false), [simState]);

  const [openSections, setOpenSections] = useState({
    operating: true,
    teg: false,
    fin: true,
    cooling: true,
    insulation: true,
  });

  const [isSimulating, setIsSimulating] = useState(false);

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
    }, 600);
  };

  const tegSideMm = Math.round(geom.tegW * 1000);
  const currentInsMat = resolveInsulationMaterial(store.insulation.material);
  const rawMat = store.insulation.material as string;
  const resolvedMatValue =
    rawMat === 'ceramic_fiber'
      ? 'ceramicfiber'
      : rawMat === 'mineral_wool'
        ? 'rockwool'
        : rawMat;

  return (
    <div
      style={{
        width: 300,
        background: 'rgba(8, 15, 26, 0.96)',
        borderLeft: '1px solid #1e3a5f',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflowY: 'auto',
        boxSizing: 'border-box',
        zIndex: 20,
      }}
    >
      {/* Sidebar Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid #1e3a5f',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(15, 23, 42, 0.75)',
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            background: 'rgba(56, 189, 248, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8',
          }}
        >
          <Crosshair size={13} />
        </div>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#f8fafc', letterSpacing: '0.02em' }}>
          Quick Controls
        </span>
      </div>

      {/* Sidebar Content (Scrollable) */}
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Section 1: Operating Conditions */}
        <CollapsibleSection
          icon={
            <div style={{ width: 17, height: 17, borderRadius: 4, background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
              <Thermometer size={11} />
            </div>
          }
          title="Operating Conditions"
          isOpen={openSections.operating}
          onToggle={() => toggleSection('operating')}
        >
          <EngineeringSlider
            label="Hot Source Temp:"
            value={store.T_source}
            unit="°C"
            min={50}
            max={500}
            step={5}
            onChange={store.setT_source}
          />
          <EngineeringSlider
            label="Ambient Temp:"
            value={store.T_ambient}
            unit="°C"
            min={10}
            max={50}
            step={1}
            onChange={store.setT_ambient}
          />
          <EngineeringSlider
            label="Air Velocity:"
            value={store.convection.V_air}
            unit="m/s"
            min={0}
            max={15}
            step={0.5}
            decimals={1}
            onChange={(v) =>
              store.updateConvection({
                V_air: v,
                mode: v > 0 ? 'forced' : 'natural',
                fanEnabled: v > 0,
              })
            }
          />
          <SelectRow
            label="Convection Mode:"
            value={store.convection.mode}
            options={[
              { label: 'Forced Convection', value: 'forced' },
              { label: 'Natural Convection', value: 'natural' },
            ]}
            onChange={(m) =>
              store.updateConvection({
                mode: m as 'forced' | 'natural',
                fanEnabled: m === 'forced',
              })
            }
          />
        </CollapsibleSection>

        {/* Section 2: Parametric TEG Module & Spreaders */}
        <CollapsibleSection
          icon={
            <div style={{ width: 17, height: 17, borderRadius: 4, background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
              <Cpu size={11} />
            </div>
          }
          title="TEG Module & Spreaders"
          isOpen={openSections.teg}
          onToggle={() => toggleSection('teg')}
        >
          <EngineeringSlider
            label="Module Side Width:"
            value={tegSideMm}
            unit="mm"
            min={24}
            max={64}
            step={2}
            onChange={(sideMm) => {
              const sideM = sideMm / 1000;
              const newArea = sideM * sideM;
              const areaRatio = newArea / 0.0016;
              const newK = 0.6 * areaRatio;
              store.updateTEG({
                A_module: newArea,
                K_teg: newK,
                R_teg: 1 / newK,
              });
            }}
          />
          <EngineeringSlider
            label="Load Resistance (R_L):"
            value={parseFloat(store.R_load.toFixed(1))}
            unit="Ω"
            min={0.5}
            max={10.0}
            step={0.1}
            decimals={1}
            onChange={store.setR_load}
          />
          <div style={{ fontSize: 9.5, color: '#94a3b8', background: 'rgba(15, 23, 42, 0.65)', padding: '5px 8px', borderRadius: 5, border: '1px solid #1e293b', fontFamily: "'JetBrains Mono', monospace" }}>
            Hot: {(geom.hotSpreaderW * 1000).toFixed(0)}×{(geom.hotSpreaderL * 1000).toFixed(0)} mm · Cold: {(geom.coldSpreaderW * 1000).toFixed(0)}×{(geom.coldSpreaderL * 1000).toFixed(0)} mm
          </div>
        </CollapsibleSection>

        {/* Section 3: Fin Design */}
        <CollapsibleSection
          icon={
            <div style={{ width: 17, height: 17, borderRadius: 4, background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
              <Layers size={11} />
            </div>
          }
          title="Fin Design"
          isOpen={openSections.fin}
          onToggle={() => toggleSection('fin')}
        >
          <SelectRow
            label="Fin Type:"
            value={store.fin.type}
            options={[
              { label: 'Plate Fins', value: 'plate' },
              { label: 'Pin Fins', value: 'pin' },
            ]}
            onChange={(t) => store.updateFin({ type: t as 'plate' | 'pin' })}
          />

          <EngineeringSlider
            label="Fin Count (N):"
            value={store.fin.N}
            unit="fins"
            min={2}
            max={24}
            step={1}
            onChange={(n) => store.updateFin({ N: n })}
          />

          <EngineeringSlider
            label="Fin Length:"
            value={Math.round(store.fin.L * 1000)}
            unit="mm"
            min={40}
            max={160}
            step={2}
            onChange={(v) => store.updateFin({ L: v / 1000, L_base: v / 1000 })}
          />

          <EngineeringSlider
            label="Fin Height:"
            value={Math.round(store.fin.H * 1000)}
            unit="mm"
            min={10}
            max={80}
            step={1}
            onChange={(v) => store.updateFin({ H: v / 1000 })}
          />

          <EngineeringSlider
            label="Fin Thickness:"
            value={parseFloat((store.fin.t * 1000).toFixed(1))}
            unit="mm"
            min={0.5}
            max={6.0}
            step={0.5}
            decimals={1}
            onChange={(v) => store.updateFin({ t: v / 1000 })}
          />

          <EngineeringSlider
            label="Fin Spacing:"
            value={parseFloat((store.fin.S * 1000).toFixed(1))}
            unit="mm"
            min={1.0}
            max={15.0}
            step={0.5}
            decimals={1}
            onChange={(v) => store.updateFin({ S: v / 1000 })}
          />

          <SelectRow
            label="Fin Material:"
            value={store.fin.material}
            options={[
              { label: 'Aluminum', value: 'aluminum' },
              { label: 'Copper', value: 'copper' },
              { label: 'Steel', value: 'steel' },
            ]}
            onChange={(mat) => store.updateFin({ material: mat as any })}
          />

          <div style={{ fontSize: 9.5, color: '#94a3b8', background: 'rgba(15, 23, 42, 0.65)', padding: '5px 8px', borderRadius: 5, border: '1px solid #1e293b', fontFamily: "'JetBrains Mono', monospace" }}>
            Sink: {(geom.hsLengthX * 1000).toFixed(0)}×{(geom.hsWidthZ * 1000).toFixed(0)} mm · Fan Gap: {(geom.fanClearanceFins * 1000).toFixed(1)} mm
          </div>
        </CollapsibleSection>

        {/* Section 3: Cooling System */}
        <CollapsibleSection
          icon={
            <div style={{ width: 17, height: 17, borderRadius: 4, background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
              <Wind size={11} />
            </div>
          }
          title="Cooling System"
          isOpen={openSections.cooling}
          onToggle={() => toggleSection('cooling')}
        >
          <ToggleSwitchRow
            icon={<Wind size={12} />}
            label="Fan Control"
            enabled={store.convection.fanEnabled}
            onChange={() => store.toggleFan()}
          />
          <EngineeringSlider
            label="Fan Efficiency:"
            value={Math.round((store.convection.fanEfficiency ?? 0.6) * 100)}
            unit="%"
            min={30}
            max={95}
            step={5}
            onChange={(eff) => store.updateConvection({ fanEfficiency: eff / 100 })}
          />
        </CollapsibleSection>

        {/* Section 4: Thermal Insulation */}
        <CollapsibleSection
          icon={
            <div style={{ width: 17, height: 17, borderRadius: 4, background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
              <Shield size={11} />
            </div>
          }
          title="Thermal Insulation"
          isOpen={openSections.insulation}
          onToggle={() => toggleSection('insulation')}
        >
          <ToggleSwitchRow
            icon={<Shield size={12} />}
            label="Thermal Insulation"
            enabled={store.insulation.enabled}
            onChange={(en) => store.updateInsulation({ enabled: en })}
          />
          {store.insulation.enabled && (
            <>
              <EngineeringSlider
                label="Insulation Thickness:"
                value={Math.round(store.insulation.thickness * 1000)}
                unit="mm"
                min={5}
                max={60}
                step={1}
                onChange={(thk) => store.updateInsulation({ thickness: thk / 1000 })}
              />
              <SelectRow
                label="Insulation Material:"
                value={resolvedMatValue}
                options={[
                  { label: 'Glass Wool', value: 'glasswool' },
                  { label: 'Rock Wool (Mineral)', value: 'rockwool' },
                  { label: 'Ceramic Fiber', value: 'ceramicfiber' },
                  { label: 'Calcium Silicate', value: 'calciumsilicate' },
                  { label: 'Aerogel Blanket', value: 'aerogel' },
                  { label: 'Polyurethane', value: 'polyurethane' },
                ]}
                onChange={(m) => store.updateInsulation({ material: m as any })}
              />
              {results && (
                <div style={{ fontSize: 9.5, color: '#94a3b8', background: 'rgba(15, 23, 42, 0.65)', padding: '5px 8px', borderRadius: 5, border: '1px solid #1e293b', fontFamily: "'JetBrains Mono', monospace", display: 'flex', justifyContent: 'space-between' }}>
                  <span>k={currentInsMat?.k ?? 0.04}</span>
                  <span>R={results.insulation.R_insulation.toFixed(1)} K/W</span>
                  <span style={{ color: '#34d399' }}>-{results.insulation.reduction_pct.toFixed(0)}% loss</span>
                </div>
              )}
            </>
          )}
        </CollapsibleSection>

        {/* Section 5: Run Simulation / Update Model Button */}
        <button
          onClick={handleRunSimulation}
          style={{
            marginTop: 6,
            marginBottom: 10,
            width: '100%',
            padding: '10px 14px',
            background: isSimulating
              ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
              : 'linear-gradient(90deg, #1d4ed8 0%, #2563eb 100%)',
            border: 'none',
            borderRadius: 20,
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: isSimulating
              ? '0 4px 16px rgba(16, 185, 129, 0.45)'
              : '0 4px 16px rgba(37, 99, 235, 0.45)',
            letterSpacing: '0.02em',
            transition: 'all 0.2s ease',
          }}
        >
          {isSimulating ? (
            <>
              <CheckCircle2 size={13} />
              <span>Model Updated</span>
            </>
          ) : (
            <>
              <Play size={13} fill="#ffffff" />
              <span>Run Simulation</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main Setup3DPage: 100% Full Height Viewport (No Bottom Cards) ──────────
export function Setup3DPage({ results }: Setup3DPageProps) {
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* 3D Scene Viewport takes full remaining screen space */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0, height: '100%' }}>
        <TEGScene results={results} style={{ position: 'absolute', inset: 0 }} />
      </div>

      {/* Redesigned Quick Controls Sidebar */}
      <QuickControlsSidebar results={results} />
    </div>
  );
}
