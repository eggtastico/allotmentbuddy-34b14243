import { PlantSidebar } from '@/components/PlantSidebar';

interface StructuresViewProps {
  setDragging: (id: string | null) => void;
  pendingPlantId: string | null;
  handleSelectForPlacement: (plantId: string, isStructure?: boolean) => void;
  handleSelectStructureForPlacement: (structureId: string, w: number, h: number) => void;
  cellSizeCm: number;
}

export function StructuresView({
  setDragging,
  pendingPlantId,
  handleSelectForPlacement,
  handleSelectStructureForPlacement,
  cellSizeCm,
}: StructuresViewProps) {
  return (
    <div className="flex-1 overflow-hidden">
      <PlantSidebar
        onDragStart={setDragging}
        pendingPlantId={pendingPlantId}
        onSelectPlant={handleSelectForPlacement}
        onSelectStructure={handleSelectStructureForPlacement}
        cellSizeCm={cellSizeCm}
        fullScreen
        defaultTab="structures"
        structureFilter="other"
      />
    </div>
  );
}
