import { useState, useCallback, useEffect, useRef } from 'react';
import { PlacedPlant, PlotSettings, PlacedStructure, PlantStage } from '@/types/garden';
import { GardenPlanRow, type LocationData } from '@/lib/schemas';
import { getLocalGardens } from '@/lib/db';
import { logError } from '@/utils/errorUtils';
import { toast } from 'sonner';

// Re-export LocationData so existing imports from this module still work
export type { LocationData } from '@/lib/schemas';

export interface GardenStateReturn {
  /* ── Core state ─────────────────────────────────────── */
  settings: PlotSettings;
  setSettings: React.Dispatch<React.SetStateAction<PlotSettings>>;
  placedPlants: PlacedPlant[];
  setPlacedPlants: React.Dispatch<React.SetStateAction<PlacedPlant[]>>;
  selectedPlant: PlacedPlant | null;
  setSelectedPlant: React.Dispatch<React.SetStateAction<PlacedPlant | null>>;
  selectedBed: PlacedStructure | null;
  setSelectedBed: React.Dispatch<React.SetStateAction<PlacedStructure | null>>;
  placedStructures: PlacedStructure[];
  setPlacedStructures: React.Dispatch<React.SetStateAction<PlacedStructure[]>>;
  currentPlanId: string | null;
  setCurrentPlanId: React.Dispatch<React.SetStateAction<string | null>>;
  planName: string;
  setPlanName: React.Dispatch<React.SetStateAction<string>>;
  location: LocationData | null;
  setLocation: React.Dispatch<React.SetStateAction<LocationData | null>>;
  defaultStage: PlantStage;
  setDefaultStage: React.Dispatch<React.SetStateAction<PlantStage>>;

  /* ── Actions ────────────────────────────────────────── */
  /** Apply a full plan (from Supabase or IndexedDB) to state. */
  applyPlan: (plan: GardenPlanRow) => void;
  /** Reset to blank canvas. */
  handleNewPlan: () => void;
}

/** Subset of GardenStateReturn exposing read-only state values (used by hooks like usePlantPlacement). */
export type GardenState = Pick<
  GardenStateReturn,
  'settings' | 'placedPlants' | 'placedStructures' | 'selectedPlant' | 'defaultStage'
>;

/** Subset of GardenStateReturn exposing setter actions (used by hooks like usePlantPlacement). */
export type GardenActions = Pick<
  GardenStateReturn,
  'setPlacedPlants' | 'setSelectedPlant' | 'setPlacedStructures'
>;

export interface UseGardenStateOptions {
  /** The authenticated user (or null). Used for auto-load. */
  user: { id: string } | null;
  /** Available remote plans (from useGardenPlans). */
  plans: GardenPlanRow[];
}

export function useGardenState({ user, plans }: UseGardenStateOptions): GardenStateReturn {
  const [settings, setSettings] = useState<PlotSettings>({
    widthM: 6, heightM: 4, unit: 'meters', cellSizePx: 32, cellSizeCm: 20, southDirection: 180, snapToGrid: true,
  });
  const [placedPlants, setPlacedPlants] = useState<PlacedPlant[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<PlacedPlant | null>(null);
  const [selectedBed, setSelectedBed] = useState<PlacedStructure | null>(null);
  const [placedStructures, setPlacedStructures] = useState<PlacedStructure[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState('My Garden');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [defaultStage, setDefaultStage] = useState<PlantStage>('seed');

  // ── Auto-load most recent plan ──────────────────────
  const autoLoaded = useRef(false);
  const prevUserRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // Reset the guard when the user identity changes (login, logout, switch account)
    if (prevUserRef.current !== undefined && prevUserRef.current !== (user?.id ?? null)) {
      autoLoaded.current = false;
    }
    prevUserRef.current = user?.id ?? null;

    if (autoLoaded.current) return;

    if (user && plans.length > 0) {
      // Load from Supabase
      autoLoaded.current = true;
      const latest = plans[0]; // already sorted by updated_at desc
      setCurrentPlanId(latest.id);
      setPlanName(latest.name);
      setSettings(latest.plot_settings);
      // Plans are already validated and transformed by GardenPlansResponseSchema
      setPlacedPlants(latest.plants || []);
      setPlacedStructures(latest.beds || []);
    } else if (!user || (plans.length === 0 && user)) {
      // Load from IndexedDB for offline support or if no remote plans
      getLocalGardens()
        .then((localPlans) => {
          if (localPlans.length > 0) {
            autoLoaded.current = true;
            const latest = localPlans[localPlans.length - 1]; // Most recently saved
            setCurrentPlanId(latest.id);
            setPlanName(latest.name);
            setSettings(latest.settings);
            setPlacedPlants(latest.plants || []);
            setPlacedStructures(latest.beds || []);
          }
        })
        .catch((err) => {
          logError(err, 'Failed to load garden plans from IndexedDB');
        });
    }
  }, [user, plans]);

  // ── Apply a full plan from load / conflict resolution ──
  const applyPlan = useCallback((plan: GardenPlanRow) => {
    setCurrentPlanId(plan.id);
    setPlanName(plan.name);
    setSettings(plan.plot_settings as PlotSettings);
    setPlacedPlants(((plan.plants as PlacedPlant[]) || []).map(p => ({
      ...p,
      plantedAt: p.plantedAt || new Date().toISOString(),
      stage: p.stage || 'seed' as PlantStage,
    })));
    setPlacedStructures(((plan.beds as PlacedStructure[]) || []).map((s: PlacedStructure) => {
      // Legacy plans stored structures with type/width/height instead of the current field names.
      const legacy = s as Partial<{ type: string; width: number; height: number }>;
      return {
      id: s.id || `struct-${Date.now()}`,
      structureId: s.structureId || legacy.type || 'raised-bed',
      x: s.x ?? 0,
      y: s.y ?? 0,
      widthCells: s.widthCells ?? legacy.width ?? 4,
      heightCells: s.heightCells ?? legacy.height ?? 2,
      name: s.name,
      rotationHistory: s.rotationHistory,
      };
    }));
    setSelectedPlant(null);
    setSelectedBed(null);
    toast.success(`Loaded "${plan.name}" 🌿`);
  }, []);

  // ── New blank plan ──────────────────────────────────
  const handleNewPlan = useCallback(() => {
    setCurrentPlanId(null);
    setPlanName('My Garden');
    setSettings({ widthM: 6, heightM: 4, unit: 'meters', cellSizePx: 32, cellSizeCm: 20, southDirection: 180 });
    setPlacedPlants([]);
    setPlacedStructures([]);
    setSelectedPlant(null);
    setSelectedBed(null);
  }, []);

  return {
    settings, setSettings,
    placedPlants, setPlacedPlants,
    selectedPlant, setSelectedPlant,
    selectedBed, setSelectedBed,
    placedStructures, setPlacedStructures,
    currentPlanId, setCurrentPlanId,
    planName, setPlanName,
    location, setLocation,
    defaultStage, setDefaultStage,
    applyPlan,
    handleNewPlan,
  };
}
