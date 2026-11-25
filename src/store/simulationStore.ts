import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  SimulationState,
  SimulationResults,
  FinGeometry,
  TEGModule,
  ConvectionConditions,
  InsulationConfig,
  SavedCase,
} from '../physics/types';

// Re-export SavedCase for consumers
export type { SavedCase };

// ─── Default simulation state ────────────────────────────────────────────────

export const defaultFin: FinGeometry = {
  type: 'plate',
  N: 12,
  L: 0.080,
  H: 0.036,
  t: 0.002,
  S: 0.005,
  W_base: 0.080,
  L_base: 0.080,
  t_base: 0.005,
  material: 'aluminum',
};

export const defaultTEG: TEGModule = {
  N_couples: 71,
  alpha: 0.0005, // 500 µV/K per couple (BiTe)
  R_int: 2.0,
  K_teg: 0.6,
  R_teg: 1.667,
  R_contact_h: 0.002,
  R_contact_c: 0.002,
  A_module: 0.0016,
};

export const defaultConvection: ConvectionConditions = {
  mode: 'forced',
  fanEnabled: true,
  V_air: 8.0,
  T_inf: 25,
  fanEfficiency: 0.6,
};

export const defaultInsulation: InsulationConfig = {
  enabled: false,
  material: 'glasswool',
  thickness: 0.02,
  area: 0.0061,
  autoArea: true,
  location: 'heat_source_sides',
};

export const defaultSimState: SimulationState = {
  T_source: 150,
  T_ambient: 25,
  q_source: 500,
  emissivity_source: 0.85,
  teg: defaultTEG,
  R_load: 2.0,
  fin: defaultFin,
  convection: defaultConvection,
  insulation: defaultInsulation,
  t_spreader_h: 0.003,
  t_spreader_c: 0.003,
  k_spreader: 385,
};

// ─── Store slice types ───────────────────────────────────────────────────────

export type PageName =
  | 'dashboard'
  | 'setup3d'
  | 'findesign'
  | 'cooling'
  | 'insulation'
  | 'tegperformance'
  | 'graphs'
  | 'optimization'
  | 'report';

export interface UIState {
  activePage: PageName;
  viewMode3D: 'perspective' | 'orthographic';
  wireframe: boolean;
  autoRotate: boolean;
  explodeView: boolean;
  showLabels: boolean;
  showAirflow: boolean;
  showElectrons: boolean;
  comparisonMode: boolean;
}

export interface StoreState extends SimulationState, UIState {
  simulationResults: SimulationResults | null;
  isCalculating: boolean;
  savedCases: SavedCase[];

  // Sim state actions
  updateFin: (patch: Partial<FinGeometry>) => void;
  updateTEG: (patch: Partial<TEGModule>) => void;
  updateConvection: (patch: Partial<ConvectionConditions>) => void;
  updateInsulation: (patch: Partial<InsulationConfig>) => void;
  setT_source: (v: number) => void;
  setT_ambient: (v: number) => void;
  setQ_source: (v: number) => void;
  setR_load: (v: number) => void;
  setSpreaeder: (patch: { t_spreader_h?: number; t_spreader_c?: number; k_spreader?: number }) => void;

  // UI actions
  setActivePage: (p: PageName) => void;
  setViewMode3D: (m: 'perspective' | 'orthographic') => void;
  setWireframe: (v: boolean) => void;
  setAutoRotate: (v: boolean) => void;
  setExplodeView: (v: boolean) => void;
  setShowLabels: (v: boolean) => void;
  setShowAirflow: (v: boolean) => void;
  setShowElectrons: (v: boolean) => void;
  toggleFan: () => void;

  // Results
  setSimulationResults: (r: SimulationResults | null) => void;
  setIsCalculating: (v: boolean) => void;

  // Cases
  saveCase: (name: string) => void;
  loadCase: (id: string) => void;
  deleteCase: (id: string) => void;

  // Misc
  setComparisonMode: (v: boolean) => void;
  resetToDefaults: () => void;
  compareDesigns: () => void;
}

// ─── Store implementation ─────────────────────────────────────────────────────

export const useSimulationStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // Sim state
      ...defaultSimState,

      // UI state defaults
      activePage: 'setup3d',
      viewMode3D: 'perspective',
      wireframe: false,
      autoRotate: false,
      explodeView: false,
      showLabels: false,
      showAirflow: true,
      showElectrons: true,
      comparisonMode: false,
      simulationResults: null,
      isCalculating: false,
      savedCases: [],

      // ── Sim state actions ──────────────────────────────────────────────────
      updateFin: (patch) =>
        set((s) => ({ fin: { ...s.fin, ...patch } })),

      updateTEG: (patch) =>
        set((s) => ({ teg: { ...s.teg, ...patch } })),

      updateConvection: (patch) =>
        set((s) => ({
          convection: { ...s.convection, ...patch },
        })),

      updateInsulation: (patch) =>
        set((s) => ({ insulation: { ...s.insulation, ...patch } })),

      setT_source: (v) => set({ T_source: v }),
      setT_ambient: (v) => set({ T_ambient: v }),
      setQ_source: (v) => set({ q_source: v }),
      setR_load: (v) => set({ R_load: v }),

      setSpreaeder: (patch) =>
        set((s) => ({
          t_spreader_h: patch.t_spreader_h ?? s.t_spreader_h,
          t_spreader_c: patch.t_spreader_c ?? s.t_spreader_c,
          k_spreader: patch.k_spreader ?? s.k_spreader,
        })),

      toggleFan: () =>
        set((s) => ({
          convection: {
            ...s.convection,
            fanEnabled: !s.convection.fanEnabled,
            mode: !s.convection.fanEnabled ? 'forced' : 'natural',
            V_air: !s.convection.fanEnabled ? (s.convection.V_air || 2.0) : 0,
          },
        })),

      // ── UI actions ─────────────────────────────────────────────────────────
      setActivePage: (p) => set({ activePage: p }),
      setViewMode3D: (m) => set({ viewMode3D: m }),
      setWireframe: (v) => set({ wireframe: v }),
      setAutoRotate: (v) => set({ autoRotate: v }),
      setExplodeView: (v) => set({ explodeView: v }),
      setShowLabels: (v) => set({ showLabels: v }),
      setShowAirflow: (v) => set({ showAirflow: v }),
      setShowElectrons: (v) => set({ showElectrons: v }),
      setComparisonMode: (v) => set({ comparisonMode: v }),

      // ── Results ────────────────────────────────────────────────────────────
      setSimulationResults: (r) => set({ simulationResults: r }),
      setIsCalculating: (v) => set({ isCalculating: v }),

      // ── Cases ──────────────────────────────────────────────────────────────
      saveCase: (name) => {
        const s = get();
        const newCase: SavedCase = {
          id: `case-${Date.now()}`,
          name,
          timestamp: Date.now(),
          state: {
            T_source: s.T_source,
            T_ambient: s.T_ambient,
            q_source: s.q_source,
            emissivity_source: s.emissivity_source,
            teg: s.teg,
            R_load: s.R_load,
            fin: s.fin,
            convection: s.convection,
            insulation: s.insulation,
            t_spreader_h: s.t_spreader_h,
            t_spreader_c: s.t_spreader_c,
            k_spreader: s.k_spreader,
          },
          results: s.simulationResults,
        };
        set((st) => ({ savedCases: [...st.savedCases, newCase] }));
      },

      loadCase: (id) => {
        const c = get().savedCases.find((x) => x.id === id);
        if (!c) return;
        set({
          ...c.state,
          simulationResults: c.results,
        });
      },

      deleteCase: (id) =>
        set((s) => ({ savedCases: s.savedCases.filter((c) => c.id !== id) })),

      // ── Misc ───────────────────────────────────────────────────────────────
      resetToDefaults: () =>
        set((s) => ({
          ...defaultSimState,
          activePage: s.activePage,
          explodeView: false,
          wireframe: false,
          autoRotate: false,
          showLabels: false,
          showAirflow: true,
          showElectrons: true,
          simulationResults: null,
        })),

      compareDesigns: () => {
        // Trigger comparison mode — pages can listen and trigger computations
        set({ comparisonMode: true });
      },
    }),
    {
      name: 'teg-simulation-store',
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (!persistedState || version < 2) {
          return {
            ...(persistedState ?? {}),
            fin: defaultFin,
            insulation: {
              ...defaultInsulation,
              enabled: persistedState?.insulation?.enabled ?? false,
            },
          };
        }
        return persistedState;
      },
      partialize: (s) => ({
        savedCases: s.savedCases,
        // Persist last-used parameters
        T_source: s.T_source,
        T_ambient: s.T_ambient,
        q_source: s.q_source,
        fin: s.fin,
        teg: s.teg,
        convection: s.convection,
        insulation: s.insulation,
        R_load: s.R_load,
        k_spreader: s.k_spreader,
        t_spreader_h: s.t_spreader_h,
        t_spreader_c: s.t_spreader_c,
      }),
    }
  )
);

// Convenience selector for the full simulation input state
export const selectSimState = (s: StoreState): SimulationState => ({
  T_source: s.T_source,
  T_ambient: s.T_ambient,
  q_source: s.q_source,
  emissivity_source: s.emissivity_source,
  teg: s.teg,
  R_load: s.R_load,
  fin: s.fin,
  convection: s.convection,
  insulation: s.insulation,
  t_spreader_h: s.t_spreader_h,
  t_spreader_c: s.t_spreader_c,
  k_spreader: s.k_spreader,
});
