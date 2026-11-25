import { Component, Suspense, useState, useMemo, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { HeatSource } from './HeatSource';
import { HotSideSpreader } from './HotSideSpreader';
import { TEGModule } from './TEGModule';
import { ColdSideSpreader } from './ColdSideSpreader';
import { HeatSink3D } from './HeatSink3D';
import { FanComponent } from './FanComponent';
import { AirflowParticles } from './AirflowParticles';
import { NaturalConvectionParticles } from './NaturalConvectionParticles';
import { ThermalInsulation } from './ThermalInsulation';
import { SingleElectricalDisplay } from './SingleElectricalDisplay';
import { WorkbenchEnvironment } from './WorkbenchEnvironment';
import { CameraController, CameraPreset } from './CameraController';
import { SceneToolbar } from './SceneToolbar';
import { EngineeringCallouts } from './EngineeringCallouts';
import { ThermalLegendHUD } from './thermalShader';
import { useSimulationStore, selectSimState } from '../../store/simulationStore';
import { computeAssemblyGeometry } from '../../physics/assemblyGeometry';
import type { SimulationResults } from '../../physics/types';

interface TEGSceneProps {
  results: SimulationResults | null;
  style?: React.CSSProperties;
}

class SceneErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: '' };
  static getDerivedStateFromError(err: unknown) {
    return { hasError: true, message: err instanceof Error ? err.message : 'WebGL initialization failed' };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 24,
          background: '#090e17', color: '#cbd5e1', textAlign: 'center', gap: 10,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>3D WebGL View Unavailable</div>
          <div style={{ fontSize: 12, color: '#94a3b8', maxWidth: 420 }}>
            Hardware acceleration or WebGL context could not be initialized ({this.state.message}). All engineering calculators and charts remain available in the top tabs.
          </div>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid #38bdf8',
              background: '#0284c733', color: '#38bdf8', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Retry 3D Viewport
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Realistic Parametric TEG Laboratory Simulation Scene:
 * - Unified parametric geometry shared directly with the thermal solver
 * - Open-tunnel cooling fan with sculpted blades & dynamic fin clearance
 * - GLSL per-pixel FEA Thermal Heat Map mode with Paper Eq.(21) fin decay, isotherm contours & CFD scale bar
 * - Non-intersecting test cables from right-side TEG lugs to underside Electrical Output OLED panel
 */
export function TEGScene({ results, style }: TEGSceneProps) {
  const store = useSimulationStore();
  const simState = selectSimState(store);
  const { fin, convection, insulation, showAirflow, showElectrons, autoRotate, showLabels, explodeView } = store;

  const [cameraPreset, setCameraPreset] = useState<CameraPreset | null>(null);
  const [activePreset, setActivePreset] = useState<CameraPreset>('full');
  const [thermalView, setThermalView] = useState(false);

  const geom = useMemo(
    () => computeAssemblyGeometry(simState, explodeView),
    [simState, explodeView],
  );

  const cameraTarget: [number, number, number] = useMemo(
    () => [0.008, geom.apparatusCenterY, 0.006],
    [geom.apparatusCenterY],
  );

  // Coupled thermal node temperatures for FEA Heat Map
  const T_min_scale = store.T_ambient;
  const T_max_scale = Math.max(store.T_ambient + 20, store.T_source);
  const T_h = results?.teg.T_h ?? store.T_source * 0.8;
  const T_c = results?.teg.T_c ?? store.T_ambient + 20;
  const T_hs_base = results
    ? store.T_ambient + results.teg.Q_h * results.fin.R_hs
    : Math.max(store.T_ambient + 5, T_c - 2);
  const m_param = results?.fin.m_param ?? 14;
  const T_hot_block = results
    ? Math.min(store.T_source, T_h + results.teg.Q_h * (results.teg.R_cond_h + results.teg.R_c_h))
    : (store.T_source + T_h) * 0.5;
  const insArea = insulation.autoArea === false && insulation.area > 0
    ? insulation.area
    : geom.A_insulation_geom;
  const T_ins_outer = results && insulation.enabled
    ? Math.min(T_hot_block, store.T_ambient + results.insulation.Q_loss_with / Math.max(0.01, 8 * insArea))
    : store.T_ambient + 8;
  const airBias = convection.fanEnabled && convection.V_air > 0
    ? Math.min(6.0, 4.5 / Math.max(0.8, Math.sqrt(convection.V_air)))
    : 0.5;

  const actualV = results?.teg.V_load ?? 0;
  const actualI = results?.teg.I_load ?? 0;
  const actualP = results?.teg.P_elec ?? 0;
  const ratedV = store.teg.N_couples * store.teg.alpha * 100;

  const handleSelectPreset = (pId: CameraPreset) => {
    setActivePreset(pId);
    setCameraPreset(pId);

    switch (pId) {
      case 'full':
        setThermalView(false);
        store.setExplodeView(false);
        break;

      case 'forced':
      case 'cooling':
        setThermalView(false);
        store.setExplodeView(false);
        store.updateConvection({
          mode: 'forced',
          fanEnabled: true,
          V_air: store.convection.V_air > 0 ? store.convection.V_air : 4.0,
        });
        store.setShowAirflow(true);
        break;

      case 'natural':
        setThermalView(false);
        store.setExplodeView(false);
        store.updateConvection({
          mode: 'natural',
          fanEnabled: false,
          V_air: 0,
        });
        break;

      case 'thermal':
        setThermalView(true);
        break;

      case 'electrical':
        setThermalView(false);
        store.setExplodeView(false);
        break;

      case 'teg':
        setThermalView(false);
        store.setExplodeView(false);
        store.setShowElectrons(true);
        break;

      case 'exploded':
        setThermalView(false);
        store.setExplodeView(!explodeView);
        break;

      case 'insulation':
        setThermalView(false);
        store.updateInsulation({ enabled: true });
        break;

      case 'fin':
        setThermalView(false);
        break;
    }
  };

  const isFanVisible = convection.mode !== 'natural';
  const isFanRunning = isFanVisible && convection.fanEnabled && convection.V_air > 0;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#090e17', ...style }}>
      {/* ── Top Toolbar with Preset Views & Toggles ── */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 12,
          right: 12,
          zIndex: 20,
          pointerEvents: 'none',
        }}
      >
        <div style={{ pointerEvents: 'auto', display: 'inline-block', maxWidth: '100%' }}>
          <SceneToolbar
            onSetCameraPreset={(preset) => setCameraPreset(preset)}
            activePreset={activePreset}
            onSelectPreset={handleSelectPreset}
            thermalView={thermalView}
            onToggleThermalView={() => setThermalView(!thermalView)}
            showLabels={showLabels}
            onToggleLabels={() => store.setShowLabels(!showLabels)}
          />
        </div>
      </div>

      {/* ── Non-intrusive FEA Temperature Scale Bar (only when Heat Map is active) ── */}
      <ThermalLegendHUD
        visible={thermalView}
        T_min={T_min_scale}
        T_max={T_max_scale}
        T_h={T_h}
        T_c={T_c}
      />

      {/* ── Non-intrusive Seebeck Carrier Flow Legend HUD (shown in TEG Core close-up) ── */}
      {activePreset === 'teg' && !thermalView && showElectrons && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            zIndex: 25,
            background: 'rgba(8, 15, 26, 0.90)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: '8px 12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            pointerEvents: 'none',
            fontSize: 10,
            color: '#cbd5e1',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: 4, letterSpacing: '0.03em' }}>
            SEEBECK CARRIER TRANSPORT
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8', display: 'inline-block' }} />
            <span>e⁻ Electrons (N-leg): Hot → Cold → (- Load +)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 8px #fbbf24', display: 'inline-block' }} />
            <span>h⁺ Holes (P-leg): Hot → Cold</span>
          </div>
          <div style={{ fontSize: 9.5, color: '#94a3b8', borderTop: '1px solid #1e293b', paddingTop: 3 }}>
            P_elec ({actualP.toFixed(2)} W) · I ({actualI.toFixed(2)} A) · ΔT ({Math.max(0, T_h - T_c).toFixed(1)} K)
          </div>
        </div>
      )}

      {/* ── Main 3D Canvas ── */}
      <SceneErrorBoundary>
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [-0.015, geom.apparatusCenterY + 0.095, 0.275], fov: 32 }}
          style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(160deg, #24344d 0%, #152236 60%, #0d1522 100%)',
          }}
          shadows="soft"
          gl={{
            antialias: true,
            alpha: false,
            preserveDrawingBuffer: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.24,
          }}
          onCreated={({ gl }) => {
            gl.setClearColor('#131e30', 1);
          }}
        >
          <Suspense fallback={null}>
          <WorkbenchEnvironment width={geom.benchWidthX} depth={geom.benchDepthZ} />

          <CameraController
            target={cameraTarget}
            geom={geom}
            autoRotate={autoRotate}
            preset={cameraPreset}
            onPresetHandled={() => setCameraPreset(null)}
          />

          <group>
            {/* ── 1. Extruded Fin Heat Sink ── */}
            <HeatSink3D
              N={geom.finCount}
              H={geom.H_fin}
              L={geom.hsLengthX}
              t={geom.t_fin}
              S={geom.S_fin}
              W_base={geom.hsWidthZ}
              L_base={geom.hsLengthX}
              t_base={geom.t_base}
              mountThickness={geom.mountThickness}
              mountWidthX={geom.mountWidthX}
              mountWidthZ={geom.mountWidthZ}
              coldFootprintR={geom.coldSpreaderW * 0.5}
              material={fin.material}
              viewMode={thermalView ? 'thermal' : 'material'}
              T_base={T_hs_base}
              T_tip={T_hs_base - 0.75 * (T_hs_base - T_min_scale)}
              T_inf={T_min_scale}
              T_maxScale={T_max_scale}
              finM={m_param}
              airflowWarming={airBias}
              finType={geom.finType}
              position={[0, geom.y_hs_base, 0]}
            />

            {/* ── 2. Cold-Side Aluminum Spreader Plate ── */}
            <ColdSideSpreader
              T={T_c}
              T_hs_base={T_hs_base}
              T_min={T_min_scale}
              T_max={T_max_scale}
              coreRadius={geom.tegW * 0.5}
              position={[0, geom.y_cold, 0]}
              width={geom.coldSpreaderW}
              length={geom.coldSpreaderL}
              thickness={geom.t_cold}
              thermalView={thermalView}
              labelsVisible={false}
            />

            {/* ── 3. Thermoelectric Generator (TEG) Module with Live Carrier Transport ── */}
            <TEGModule
              T_h={T_h}
              T_c={T_c}
              T_min={T_min_scale}
              T_max={T_max_scale}
              I_load={actualI}
              showElectrons={showElectrons}
              position={[0, geom.y_teg, 0]}
              width={geom.tegW}
              length={geom.tegL}
              thickness={geom.t_teg}
              P_elec={actualP}
              Voc={results?.teg.Voc ?? 0}
              thermalView={thermalView}
            />

            {/* ── 4. Hot-Side Copper Spreader Plate ── */}
            <HotSideSpreader
              T={T_h}
              T_top={T_hot_block}
              T_min={T_min_scale}
              T_max={T_max_scale}
              coreRadius={geom.heaterW * 0.5}
              position={[0, geom.y_hot, 0]}
              width={geom.hotSpreaderW}
              length={geom.hotSpreaderL}
              thickness={geom.t_hot}
              thermalView={thermalView}
            />

            {/* ── 5. Industrial Heating Block ── */}
            <HeatSource
              T_source={store.T_source}
              T_ambient={T_min_scale}
              T_hot_block={T_hot_block}
              insulationEnabled={insulation.enabled}
              width={geom.heaterW}
              length={geom.heaterL}
              thickness={geom.t_heater}
              position={[0, geom.y_heater, 0]}
              thermalView={thermalView}
            />

            {/* ── 6. Thermal Insulation Jacket ── */}
            {insulation.enabled && (
              <ThermalInsulation
                enabled={insulation.enabled}
                material={insulation.material}
                thickness={insulation.thickness}
                T_outer={T_ins_outer}
                T_min={T_min_scale}
                T_max={T_max_scale}
                position={[0, (geom.y_hot + geom.y_heater) / 2, 0]}
                size={[geom.hotSpreaderW * 1.03, geom.t_hot + geom.t_heater, geom.hotSpreaderL * 1.03]}
                thermalView={thermalView}
              />
            )}

            {/* ── 7. Open-Shroud Axial Cooling Fan ── */}
            {isFanVisible && (
              <FanComponent
                enabled={isFanRunning}
                V_air={convection.V_air}
                size={geom.fanSize}
                depth={geom.fanDepth}
                mountHeight={geom.fanY}
                position={[geom.fanX, geom.fanY, 0]}
              />
            )}

            {/* ── 8. Airflow Visualization ── */}
            {showAirflow && convection.mode === 'natural' && (
              <NaturalConvectionParticles
                fin_H={geom.H_fin}
                fin_L={geom.hsLengthX}
                W_base={geom.hsWidthZ}
                T_c={T_c}
                T_ambient={store.T_ambient}
                position={[0, geom.y_fin_mid, 0]}
              />
            )}

            {showAirflow && isFanRunning && (
              <AirflowParticles
                mode={convection.mode}
                V_air={convection.V_air}
                N_fins={geom.finCount}
                fin_S={geom.S_fin}
                fin_t={geom.t_fin}
                fin_H={geom.H_fin}
                fin_L={geom.hsLengthX}
                W_base={geom.hsWidthZ}
                finType={geom.finType}
                fanX={geom.fanX}
                fanDepth={geom.fanDepth}
                fanSize={geom.fanSize}
                fanOffsetY={geom.fanY - geom.y_fin_mid}
                T_c={T_c}
                T_ambient={store.T_ambient}
                position={[0, geom.y_fin_mid, 0]}
              />
            )}

            {/* ── 9. Single Electrical Output Display & Non-Intersecting Wires ── */}
            <SingleElectricalDisplay
              tegPos={[0, geom.y_teg, 0]}
              tegWidth={geom.tegW}
              tegLength={geom.tegL}
              tegThickness={geom.t_teg}
              clearRightX={geom.mountWidthX * 0.5}
              yClearTop={geom.y_cold + geom.t_cold * 0.5}
              standPos={[geom.displayX, 0, geom.displayZ]}
              actualVoltage={actualV}
              current={actualI}
              power={actualP}
              ratedVoltage={ratedV}
              showElectrons={showElectrons}
            />

            {/* ── 10. Toggleable Engineering Callouts ── */}
            <EngineeringCallouts
              visible={showLabels}
              T_source={store.T_source}
              T_h={T_h}
              T_c={T_c}
              V_air={convection.V_air}
              fanEnabled={isFanVisible && convection.fanEnabled}
              finMaterial={fin.material}
              y_heater={geom.y_heater}
              y_hot={geom.y_hot}
              y_teg={geom.y_teg}
              y_cold={geom.y_cold}
              y_hs={geom.y_fin_mid}
              finLengthX={geom.hsLengthX}
              baseSpanZ={geom.hsWidthZ}
              fanX={geom.fanX}
              fanY={geom.fanY}
              displayX={geom.displayX}
              displayZ={geom.displayZ}
            />
          </group>
        </Suspense>
        </Canvas>
      </SceneErrorBoundary>
    </div>
  );
}
