import React, { useState, useMemo } from 'react';
import { PlacedStructure, PlacedPlant } from '@/types/garden';
import { getPlantById } from '@/data/plants';
import {
  getPlantsInBed,
  getDominantRotationGroup,
  buildRotationTable,
  getRotationWarnings,
  getNextGroupSuggestion,
  getBedDisplayName,
  getRotationStatus,
} from '@/utils/bedRotationUtils';
import { X, PencilIcon, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface BedInfoPanelProps {
  bed: PlacedStructure;
  allBeds: PlacedStructure[];
  allPlants: PlacedPlant[];
  onClose: () => void;
  onUpdateBed: (updated: PlacedStructure) => void;
  onRemoveBed: (id: string) => void;
  modal?: boolean; // If true, renders as mobile bottom sheet
}

const ROTATION_GROUP_COLORS: Record<string, string> = {
  legumes: 'bg-green-100 text-green-900',
  brassicas: 'bg-purple-100 text-purple-900',
  roots: 'bg-orange-100 text-orange-900',
  alliums: 'bg-yellow-100 text-yellow-900',
  solanaceae: 'bg-red-100 text-red-900',
  cucurbits: 'bg-blue-100 text-blue-900',
  leafy: 'bg-teal-100 text-teal-900',
  other: 'bg-gray-100 text-gray-900',
};

export function BedInfoPanel({
  bed,
  allBeds,
  allPlants,
  onClose,
  onUpdateBed,
  onRemoveBed,
  modal = false,
}: BedInfoPanelProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(bed.name || '');
  const [showPlants, setShowPlants] = useState(false);

  const bedsInBed = useMemo(() => getPlantsInBed(bed, allPlants), [bed, allPlants]);
  const currentGroup = useMemo(() => getDominantRotationGroup(bedsInBed), [bedsInBed]);
  const currentYear = new Date().getFullYear();
  const rotationTable = useMemo(
    () => buildRotationTable(bed.rotationHistory, currentYear, currentGroup),
    [bed.rotationHistory, currentYear, currentGroup]
  );
  const warnings = useMemo(
    () => getRotationWarnings(bed.rotationHistory, currentYear, currentGroup),
    [bed.rotationHistory, currentYear, currentGroup]
  );
  const nextSuggestion = useMemo(() => getNextGroupSuggestion(currentGroup), [currentGroup]);
  const status = useMemo(() => getRotationStatus(warnings), [warnings]);

  const handleSaveName = () => {
    onUpdateBed({ ...bed, name: editName || undefined });
    setIsEditingName(false);
  };

  const handleLogThisYear = () => {
    if (!currentGroup) return;
    const newHistory = [...(bed.rotationHistory ?? [])];
    // Replace or add entry for current year
    const existingIndex = newHistory.findIndex(e => e.year === currentYear);
    if (existingIndex >= 0) {
      newHistory[existingIndex] = { year: currentYear, group: currentGroup };
    } else {
      newHistory.push({ year: currentYear, group: currentGroup });
    }
    onUpdateBed({ ...bed, rotationHistory: newHistory });
  };

  const bedName = getBedDisplayName(bed, allBeds);
  const catalogueName = bed.structureId
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  // Desktop sidebar
  if (!modal) {
    return (
      <div className="hidden lg:flex lg:flex-col lg:w-72 border-l border-border bg-card h-full overflow-y-auto">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/50">
          <div className="flex items-center justify-between gap-2">
            {isEditingName ? (
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
                autoFocus
                className="flex-1 text-lg font-bold border rounded px-2 py-1 bg-background"
              />
            ) : (
              <h2 className="flex-1 text-lg font-bold">{bedName}</h2>
            )}
            <button
              onClick={() => {
                if (isEditingName) {
                  handleSaveName();
                } else {
                  setEditName(bed.name || '');
                  setIsEditingName(true);
                }
              }}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="Edit name"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Info strip */}
        <div className="px-4 py-2 text-xs text-muted-foreground space-y-1 border-b border-border/50">
          <div>
            <span className="font-medium">Type:</span> {catalogueName}
          </div>
          <div>
            <span className="font-medium">Size:</span> {bed.widthCells} × {bed.heightCells} cells
          </div>
          <div>
            <span className="font-medium">Plants:</span> {bedsInBed.length}
          </div>
        </div>

        {/* Current group badge */}
        {currentGroup && (
          <div className="px-4 py-3 border-b border-border/50">
            <div className="text-xs font-medium text-muted-foreground mb-1">Current Group</div>
            <Badge className={ROTATION_GROUP_COLORS[currentGroup]}>
              {currentGroup.charAt(0).toUpperCase() + currentGroup.slice(1)}
            </Badge>
          </div>
        )}

        {/* 4-year rotation table */}
        <div className="px-4 py-3 border-b border-border/50">
          <div className="text-xs font-medium text-muted-foreground mb-2">Rotation History</div>
          <table className="w-full text-xs">
            <tbody>
              {rotationTable.map((row, i) => (
                <tr
                  key={i}
                  className={
                    row.source === 'current' ? 'bg-primary/10 font-semibold' : ''
                  }
                >
                  <td className="py-1 pr-2 text-muted-foreground w-12">{row.year}</td>
                  <td className="py-1">
                    {row.group ? (
                      <Badge className={ROTATION_GROUP_COLORS[row.group]}>
                        {row.group.slice(0, 3)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground italic">—</span>
                    )}
                  </td>
                  <td className="py-1 pl-2 text-muted-foreground text-[10px]">
                    {row.source === 'history' ? '📋' : row.source === 'current' ? '◆' : '·'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="px-4 py-3 border-b border-border/50">
            <div className="space-y-2">
              {warnings.map((warning, i) => (
                <div key={i} className="p-2 rounded-sm bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  ⚠️ {warning}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rotation status badge */}
        <div className="px-4 py-2 text-center text-sm font-medium">
          {status === 'good' ? (
            <span className="text-green-700">✅ Good rotation</span>
          ) : (
            <span className="text-amber-700">⚠️ Review needed</span>
          )}
        </div>

        {/* Next year suggestion */}
        {nextSuggestion && (
          <div className="px-4 py-3 border-t border-border/50 bg-blue-50">
            <div className="text-xs font-medium text-blue-900 mb-1">Next Year</div>
            <div className="text-xs text-blue-800">
              <span className="font-semibold">
                {nextSuggestion.group.charAt(0).toUpperCase() + nextSuggestion.group.slice(1)}
              </span>
              <br />
              <span className="text-[11px]">{nextSuggestion.reason}</span>
            </div>
          </div>
        )}

        {/* Log this year button */}
        <div className="px-4 py-3 border-t border-border/50">
          <Button
            onClick={handleLogThisYear}
            disabled={!currentGroup}
            size="sm"
            className="w-full"
          >
            Log This Year
          </Button>
        </div>

        {/* Plants list */}
        {bedsInBed.length > 0 && (
          <div className="px-4 py-3 border-t border-border/50">
            <button
              onClick={() => setShowPlants(!showPlants)}
              className="w-full text-left text-sm font-medium flex items-center justify-between hover:text-primary"
            >
              Plants in this bed ({bedsInBed.length})
              <span>{showPlants ? '▼' : '▶'}</span>
            </button>
            {showPlants && (
              <div className="mt-2 space-y-1">
                {bedsInBed.map(p => {
                  const plantData = getPlantById(p.plantId);
                  return (
                    <div key={p.id} className="text-xs text-muted-foreground flex items-center gap-1">
                      <span>{plantData?.emoji || '🌱'}</span>
                      <span>{plantData?.name || 'Unknown'}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Remove button */}
        <div className="px-4 py-3 border-t border-border/50 mt-auto">
          <Button
            onClick={() => {
              if (window.confirm(`Remove "${bedName}"?`)) {
                onRemoveBed(bed.id);
                onClose();
              }
            }}
            variant="destructive"
            size="sm"
            className="w-full"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remove Bed
          </Button>
        </div>
      </div>
    );
  }

  // Mobile bottom sheet
  return (
    <div className="fixed inset-x-0 bottom-0 lg:hidden max-h-[90vh] bg-card rounded-t-lg border-t border-border overflow-y-auto z-40">
      {/* Drag handle */}
      <div className="px-4 py-2 flex justify-center border-b border-border/50">
        <div className="h-1 w-10 rounded-full bg-muted" />
      </div>

      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between gap-2">
        {isEditingName ? (
          <input
            type="text"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSaveName();
              if (e.key === 'Escape') setIsEditingName(false);
            }}
            autoFocus
            className="flex-1 text-lg font-bold border rounded px-2 py-1 bg-background"
          />
        ) : (
          <h2 className="flex-1 text-lg font-bold">{bedName}</h2>
        )}
        <button
          onClick={() => {
            if (isEditingName) {
              handleSaveName();
            } else {
              setEditName(bed.name || '');
              setIsEditingName(true);
            }
          }}
          className="p-1 hover:bg-muted rounded transition-colors"
        >
          <PencilIcon className="h-4 w-4" />
        </button>
        <button
          onClick={onClose}
          className="p-1 hover:bg-muted rounded transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Info strip */}
      <div className="px-4 py-2 text-xs text-muted-foreground space-y-1 border-b border-border/50">
        <div>
          <span className="font-medium">Type:</span> {catalogueName}
        </div>
        <div>
          <span className="font-medium">Size:</span> {bed.widthCells} × {bed.heightCells} cells
        </div>
        <div>
          <span className="font-medium">Plants:</span> {bedsInBed.length}
        </div>
      </div>

      {/* Current group badge */}
      {currentGroup && (
        <div className="px-4 py-3 border-b border-border/50">
          <div className="text-xs font-medium text-muted-foreground mb-1">Current Group</div>
          <Badge className={ROTATION_GROUP_COLORS[currentGroup]}>
            {currentGroup.charAt(0).toUpperCase() + currentGroup.slice(1)}
          </Badge>
        </div>
      )}

      {/* 4-year rotation table */}
      <div className="px-4 py-3 border-b border-border/50">
        <div className="text-xs font-medium text-muted-foreground mb-2">Rotation History</div>
        <table className="w-full text-xs">
          <tbody>
            {rotationTable.map((row, i) => (
              <tr
                key={i}
                className={
                  row.source === 'current' ? 'bg-primary/10 font-semibold' : ''
                }
              >
                <td className="py-1 pr-2 text-muted-foreground w-12">{row.year}</td>
                <td className="py-1">
                  {row.group ? (
                    <Badge className={ROTATION_GROUP_COLORS[row.group]}>
                      {row.group.slice(0, 3)}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground italic">—</span>
                  )}
                </td>
                <td className="py-1 pl-2 text-muted-foreground text-[10px]">
                  {row.source === 'history' ? '📋' : row.source === 'current' ? '◆' : '·'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="px-4 py-3 border-b border-border/50">
          <div className="space-y-2">
            {warnings.map((warning, i) => (
              <div key={i} className="p-2 rounded-sm bg-amber-50 border border-amber-200 text-xs text-amber-900">
                ⚠️ {warning}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rotation status */}
      <div className="px-4 py-2 text-center text-sm font-medium">
        {status === 'good' ? (
          <span className="text-green-700">✅ Good rotation</span>
        ) : (
          <span className="text-amber-700">⚠️ Review needed</span>
        )}
      </div>

      {/* Next year suggestion */}
      {nextSuggestion && (
        <div className="px-4 py-3 border-t border-border/50 bg-blue-50">
          <div className="text-xs font-medium text-blue-900 mb-1">Next Year</div>
          <div className="text-xs text-blue-800">
            <span className="font-semibold">
              {nextSuggestion.group.charAt(0).toUpperCase() + nextSuggestion.group.slice(1)}
            </span>
            <br />
            <span className="text-[11px]">{nextSuggestion.reason}</span>
          </div>
        </div>
      )}

      {/* Log this year button */}
      <div className="px-4 py-3 border-t border-border/50">
        <Button
          onClick={handleLogThisYear}
          disabled={!currentGroup}
          size="sm"
          className="w-full"
        >
          Log This Year
        </Button>
      </div>

      {/* Plants list */}
      {bedsInBed.length > 0 && (
        <div className="px-4 py-3 border-t border-border/50">
          <button
            onClick={() => setShowPlants(!showPlants)}
            className="w-full text-left text-sm font-medium flex items-center justify-between hover:text-primary"
          >
            Plants in this bed ({bedsInBed.length})
            <span>{showPlants ? '▼' : '▶'}</span>
          </button>
          {showPlants && (
            <div className="mt-2 space-y-1">
              {bedsInBed.map(p => {
                const plantData = getPlantById(p.plantId);
                return (
                  <div key={p.id} className="text-xs text-muted-foreground flex items-center gap-1">
                    <span>{plantData?.emoji || '🌱'}</span>
                    <span>{plantData?.name || 'Unknown'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Remove button */}
      <div className="px-4 py-3 border-t border-border/50">
        <Button
          onClick={() => {
            if (window.confirm(`Remove "${bedName}"?`)) {
              onRemoveBed(bed.id);
              onClose();
            }
          }}
          variant="destructive"
          size="sm"
          className="w-full"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Remove Bed
        </Button>
      </div>

      {/* Bottom padding for safe zone */}
      <div className="h-4" />
    </div>
  );
}
