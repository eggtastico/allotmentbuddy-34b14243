import { PlacedPlant } from '@/types/garden';
import { getPlantById } from '@/data/plants';

interface TasksViewProps {
  plants: PlacedPlant[];
}

export function TasksView({ plants }: TasksViewProps) {
  // Generate tasks from plants
  const tasks = plants
    .flatMap((plant) => {
      const plantData = getPlantById(plant.plantId);
      if (!plantData) return [];

      const plantedDate = new Date(plant.plantedAt);
      const harvestDate = plantData.daysToHarvest
        ? new Date(plantedDate.getTime() + plantData.daysToHarvest * 86400000)
        : null;

      return [
        {
          id: `water-${plant.id}`,
          title: `Water ${plantData.name}`,
          description: 'Keep soil consistently moist',
          priority: 'high',
          due: 'Today',
          icon: '💧',
        },
        harvestDate
          ? {
              id: `harvest-${plant.id}`,
              title: `Harvest ${plantData.name}`,
              description: `Ready around ${harvestDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}`,
              priority: 'medium',
              due: harvestDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
              icon: '🌾',
            }
          : null,
      ];
    })
    .filter(Boolean) as Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    due: string;
    icon: string;
  }>;

  const sortedTasks = tasks.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return (
      (priorityOrder[a.priority as keyof typeof priorityOrder] || 999) -
      (priorityOrder[b.priority as keyof typeof priorityOrder] || 999)
    );
  });

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen py-12 px-4 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          No Tasks
        </h2>
        <p className="text-muted-foreground">
          Plant something to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-semibold text-foreground sticky top-0 bg-background py-2 z-10">
        📋 Tasks
      </h2>

      {sortedTasks.map((task) => (
        <div
          key={task.id}
          className={`p-3 rounded-lg border-l-4 ${
            task.priority === 'high'
              ? 'bg-red-50 border-red-400'
              : task.priority === 'medium'
                ? 'bg-amber-50 border-amber-400'
                : 'bg-blue-50 border-blue-400'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl">{task.icon}</span>
            <div className="flex-1">
              <h3 className="font-medium text-foreground">{task.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {task.description}
              </p>
              <p className="text-xs font-medium text-muted-foreground mt-2">
                Due: {task.due}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
