import { useState, useCallback } from 'react';
import { PlacedStructure } from '@/types/garden';
import {
  AutomationPlan,
  generateAutomationTasks,
  loadAutomationPlans,
  saveAutomationPlans,
} from '@/utils/automationPlannerUtils';

function makePlanId() {
  return `plan-${Date.now()}`;
}

export function useAutomationPlan(placedStructures: PlacedStructure[]) {
  const [plans, setPlans] = useState<AutomationPlan[]>(() => loadAutomationPlans());

  /** Build a preview plan (not saved) so the user can review before committing */
  const previewPlan = useCallback(
    (selectedCropIds: string[], managedBedIds: string[]): AutomationPlan => {
      const managedBeds = placedStructures.filter(s => managedBedIds.includes(s.id));
      const tasks = generateAutomationTasks(selectedCropIds, managedBeds);
      return {
        id: makePlanId(),
        selectedCropIds,
        managedBedIds,
        tasks,
        generatedAt: new Date().toISOString(),
      };
    },
    [placedStructures],
  );

  /** Commit a previewed plan — persists it and adds it to the active list */
  const commitPlan = useCallback((newPlan: AutomationPlan) => {
    setPlans(prev => {
      const updated = [...prev, newPlan];
      saveAutomationPlans(updated);
      return updated;
    });
  }, []);

  /** Remove a plan by id */
  const removePlan = useCallback((planId: string) => {
    setPlans(prev => {
      const updated = prev.filter(p => p.id !== planId);
      saveAutomationPlans(updated);
      return updated;
    });
  }, []);

  /** Toggle a task's completed state within any plan */
  const toggleTask = useCallback((taskId: string) => {
    setPlans(prev => {
      const updated = prev.map(plan => ({
        ...plan,
        tasks: plan.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t),
      }));
      saveAutomationPlans(updated);
      return updated;
    });
  }, []);

  // Flat list of all tasks across all plans (for GardenTasks)
  const allTasks = plans.flatMap(p => p.tasks);

  return { plans, allTasks, previewPlan, commitPlan, removePlan, toggleTask };
}
