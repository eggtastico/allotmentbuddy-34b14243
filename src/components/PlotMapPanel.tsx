import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { PlacedStructure, PlacedPlant, PlotSettings } from '@/types/garden';
import { getStructureById } from '@/data/structures';
import { getPlantById } from '@/data/plants';
import {
  getPlantsInBed,
  getDominantRotationGroup,
  getRotationEntry,
  getRotationWarnings,
  getBedDisplayName,
  GARDEN_ROTATION,
  slotGroupName,
  getRotationStatus,
} from '@/utils/bedRotationUtils';

interface Props {
  onClose: () => void;
  structures: PlacedStructure[];
  plants: PlacedPlant[];
  settings: PlotSettings;
  onUpdateStructure?: (s: PlacedStructure) => void;
}

// Hex colours for each rotation slot — used directly on the canvas map divs
const ROTATION_COLOURS: Record<string, { bg: string; border: string; text: string }> = {
  legumes:      { bg: '#dcfce7', border: '#86efac', text: '#166534' },
  brassicas:    { bg: '#f3e8ff', border: '#c084fc', text: '#6b21a8' },
  potatoes:     { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' },
  'onions-roots': { bg: '#fef9c3', border: '#fde047', text: '#854d0e' },
};

const EMPTY_BED_COLOUR = { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' };
const INFRA_COLOUR     = { bg: '#f3f4f6', border: '#d1d5db', text: '#6b7280' };

function structureColour(s: PlacedStructure, allPlants: PlacedPlant[]) {
  const def = getStructureById(s.structureId);
  const isGrowing = !!(def?.showCells || def?.isContainer || def?.canGrowInside);

  if (!isGrowing) return INFRA_COLOUR;

  // Rotation slot wins
  if (s.rotationSlot != null) {
    const c = ROTATION_COLOURS[slotGroupName(s.rotationSlot)];
    if (c) return c;
  }

  // Fall back to dominant planted group
  const plantsIn = getPlantsInBed(s, allPlants);
  const group = getDominantRotationGroup(plantsIn);
  if (group) {
    const c = ROTATION_COLOURS[group];
    if (c) return c;
  }

  return EMPTY_BED_COLOUR;
}

export function PlotMapPanel({ onClose, structures, plants, settings, onUpdateStructure }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Garden grid dimensions
  const cellsPerM = settings.unit === 'meters'
    ? 100 / settings.cellSizeCm
    : 30.48 / settings.cellSizeCm;
  const totalCols = Math.max(1, Math.round(settings.widthM  * cellsPerM));
  const totalRows = Math.max(1, Math.round(settings.heightM * cellsPerM));

  // Selected bed details
  const selectedStruct = structures.find(s => s.id === selectedId) ?? null;
  const selectedDef = selectedStruct ? getStructureById(selectedStruct.structureId) : null;
  const isGrowingSelected = !!(selectedDef?.showCells || selectedDef?.isContainer || selectedDef?.canGrowInside);

  const selectedPlantsInBed = useMemo(
    () => selectedStruct ? getPlantsInBed(selectedStruct, plants) : [],
    [selectedStruct, plants],
  );
  const selectedGroup = useMemo(
    () => getDominantRotationGroup(selectedPlantsInBed),
    [selectedPlantsInBed],
  );
  const selectedWarnings = useMemo(
    () => selectedStruct
      ? getRotationWarnings(selectedStruct.rotationHistory, new Date().getFullYear(), selectedGroup)
      : [],
    [selectedStruct, selectedGroup],
  );

  // Unique planted plant emojis for the detail panel
  const selectedPlantEmojis = useMemo(() => {
    const seen = new Set<string>();
    return selectedPlantsInBed
      .map(pp => getPlantById(pp.plantId))
      .filter(Boolean)
      .filter(p => { if (seen.has(p!.id)) return false; seen.add(p!.id); return true; })
      .slice(0, 8);
  }, [selectedPlantsInBed]);

  const bedName = selectedStruct ? getBedDisplayName(selectedStruct, structures) : '';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-bold text-foreground">🗺️ Plot Map</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {settings.widthM}{settings.unit === 'meters' ? 'm' : 'ft'} ×{' '}
              {settings.heightM}{settings.unit === 'meters' ? 'm' : 'ft'} ·{' '}
              {structures.filter(s => { const d = getStructureById(s.structureId); return d?.showCells || d?.isContainer || d?.canGrowInside; }).length} growing beds
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-4">

          {structures.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="text-5xl mb-3">🌱</span>
              <p className="text-sm font-semibold text-foreground">No beds or structures yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add beds from the Beds &amp; Pots tab, then come back here to plan rotations.
              </p>
            </div>
          ) : (
            <>
              {/* ── Garden map ── */}
              <div
                className="relative w-full border-2 border-dashed border-border rounded-lg bg-muted/20 overflow-hidden"
                style={{ aspectRatio: `${totalCols} / ${totalRows}` }}
              >
                {/* Grid lines (subtle) */}
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  preserveAspectRatio="none"
                  viewBox={`0 0 ${totalCols} ${totalRows}`}
                >
                  {Array.from({ length: totalCols + 1 }).map((_, i) => (
                    <line key={`v${i}`} x1={i} y1={0} x2={i} y2={totalRows} stroke="hsl(var(--border))" strokeWidth="0.04" />
                  ))}
                  {Array.from({ length: totalRows + 1 }).map((_, i) => (
                    <line key={`h${i}`} x1={0} y1={i} x2={totalCols} y2={i} stroke="hsl(var(--border))" strokeWidth="0.04" />
                  ))}
                </svg>

                {/* Structures */}
                {structures.map(s => {
                  const def = getStructureById(s.structureId);
                  const isGrowing = !!(def?.showCells || def?.isContainer || def?.canGrowInside);
                  const col = structureColour(s, plants);
                  const isSelected = s.id === selectedId;
                  const name = getBedDisplayName(s, structures);
                  const plantsIn = isGrowing ? getPlantsInBed(s, plants) : [];

                  // Unique emojis to display inside the tile
                  const emojis = (() => {
                    const seen = new Set<string>();
                    return plantsIn
                      .map(pp => getPlantById(pp.plantId))
                      .filter(Boolean)
                      .filter(p => { if (seen.has(p!.id)) return false; seen.add(p!.id); return true; })
                      .slice(0, 3)
                      .map(p => p!.emoji);
                  })();

                  return (
                    <div
                      key={s.id}
                      onClick={() => isGrowing && setSelectedId(id => id === s.id ? null : s.id)}
                      title={name}
                      className={`absolute flex flex-col items-center justify-center overflow-hidden transition-all rounded-sm
                        ${isGrowing ? 'cursor-pointer hover:brightness-95 hover:scale-[1.02]' : 'cursor-default'}
                        ${isSelected ? 'ring-2 ring-primary ring-offset-1 z-10' : ''}`}
                      style={{
                        left:   `${(s.x / totalCols) * 100}%`,
                        top:    `${(s.y / totalRows) * 100}%`,
                        width:  `${(s.widthCells  / totalCols) * 100}%`,
                        height: `${(s.heightCells / totalRows) * 100}%`,
                        backgroundColor: col.bg,
                        borderWidth: 1,
                        borderStyle: isSelected ? 'solid' : isGrowing ? 'solid' : 'dashed',
                        borderColor: isSelected ? 'hsl(var(--primary))' : col.border,
                        color: col.text,
                      }}
                    >
                      {/* Rotation slot badge */}
                      {s.rotationSlot != null && (
                        <span className="absolute top-0.5 right-0.5 text-[9px] font-bold leading-none opacity-70">
                          {s.rotationSlot}
                        </span>
                      )}
                      {/* Content — only shown when tile is big enough */}
                      <span className="text-[10px] font-semibold leading-tight text-center px-0.5 line-clamp-2 w-full text-center"
                        style={{ fontSize: 'clamp(7px, 1.5cqi, 11px)' }}>
                        {emojis.length > 0 ? emojis.join('') : (isGrowing ? (def?.emoji ?? '') : (def?.emoji ?? ''))}
                      </span>
                      <span className="text-[8px] leading-tight text-center px-0.5 line-clamp-1 w-full opacity-80"
                        style={{ fontSize: 'clamp(6px, 1.2cqi, 9px)' }}>
                        {name}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* ── Rotation legend ── */}
              <div className="flex flex-wrap gap-1.5">
                {GARDEN_ROTATION.map(entry => (
                  <span
                    key={entry.key}
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium border"
                    style={{
                      backgroundColor: ROTATION_COLOURS[entry.key].bg,
                      borderColor: ROTATION_COLOURS[entry.key].border,
                      color: ROTATION_COLOURS[entry.key].text,
                    }}
                  >
                    {entry.emoji} {entry.label}
                  </span>
                ))}
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border"
                  style={{ backgroundColor: EMPTY_BED_COLOUR.bg, borderColor: EMPTY_BED_COLOUR.border, color: EMPTY_BED_COLOUR.text }}>
                  🌱 Empty / unassigned
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border"
                  style={{ backgroundColor: INFRA_COLOUR.bg, borderColor: INFRA_COLOUR.border, color: INFRA_COLOUR.text }}>
                  🔧 Infrastructure
                </span>
              </div>

              {/* ── Selected bed detail ── */}
              {selectedStruct && isGrowingSelected && (
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-sm text-foreground">{bedName}</h3>
                      <p className="text-xs text-muted-foreground">
                        {selectedStruct.widthCells}×{selectedStruct.heightCells} cells ·{' '}
                        {selectedPlantsInBed.length}/{selectedStruct.widthCells * selectedStruct.heightCells} planted
                      </p>
                    </div>
                    {getRotationStatus(selectedWarnings) === 'warning'
                      ? <span className="text-amber-500 text-sm shrink-0">⚠️</span>
                      : <span className="text-green-500 text-sm shrink-0">✅</span>
                    }
                  </div>

                  {/* Planted emojis */}
                  {selectedPlantEmojis.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedPlantEmojis.map((p, i) => (
                        <span key={i} className="text-lg leading-none" title={p?.name}>{p?.emoji}</span>
                      ))}
                      {selectedPlantsInBed.length > 8 && (
                        <span className="text-xs text-muted-foreground self-center">+{selectedPlantsInBed.length - 8} more</span>
                      )}
                    </div>
                  )}

                  {/* Rotation slot picker */}
                  {onUpdateStructure && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                        Rotation slot
                      </p>
                      <div className="flex gap-1.5">
                        {GARDEN_ROTATION.map((entry, idx) => {
                          const slot = idx + 1;
                          const isActive = selectedStruct.rotationSlot === slot;
                          return (
                            <button
                              key={entry.key}
                              onClick={() => onUpdateStructure({
                                ...selectedStruct,
                                rotationSlot: isActive ? undefined : slot,
                              })}
                              title={entry.description}
                              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg border-2 text-[10px] font-bold transition-all ${
                                isActive
                                  ? `${entry.color} border-current`
                                  : 'border-border bg-background text-muted-foreground hover:bg-muted'
                              }`}
                            >
                              <span className="text-base leading-none">{entry.emoji}</span>
                              <span>{slot}</span>
                              <span className="font-normal text-[8px] leading-tight line-clamp-1 px-0.5">{entry.label}</span>
                            </button>
                          );
                        })}
                        {selectedStruct.rotationSlot != null && (
                          <button
                            onClick={() => onUpdateStructure({ ...selectedStruct, rotationSlot: undefined })}
                            className="px-2 py-1.5 rounded-lg border-2 border-dashed border-border text-muted-foreground text-[10px] hover:bg-muted"
                            title="Clear slot"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      {/* Next year preview + Advance button */}
                      {selectedStruct.rotationSlot != null && (() => {
                        const curr = getRotationEntry(slotGroupName(selectedStruct.rotationSlot!));
                        const next = getRotationEntry(slotGroupName(selectedStruct.rotationSlot! % 4 + 1));
                        if (!curr || !next) return null;
                        const currentYear = new Date().getFullYear();
                        return (
                          <div className="flex items-center justify-between gap-2 mt-1.5">
                            <p className="text-[10px] text-muted-foreground">
                              {curr.emoji} {curr.label} this year → {next.emoji} {next.label} next year
                            </p>
                            {onUpdateStructure && (
                              <button
                                onClick={() => {
                                  const newSlot = (selectedStruct.rotationSlot! % 4) + 1;
                                  const currentGroup = slotGroupName(selectedStruct.rotationSlot!);
                                  const prevHistory = selectedStruct.rotationHistory ?? [];
                                  const updatedHistory = [
                                    ...prevHistory.filter(e => e.year !== currentYear),
                                    { year: currentYear, group: currentGroup },
                                  ];
                                  onUpdateStructure({ ...selectedStruct, rotationSlot: newSlot, rotationHistory: updatedHistory });
                                }}
                                className="shrink-0 text-[10px] font-semibold px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
                                title="Advance this bed to the next rotation slot"
                              >
                                Advance →
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Warnings */}
                  {selectedWarnings.length > 0 && (
                    <div className="space-y-1">
                      {selectedWarnings.map((w, i) => (
                        <p key={i} className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                          ⚠️ {w}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Current group badge */}
                  {selectedGroup && (() => {
                    const entry = getRotationEntry(selectedGroup);
                    if (!entry) return null;
                    return (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">Currently growing:</span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium border"
                          style={{
                            backgroundColor: ROTATION_COLOURS[entry.key]?.bg,
                            borderColor: ROTATION_COLOURS[entry.key]?.border,
                            color: ROTATION_COLOURS[entry.key]?.text,
                          }}
                        >
                          {entry.emoji} {entry.label}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── Beds summary list ── */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  All growing beds
                </p>
                <div className="space-y-1">
                  {structures
                    .filter(s => { const d = getStructureById(s.structureId); return d?.showCells || d?.isContainer || d?.canGrowInside; })
                    .map(s => {
                      const plantsIn = getPlantsInBed(s, plants);
                      const group = getDominantRotationGroup(plantsIn);
                      const entry = s.rotationSlot != null
                        ? getRotationEntry(slotGroupName(s.rotationSlot))
                        : group ? getRotationEntry(group) : null;
                      const name = getBedDisplayName(s, structures);
                      const col = structureColour(s, plants);
                      return (
                        <button
                          key={s.id}
                          onClick={() => setSelectedId(id => id === s.id ? null : s.id)}
                          className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg border transition-colors text-xs
                            ${selectedId === s.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}
                        >
                          <span
                            className="w-3 h-3 rounded-sm shrink-0 border"
                            style={{ backgroundColor: col.bg, borderColor: col.border }}
                          />
                          <span className="flex-1 font-medium text-foreground truncate">{name}</span>
                          <span className="text-muted-foreground shrink-0">{plantsIn.length}/{s.widthCells * s.heightCells}</span>
                          {entry && (
                            <span className="shrink-0 text-[10px]">{entry.emoji}</span>
                          )}
                          {s.rotationSlot != null && (
                            <span className="shrink-0 text-[10px] text-muted-foreground">Slot {s.rotationSlot}</span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
