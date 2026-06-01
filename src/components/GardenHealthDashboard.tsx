import { PlacedPlant, PlacedStructure } from '@/types/garden';
import { getPlantById } from '@/data/plants';
import { getStructureById } from '@/data/structures';

interface GardenHealthDashboardProps {
  plants: PlacedPlant[];
  structures: PlacedStructure[];
  automationTasks?: { completed: boolean }[];
}

function isWithinBed(plant: PlacedPlant, bed: PlacedStructure): boolean {
  return (
    plant.x >= bed.x &&
    plant.x < bed.x + bed.widthCells &&
    plant.y >= bed.y &&
    plant.y < bed.y + bed.heightCells
  );
}

function getDistance(a: PlacedPlant, b: PlacedPlant): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function computeCompanionScore(plants: PlacedPlant[]): number {
  if (plants.length === 0) return 0;

  let withCompanion = 0;

  for (const placed of plants) {
    const plantData = getPlantById(placed.plantId);
    if (!plantData || plantData.companions.length === 0) continue;

    const hasCompanionNearby = plants.some((other) => {
      if (other.id === placed.id) return false;
      if (getDistance(placed, other) > 3) return false;
      return plantData.companions.includes(other.plantId);
    });

    if (hasCompanionNearby) withCompanion++;
  }

  const plantsWithCompanionData = plants.filter((p) => {
    const data = getPlantById(p.plantId);
    return data && data.companions.length > 0;
  });

  if (plantsWithCompanionData.length === 0) return 100;
  return Math.round((withCompanion / plantsWithCompanionData.length) * 100);
}

function computeSpacingWarnings(plants: PlacedPlant[], cellSizeCm: number): number {
  let warnings = 0;

  for (let i = 0; i < plants.length; i++) {
    const plantData = getPlantById(plants[i].plantId);
    if (!plantData) continue;

    const spacingCells = plantData.spacingCm / cellSizeCm;

    for (let j = i + 1; j < plants.length; j++) {
      if (plants[j].plantId !== plants[i].plantId) continue;
      if (getDistance(plants[i], plants[j]) < spacingCells) {
        warnings++;
        break;
      }
    }
  }

  return warnings;
}

export function GardenHealthDashboard({
  plants,
  structures,
  automationTasks,
}: GardenHealthDashboardProps) {
  // Beds planted
  const beds = structures.filter((s) => {
    const def = getStructureById(s.structureId);
    return def?.showCells;
  });
  const bedsWithPlants = beds.filter((bed) =>
    plants.some((p) => isWithinBed(p, bed))
  );
  const bedsPlanted = bedsWithPlants.length;
  const totalBeds = beds.length;
  const bedPercent = totalBeds > 0 ? Math.round((bedsPlanted / totalBeds) * 100) : 0;

  // Plant count
  const plantCount = plants.length;

  // Companion score
  const companionScore = computeCompanionScore(plants);

  // Spacing warnings (assume 30cm cells as default)
  const spacingWarnings = computeSpacingWarnings(plants, 30);

  // Tasks pending
  const tasksPending = automationTasks
    ? automationTasks.filter((t) => !t.completed).length
    : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-card border">
      {/* Beds planted */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm">🏡</span>
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-medium text-foreground">
            {bedsPlanted}/{totalBeds} beds
          </span>
          <div className="h-1 w-12 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${bedPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Plant count */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm">🌱</span>
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-medium text-foreground">{plantCount}</span>
          <span className="text-[10px] text-muted-foreground">plants</span>
        </div>
      </div>

      {/* Companion score */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm">🤝</span>
        <div className="flex flex-col leading-tight">
          <span
            className={`text-xs font-medium ${
              companionScore >= 70
                ? 'text-green-600'
                : companionScore >= 40
                ? 'text-amber-600'
                : 'text-foreground'
            }`}
          >
            {companionScore}%
          </span>
          <span className="text-[10px] text-muted-foreground">companions</span>
        </div>
      </div>

      {/* Spacing warnings */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm">⚠️</span>
        <div className="flex flex-col leading-tight">
          <span
            className={`text-xs font-medium ${
              spacingWarnings === 0 ? 'text-green-600' : 'text-amber-600'
            }`}
          >
            {spacingWarnings}
          </span>
          <span className="text-[10px] text-muted-foreground">spacing</span>
        </div>
      </div>

      {/* Tasks pending */}
      {tasksPending !== undefined && (
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm">📋</span>
          <div className="flex flex-col leading-tight">
            <span
              className={`text-xs font-medium ${
                tasksPending === 0 ? 'text-green-600' : 'text-foreground'
              }`}
            >
              {tasksPending}
            </span>
            <span className="text-[10px] text-muted-foreground">tasks</span>
          </div>
        </div>
      )}
    </div>
  );
}
