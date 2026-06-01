import { useState, useCallback, useRef, useEffect } from 'react';
import { PlacedPlant, PlacedStructure } from '@/types/garden';

export interface GardenSnapshot {
  plants: PlacedPlant[];
  structures: PlacedStructure[];
}

export interface UseUndoRedoOptions {
  /** Current placed plants (needed to snapshot before undo/redo). */
  placedPlants: PlacedPlant[];
  /** Current placed structures (needed to snapshot before undo/redo). */
  placedStructures: PlacedStructure[];
  /** Setter for placed plants — called when undo/redo restores a snapshot. */
  setPlacedPlants: React.Dispatch<React.SetStateAction<PlacedPlant[]>>;
  /** Setter for placed structures — called when undo/redo restores a snapshot. */
  setPlacedStructures: React.Dispatch<React.SetStateAction<PlacedStructure[]>>;
  /** Called on undo/redo to deselect any active selection. */
  clearSelections: () => void;
  /** Currently pending plant ID (for Escape key cancellation). */
  pendingPlantId: string | null;
  /** Called when Escape is pressed while a placement is pending. */
  onCancelPending: () => void;
  /** Maximum number of snapshots to keep. */
  maxHistory?: number;
}

export interface UseUndoRedoReturn {
  undoStack: GardenSnapshot[];
  redoStack: GardenSnapshot[];
  canUndo: boolean;
  canRedo: boolean;
  /** Push the current state onto the undo stack (call before a mutation). */
  pushUndo: (plants: PlacedPlant[], structures: PlacedStructure[]) => void;
  /** Undo the last mutation. */
  handleUndo: () => void;
  /** Redo the last undone mutation. */
  handleRedo: () => void;
  /** Ref that callers set to `true` when restoring a snapshot, so that the
   *  normal "push undo on change" logic can be skipped for that update. */
  skipHistoryRef: React.MutableRefObject<boolean>;
  /** Reset both stacks (e.g. when loading a new plan). */
  resetStacks: () => void;
}

export function useUndoRedo(options: UseUndoRedoOptions): UseUndoRedoReturn {
  const {
    placedPlants,
    placedStructures,
    setPlacedPlants,
    setPlacedStructures,
    clearSelections,
    pendingPlantId,
    onCancelPending,
    maxHistory = 50,
  } = options;

  const [undoStack, setUndoStack] = useState<GardenSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<GardenSnapshot[]>([]);
  const skipHistoryRef = useRef(false);

  const pushUndo = useCallback(
    (plants: PlacedPlant[], structures: PlacedStructure[]) => {
      setUndoStack(s => [...s.slice(-(maxHistory - 1)), { plants, structures }]);
      setRedoStack([]);
    },
    [maxHistory],
  );

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    setRedoStack(s => [...s, { plants: placedPlants, structures: placedStructures }]);
    skipHistoryRef.current = true;
    setPlacedPlants(prev.plants);
    setPlacedStructures(prev.structures);
    clearSelections();
  }, [undoStack, placedPlants, placedStructures, setPlacedPlants, setPlacedStructures, clearSelections]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(s => s.slice(0, -1));
    setUndoStack(s => [...s, { plants: placedPlants, structures: placedStructures }]);
    skipHistoryRef.current = true;
    setPlacedPlants(next.plants);
    setPlacedStructures(next.structures);
    clearSelections();
  }, [redoStack, placedPlants, placedStructures, setPlacedPlants, setPlacedStructures, clearSelections]);

  const resetStacks = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  // Keyboard shortcuts: Ctrl+Z for undo, Ctrl+Y / Ctrl+Shift+Z for redo, Escape to cancel placement
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Escape: cancel pending plant/structure placement
      if (e.key === 'Escape' && pendingPlantId) {
        onCancelPending();
        return;
      }

      // Skip undo/redo if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo, pendingPlantId, onCancelPending]);

  return {
    undoStack,
    redoStack,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    pushUndo,
    handleUndo,
    handleRedo,
    skipHistoryRef,
    resetStacks,
  };
}
