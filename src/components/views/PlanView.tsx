import { PlacedPlant, Plant } from '@/types/garden';

interface ThisWeekData {
  harvestSoon: { plant: Plant; days: number }[];
  toSowNow: Plant[];
  currentMonth: number;
}

interface PlanViewProps {
  frostWarningPlants: PlacedPlant[];
  thisWeekData: ThisWeekData;
  setShowCalendar: (show: boolean) => void;
  setShowMonthlyPlanner: (show: boolean) => void;
  setShowRotation: (show: boolean) => void;
  setShowPlotMap: (show: boolean) => void;
  setShowRotationPlanner: (show: boolean) => void;
  setShowShoppingList: (show: boolean) => void;
}

export function PlanView({
  frostWarningPlants,
  thisWeekData,
  setShowCalendar,
  setShowMonthlyPlanner,
  setShowRotation,
  setShowPlotMap,
  setShowRotationPlanner,
  setShowShoppingList,
}: PlanViewProps) {
  return (
    <div className="p-4 space-y-3">
      <h2 className="text-2xl font-semibold text-foreground">📅 Plan</h2>

      {/* "This week" summary card */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          📋 This week
          <span className="text-xs font-normal text-muted-foreground ml-1">
            {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
          </span>
        </h3>

        {/* Frost warning */}
        {frostWarningPlants.length > 0 && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900">
            <span className="text-base leading-none mt-0.5">🌡️</span>
            <span><strong>Frost risk:</strong> protect {frostWarningPlants.length} frost-sensitive plant{frostWarningPlants.length !== 1 ? 's' : ''}.</span>
          </div>
        )}

        {/* Harvest soon */}
        {thisWeekData.harvestSoon.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Ready to harvest</p>
            <div className="space-y-1">
              {thisWeekData.harvestSoon.map(({ plant, days }, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span>{plant.emoji}</span>
                  <span className="font-medium text-foreground">{plant.name}</span>
                  <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    days <= 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {days <= 0 ? 'Ready now!' : `~${days}d`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* To sow this month */}
        {thisWeekData.toSowNow.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Sow in {new Date().toLocaleDateString('en-GB', { month: 'long' })}
            </p>
            <div className="flex flex-wrap gap-1">
              {thisWeekData.toSowNow.map(plant => (
                <span key={plant.id} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {plant.emoji} {plant.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {thisWeekData.harvestSoon.length === 0 && thisWeekData.toSowNow.length === 0 && frostWarningPlants.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Add some plants to your garden to see personalised tips here.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setShowCalendar(true)}
          className="p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm font-medium flex flex-col items-center gap-1"
        >
          <span className="text-lg">📅</span> Calendar
        </button>
        <button
          onClick={() => setShowMonthlyPlanner(true)}
          className="p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm font-medium flex flex-col items-center gap-1"
        >
          <span className="text-lg">📆</span> Monthly
        </button>
        <button
          onClick={() => setShowRotation(true)}
          className="p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm font-medium flex flex-col items-center gap-1"
        >
          <span className="text-lg">🔄</span> Rotation
        </button>
        <button
          onClick={() => setShowPlotMap(true)}
          className="p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm font-medium flex flex-col items-center gap-1"
        >
          <span className="text-lg">🗺️</span> Plot Map
        </button>
        <button
          onClick={() => setShowRotationPlanner(true)}
          className="p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm font-medium flex flex-col items-center gap-1"
        >
          <span className="text-lg">🔄</span> Planner
        </button>
        <button
          onClick={() => setShowShoppingList(true)}
          className="p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm font-medium flex flex-col items-center gap-1"
        >
          <span className="text-lg">🛒</span> Shopping
        </button>
      </div>
    </div>
  );
}
