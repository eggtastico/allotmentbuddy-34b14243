import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { type NavSection } from '@/components/AppShell';
import { PlacedPlant } from '@/types/garden';
import { FrostDates } from '@/utils/frostDateCalculator';
import { AutomationTask } from '@/utils/automationPlannerUtils';

const GardenTasks = React.lazy(() => import('@/components/GardenTasks').then(m => ({ default: m.GardenTasks })));

interface TasksViewProps {
  placedPlants: PlacedPlant[];
  setActiveNav: (section: NavSection) => void;
  frostDates: FrostDates | null;
  automationTasks: AutomationTask[];
  toggleAutomationTask: (taskId: string) => void;
}

export function TasksView({
  placedPlants,
  setActiveNav,
  frostDates,
  automationTasks,
  toggleAutomationTask,
}: TasksViewProps) {
  return (
    <div className="flex-1 overflow-y-auto pb-4">
      <Suspense fallback={<div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />Loading tasks…</div>}>
        <GardenTasks placedPlants={placedPlants} onClose={() => setActiveNav('garden')} inline={true} frostDates={frostDates ? { lastSpringFrost: frostDates.lastFrostDate.toLocaleDateString(), firstFallFrost: frostDates.firstFrostDate.toLocaleDateString() } : null} automationTasks={automationTasks} onToggleAutomationTask={toggleAutomationTask} />
      </Suspense>
    </div>
  );
}
