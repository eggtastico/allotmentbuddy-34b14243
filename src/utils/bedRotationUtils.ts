/**
 * Crop Rotation Utility
 * Implements a traditional 4-crop, 4-year rotation:
 *   Legumes → Brassicas → Potatoes → Onions & Roots → (repeat)
 */

import { PlacedStructure, PlacedPlant, RotationYearEntry } from '@/types/garden';
import { getPlantById } from '@/data/plants';

// ─── The canonical 4-year rotation ──────────────────────────────────────────

export interface RotationEntry {
  key: string;
  label: string;
  emoji: string;
  /** Which plant rotationGroup values belong to this cycle position */
  plantGroups: string[];
  description: string;
  /** Why the NEXT group follows this one */
  nextBenefit: string;
  color: string; // Tailwind classes for badge
}

export const GARDEN_ROTATION: RotationEntry[] = [
  {
    key: 'legumes',
    label: 'Legumes',
    emoji: '🫘',
    plantGroups: ['legumes'],
    description: 'Peas, beans, clover',
    nextBenefit: 'Fixes nitrogen — brassicas thrive after',
    color: 'bg-green-100 text-green-900 border-green-200',
  },
  {
    key: 'brassicas',
    label: 'Brassicas',
    emoji: '🥦',
    plantGroups: ['brassicas'],
    description: 'Cabbage, kale, broccoli, Brussels sprouts',
    nextBenefit: 'Uses nitrogen — potatoes loosen the soil next',
    color: 'bg-purple-100 text-purple-900 border-purple-200',
  },
  {
    key: 'potatoes',
    label: 'Potatoes',
    emoji: '🥔',
    plantGroups: ['solanaceae'],
    description: 'Potatoes, tomatoes, peppers',
    nextBenefit: 'Deep roots loosen soil for roots & onions',
    color: 'bg-red-100 text-red-900 border-red-200',
  },
  {
    key: 'onions-roots',
    label: 'Onions & Roots',
    emoji: '🧅',
    plantGroups: ['alliums', 'roots'],
    description: 'Onions, garlic, carrots, beetroot, parsnip',
    nextBenefit: 'Cleans soil — ready for legumes again',
    color: 'bg-yellow-100 text-yellow-900 border-yellow-200',
  },
];

/** Ordered list of cycle keys */
export const CYCLE_KEYS = GARDEN_ROTATION.map(r => r.key);

/** Map from plant rotationGroup → cycle key */
const PLANT_GROUP_TO_CYCLE: Record<string, string> = {};
for (const entry of GARDEN_ROTATION) {
  for (const pg of entry.plantGroups) {
    PLANT_GROUP_TO_CYCLE[pg] = entry.key;
  }
}

/** Lookup a RotationEntry by its key */
export function getRotationEntry(key: string): RotationEntry | undefined {
  return GARDEN_ROTATION.find(r => r.key === key);
}

/** Cycle key for a given 1-based slot number */
export function slotGroupName(slot: number): string {
  return CYCLE_KEYS[((slot - 1) % 4 + 4) % 4];
}

/** Human-readable label for any group key (cycle or raw plant group) */
export const ROTATION_GROUP_LABELS: Record<string, string> = {
  legumes: 'Legumes',
  brassicas: 'Brassicas',
  potatoes: 'Potatoes',
  'onions-roots': 'Onions & Roots',
  // raw plant groups (fallback)
  roots: 'Roots',
  alliums: 'Alliums',
  solanaceae: 'Solanaceae',
  cucurbits: 'Cucurbits',
  leafy: 'Leafy',
  other: 'Other',
};

// ─── Plant / bed helpers ─────────────────────────────────────────────────────

/**
 * Get all plants placed within a specific bed (AABB containment).
 */
export function getPlantsInBed(bed: PlacedStructure, plants: PlacedPlant[]): PlacedPlant[] {
  return plants.filter(p => {
    const pw = p.areaW ?? 1;
    const ph = p.areaH ?? 1;
    return (
      p.x >= bed.x &&
      p.x + pw <= bed.x + bed.widthCells &&
      p.y >= bed.y &&
      p.y + ph <= bed.y + bed.heightCells
    );
  });
}

/**
 * Determine the dominant rotation CYCLE KEY for plants in a bed.
 * Returns one of CYCLE_KEYS, or null if none match.
 */
export function getDominantRotationGroup(plants: PlacedPlant[]): string | null {
  const counts = new Map<string, number>();

  for (const p of plants) {
    const data = getPlantById(p.plantId);
    if (!data) continue;
    const cycleKey = PLANT_GROUP_TO_CYCLE[data.rotationGroup];
    if (!cycleKey) continue; // cucurbits, leafy, other — not in main 4-year cycle
    counts.set(cycleKey, (counts.get(cycleKey) ?? 0) + 1);
  }

  if (counts.size === 0) return null;

  // Pick highest count; break ties by cycle order
  let dominant: string | null = null;
  let maxCount = 0;
  for (const key of CYCLE_KEYS) {
    const c = counts.get(key) ?? 0;
    if (c > maxCount) { maxCount = c; dominant = key; }
  }
  return dominant;
}

// ─── Rotation table ──────────────────────────────────────────────────────────

export interface RotationTableRow {
  year: number;
  group: string | null;   // cycle key, or null if unknown
  source: 'history' | 'current' | 'forecast';
}

/**
 * Build a 7-row table (3 years before → current → 3 years ahead).
 *
 * Priority per year:
 *  1. Manual rotationHistory entry (explicit override, shown as 'history')
 *  2. rotationSlot plan (auto-computed from the 4-year cycle)
 *  3. currentGroup inference (when no slot is set)
 */
export function buildRotationTable(
  history: RotationYearEntry[] | undefined,
  currentYear: number,
  currentGroup: string | null,
  rotationSlot?: number,
): RotationTableRow[] {
  const historyMap = new Map((history ?? []).map(e => [e.year, e.group]));
  const rows: RotationTableRow[] = [];

  for (let year = currentYear - 3; year <= currentYear + 3; year++) {
    const isCurrent = year === currentYear;

    // 1. Manual history wins
    if (historyMap.has(year)) {
      rows.push({ year, group: historyMap.get(year) ?? null, source: isCurrent ? 'current' : 'history' });
      continue;
    }

    // 2. Slot-based plan fills all years automatically
    if (rotationSlot != null && rotationSlot >= 1 && rotationSlot <= 4) {
      const offset = year - currentYear;
      const pos = ((rotationSlot - 1 + offset) % 4 + 4) % 4;
      rows.push({ year, group: CYCLE_KEYS[pos], source: isCurrent ? 'current' : 'forecast' });
      continue;
    }

    // 3. Legacy: infer from current planted group
    if (isCurrent) {
      rows.push({ year, group: currentGroup, source: 'current' });
    } else if (year > currentYear && currentGroup && CYCLE_KEYS.includes(currentGroup)) {
      const idx = CYCLE_KEYS.indexOf(currentGroup);
      const fi = (idx + (year - currentYear)) % 4;
      rows.push({ year, group: CYCLE_KEYS[fi], source: 'forecast' });
    } else {
      rows.push({ year, group: null, source: 'forecast' });
    }
  }

  return rows;
}

// ─── Warnings & suggestions ──────────────────────────────────────────────────

export function getRotationWarnings(
  history: RotationYearEntry[] | undefined,
  currentYear: number,
  currentGroup: string | null,
): string[] {
  if (!currentGroup || !history || history.length === 0) return [];
  const warnings: string[] = [];
  const historyMap = new Map(history.map(e => [e.year, e.group]));

  if (historyMap.get(currentYear - 1) === currentGroup) {
    warnings.push('Same group as last year — move to a different bed');
  }
  for (let y = currentYear - 3; y < currentYear; y++) {
    if (historyMap.get(y) === currentGroup) {
      const ago = currentYear - y;
      warnings.push(`This group was here ${ago} year${ago > 1 ? 's' : ''} ago — ideally wait 4 years`);
      break;
    }
  }
  return warnings;
}

export function getNextGroupSuggestion(
  currentGroup: string | null,
): { group: string; reason: string } | null {
  if (!currentGroup) return null;
  const idx = CYCLE_KEYS.indexOf(currentGroup);
  if (idx === -1) return null;
  const nextKey = CYCLE_KEYS[(idx + 1) % 4];
  const current = GARDEN_ROTATION[idx];
  const next = GARDEN_ROTATION[(idx + 1) % 4];
  return { group: nextKey, reason: current.nextBenefit || `Next: ${next.label}` };
}

export function getBedDisplayName(bed: PlacedStructure, allBeds: PlacedStructure[]): string {
  const baseName = bed.name ?? `Bed ${allBeds.findIndex(b => b.id === bed.id) + 1}`;
  if (bed.rotationSlot != null) {
    const entry = GARDEN_ROTATION[bed.rotationSlot - 1];
    return `${entry.emoji} ${entry.label} · ${baseName}`;
  }
  return baseName;
}

export function getRotationStatus(warnings: string[]): 'good' | 'warning' {
  return warnings.length > 0 ? 'warning' : 'good';
}
