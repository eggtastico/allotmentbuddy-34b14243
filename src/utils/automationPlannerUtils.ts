/**
 * Automation Planner Utilities
 * Generates sow/transplant/harvest task schedules based on selected crops and managed beds.
 */

import { Plant, PlacedStructure } from '@/types/garden';
import { plants as allPlants } from '@/data/plants';
import { GARDEN_ROTATION } from '@/utils/bedRotationUtils';

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Types ─────────────────────────────────────────────────────────────────────

export type AutomationTaskType = 'sow-indoors' | 'sow-outdoors' | 'transplant' | 'harvest';

export interface AutomationTask {
  id: string;
  plantId: string;
  plantName: string;
  plantEmoji: string;
  type: AutomationTaskType;
  title: string;
  description: string;
  dueDate: string; // YYYY-MM-DD
  completed: boolean;
  bedId?: string;
  bedName?: string;
  rotationGroup?: string;
}

export interface AutomationPlan {
  id: string;
  selectedCropIds: string[];
  managedBedIds: string[];
  tasks: AutomationTask[];
  generatedAt: string;
}

// ── Month parsing ─────────────────────────────────────────────────────────────

/** Parse "Feb-Apr" or "Mar" or "Oct-Nov,Jan" → array of 0-based month indices */
export function parseMonthRange(rangeStr: string | undefined): number[] {
  if (!rangeStr) return [];
  const months: number[] = [];
  const parts = rangeStr.split(',').map(s => s.trim());
  for (const part of parts) {
    const dash = part.indexOf('-');
    if (dash === -1) {
      const idx = MONTH_NAMES.indexOf(part.trim());
      if (idx >= 0) months.push(idx);
    } else {
      const start = part.slice(0, dash).trim();
      const end = part.slice(dash + 1).trim();
      const si = MONTH_NAMES.indexOf(start);
      const ei = MONTH_NAMES.indexOf(end);
      if (si < 0 || ei < 0) continue;
      if (si <= ei) {
        for (let m = si; m <= ei; m++) months.push(m);
      } else {
        // wraps year, e.g. Nov-Feb
        for (let m = si; m < 12; m++) months.push(m);
        for (let m = 0; m <= ei; m++) months.push(m);
      }
    }
  }
  return [...new Set(months)];
}

/**
 * Return the first month in the range that is >= fromMonth,
 * or wrap to next year's first month in the range.
 */
export function getNextOccurrence(rangeStr: string | undefined, fromMonth: number): number {
  const months = parseMonthRange(rangeStr);
  if (months.length === 0) return fromMonth;
  const future = months.find(m => m >= fromMonth);
  return future !== undefined ? future : months[0];
}

/** ISO date string (YYYY-MM-DD) for the 1st of targetMonth, advancing year if already past */
export function getTaskDate(targetMonth: number, fromDate: Date = new Date()): string {
  let year = fromDate.getFullYear();
  if (targetMonth < fromDate.getMonth()) year += 1;
  return `${year}-${String(targetMonth + 1).padStart(2, '0')}-01`;
}

/** Add `days` to a YYYY-MM-DD string and return a new YYYY-MM-DD string */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function makeId() {
  return `auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ── Rotation matching ─────────────────────────────────────────────────────────

/**
 * Map from plant rotationGroup → the slot number that this group CURRENTLY occupies.
 * Slot 1=legumes, 2=brassicas, 3=solanaceae, 4=alliums+roots.
 */
const PLANT_GROUP_TO_SLOT: Record<string, number> = {
  legumes:   1,
  brassicas: 2,
  solanaceae: 3,
  alliums:   4,
  roots:     4,
};

function getRotationLabel(rotationGroup: string): string {
  const entry = GARDEN_ROTATION.find(r => r.plantGroups.includes(rotationGroup));
  return entry ? `${entry.emoji} ${entry.label}` : rotationGroup;
}

function getBedName(bed: PlacedStructure, allManagedBeds: PlacedStructure[]): string {
  if (bed.name) return bed.name;
  const idx = allManagedBeds.indexOf(bed) + 1;
  return `Bed ${idx}`;
}

function findBestBed(plant: Plant, managedBeds: PlacedStructure[]): PlacedStructure | undefined {
  if (managedBeds.length === 0) return undefined;
  const preferredSlot = plant.rotationGroup ? PLANT_GROUP_TO_SLOT[plant.rotationGroup] : undefined;
  if (preferredSlot != null) {
    const match = managedBeds.find(b => b.rotationSlot === preferredSlot);
    if (match) return match;
  }
  // No slot preference or no match — first unassigned bed, then any
  return managedBeds.find(b => b.rotationSlot == null) ?? managedBeds[0];
}

// ── Task generation ───────────────────────────────────────────────────────────

export function generateAutomationTasks(
  selectedCropIds: string[],
  managedBeds: PlacedStructure[],
  fromDate: Date = new Date(),
): AutomationTask[] {
  const tasks: AutomationTask[] = [];
  const currentMonth = fromDate.getMonth();

  for (const cropId of selectedCropIds) {
    const plant = allPlants.find(p => p.id === cropId);
    if (!plant) continue;

    const bestBed = findBestBed(plant, managedBeds);
    const bedName = bestBed ? getBedName(bestBed, managedBeds) : undefined;
    const bedSuffix = bedName ? ` in ${bedName}` : '';

    let primarySowDate: string | null = null;

    // Sow indoors
    if (plant.sowIndoors) {
      const sowMonth = getNextOccurrence(plant.sowIndoors, currentMonth);
      const sowDate = getTaskDate(sowMonth, fromDate);
      primarySowDate = sowDate;
      tasks.push({
        id: makeId(),
        plantId: plant.id,
        plantName: plant.name,
        plantEmoji: plant.emoji,
        type: 'sow-indoors',
        title: `Sow ${plant.name} indoors`,
        description: `Start ${plant.emoji} ${plant.name} in trays or modules indoors. Keep at 15–20°C until germination. Thin to one per cell.`,
        dueDate: sowDate,
        completed: false,
        bedId: bestBed?.id,
        bedName,
        rotationGroup: plant.rotationGroup,
      });

      // Transplant ~6 weeks later
      const transplantDate = addDays(sowDate, 42);
      tasks.push({
        id: makeId(),
        plantId: plant.id,
        plantName: plant.name,
        plantEmoji: plant.emoji,
        type: 'transplant',
        title: `Transplant ${plant.name} outdoors`,
        description: `Harden off ${plant.emoji} ${plant.name} seedlings over 1–2 weeks, then transplant${bedSuffix} at ${plant.spacingCm}cm spacing.`,
        dueDate: transplantDate,
        completed: false,
        bedId: bestBed?.id,
        bedName,
        rotationGroup: plant.rotationGroup,
      });
    }

    // Sow outdoors (only when no indoor start, or it's separately defined)
    if (plant.sowOutdoors && !plant.sowIndoors) {
      const sowMonth = getNextOccurrence(plant.sowOutdoors, currentMonth);
      const sowDate = getTaskDate(sowMonth, fromDate);
      primarySowDate = sowDate;
      tasks.push({
        id: makeId(),
        plantId: plant.id,
        plantName: plant.name,
        plantEmoji: plant.emoji,
        type: 'sow-outdoors',
        title: `Sow ${plant.name} outdoors`,
        description: `Direct sow ${plant.emoji} ${plant.name}${bedSuffix} in drills at ${plant.spacingCm}cm spacing. Water in well.`,
        dueDate: sowDate,
        completed: false,
        bedId: bestBed?.id,
        bedName,
        rotationGroup: plant.rotationGroup,
      });
    }

    // Harvest task
    if (plant.daysToHarvest) {
      let harvestDate: string;
      if (primarySowDate) {
        harvestDate = addDays(primarySowDate, plant.daysToHarvest);
      } else if (plant.harvest) {
        const hMonth = getNextOccurrence(plant.harvest, currentMonth);
        harvestDate = getTaskDate(hMonth, fromDate);
      } else {
        continue; // no harvest timing — skip
      }

      const rotLabel = plant.rotationGroup ? ` (${getRotationLabel(plant.rotationGroup)})` : '';
      tasks.push({
        id: makeId(),
        plantId: plant.id,
        plantName: plant.name,
        plantEmoji: plant.emoji,
        type: 'harvest',
        title: `Harvest ${plant.name}`,
        description: `${plant.emoji} ${plant.name}${rotLabel} should be ready to harvest. Check daily from this date${bedSuffix}.`,
        dueDate: harvestDate,
        completed: false,
        bedId: bestBed?.id,
        bedName,
        rotationGroup: plant.rotationGroup,
      });
    }
  }

  return tasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

// ── localStorage helpers ──────────────────────────────────────────────────────

// ── localStorage helpers — supports multiple plans ────────────────────────────

export const AUTOMATION_PLANS_KEY = 'allotment-automation-plans-v2';

export function loadAutomationPlans(): AutomationPlan[] {
  try {
    const raw = localStorage.getItem(AUTOMATION_PLANS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Support old single-plan format
    if (parsed && !Array.isArray(parsed) && parsed.id) return [parsed as AutomationPlan];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveAutomationPlans(plans: AutomationPlan[]): void {
  localStorage.setItem(AUTOMATION_PLANS_KEY, JSON.stringify(plans));
}
