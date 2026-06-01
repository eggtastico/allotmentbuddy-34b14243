import React, { useState, useMemo, useRef } from 'react';
import { PlacedStructure, PlacedPlant, CoverType } from '@/types/garden';
import type { Plant } from '@/types/garden';
import { PlantInfoPanel } from '@/components/PlantInfoPanel';
import { plants as allPlants, getPlantById } from '@/data/plants';
import {
  getPlantsInBed,
  getDominantRotationGroup,
  buildRotationTable,
  getRotationWarnings,
  getNextGroupSuggestion,
  getBedDisplayName,
  getRotationStatus,
  slotGroupName,
  ROTATION_GROUP_LABELS,
  GARDEN_ROTATION,
  getRotationEntry,
} from '@/utils/bedRotationUtils';
import { getSowingStatus, getMonthName } from '@/utils/seasonalSowing';
import { getCompanionReason } from '@/data/companionReasons';
import { X, PencilIcon, Trash2, Search, ChevronDown, ChevronRight, Copy, Info, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface BedPlantingPanelProps {
  bed: PlacedStructure;
  allBeds: PlacedStructure[];
  allPlants: PlacedPlant[];
  cellSizeCm?: number;
  onClose: () => void;
  onUpdateBed: (updated: PlacedStructure) => void;
  onRemoveBed: (id: string) => void;
  onAddPlant: (plantId: string, col: number, row: number) => void;
  onRemovePlant: (placedPlantId: string) => void;
  onUpdatePlacedPlant?: (updated: PlacedPlant) => void;
  onDuplicateBed?: () => void;
}

const COVER_OPTIONS: { value: CoverType; label: string; emoji: string }[] = [
  { value: 'outdoor',    label: 'Outdoor',    emoji: '🌤️' },
  { value: 'cold-frame', label: 'Cold Frame', emoji: '🪟' },
  { value: 'polytunnel', label: 'Polytunnel', emoji: '⛺' },
  { value: 'greenhouse', label: 'Greenhouse', emoji: '🏠' },
];

const COVER_MONTH_OFFSET: Record<CoverType, number> = {
  outdoor: 0, 'cold-frame': 1, polytunnel: 2, greenhouse: 3,
};

function rotationColor(key: string | null): string {
  if (!key) return 'bg-gray-100 text-gray-700';
  const entry = getRotationEntry(key);
  return entry?.color ?? 'bg-gray-100 text-gray-700';
}

function defaultCoverType(structureId: string): CoverType {
  if (structureId === 'greenhouse') return 'greenhouse';
  if (structureId === 'polytunnel') return 'polytunnel';
  if (structureId === 'cold-frame') return 'cold-frame';
  return 'outdoor';
}

type SelectedCell =
  | { kind: 'empty'; col: number; row: number }
  | { kind: 'planted'; col: number; row: number; placedPlant: PlacedPlant; plant: Plant };

export function BedPlantingPanel({
  bed,
  allBeds,
  allPlants: placedPlants,
  cellSizeCm = 20,
  onClose,
  onUpdateBed,
  onRemoveBed,
  onAddPlant,
  onRemovePlant,
  onUpdatePlacedPlant,
  onDuplicateBed,
}: BedPlantingPanelProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(bed.name || '');
  const [notes, setNotes] = useState(bed.notes ?? '');
  const [infoPlant, setInfoPlant] = useState<PlacedPlant | null>(null);
  const bedLocked = bed.locked ?? false;
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerMode, setPickerMode] = useState<'rotation' | 'season' | 'all'>(
    bed.rotationSlot != null ? 'rotation' : 'season'
  );
  const [showRotation, setShowRotation] = useState(false);
  // Stamp mode: a plant that stays "active" so tapping cells keeps placing it
  const [stampPlant, setStampPlant] = useState<Plant | null>(null);
  // Double-tap detection for quick remove
  const lastTapRef = useRef<{ key: string; time: number } | null>(null);
  // Long-press to move a plant between cells
  const [movingCell, setMovingCell] = useState<{ col: number; row: number; plant: Plant; placedPlant: PlacedPlant } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const LONG_PRESS_MS = 450;

  const coverType: CoverType = bed.coverType ?? defaultCoverType(bed.structureId);
  const currentMonth = new Date().getMonth();
  const effectiveMonth = Math.min(11, currentMonth + COVER_MONTH_OFFSET[coverType]);
  const monthName = getMonthName(effectiveMonth);

  const plantsInBed = useMemo(() => getPlantsInBed(bed, placedPlants), [bed, placedPlants]);

  // "col,row" → { placedPlant, plant }
  const cellMap = useMemo(() => {
    const map = new Map<string, { placedPlant: PlacedPlant; plant: Plant }>();
    for (const pp of plantsInBed) {
      const col = pp.x - bed.x;
      const row = pp.y - bed.y;
      const plant = getPlantById(pp.plantId);
      if (plant && col >= 0 && col < bed.widthCells && row >= 0 && row < bed.heightCells) {
        map.set(`${col},${row}`, { placedPlant: pp, plant });
      }
    }
    return map;
  }, [plantsInBed, bed]);

  // Cells blocked by existing plants' spacing (+ stamp plant spacing when active).
  // Uses Math.floor so 45cm / 20cm = 2 cells, not 3 (user's explicit rounding preference).
  const spacingBlockedCells = useMemo(() => {
    const blocked = new Set<string>();
    for (const [, { placedPlant, plant: existingPlant }] of cellMap) {
      const col = placedPlant.x - bed.x;
      const row = placedPlant.y - bed.y;
      const effectiveSpacingCm = Math.max(existingPlant.spacingCm, stampPlant?.spacingCm ?? 0);
      const spacingCells = Math.floor(effectiveSpacingCm / cellSizeCm);
      if (spacingCells <= 1) continue; // 1 cell = only the plant's own cell, nothing to block
      for (let dc = -spacingCells; dc <= spacingCells; dc++) {
        for (let dr = -spacingCells; dr <= spacingCells; dr++) {
          if (dc === 0 && dr === 0) continue;
          if (Math.sqrt(dc * dc + dr * dr) < spacingCells) {
            const nc = col + dc;
            const nr = row + dr;
            if (nc >= 0 && nc < bed.widthCells && nr >= 0 && nr < bed.heightCells) {
              blocked.add(`${nc},${nr}`);
            }
          }
        }
      }
    }
    return blocked;
  }, [cellMap, bed, stampPlant, cellSizeCm]);

  const currentGroup = useMemo(() => getDominantRotationGroup(plantsInBed), [plantsInBed]);
  const currentYear = new Date().getFullYear();
  const rotationTable = useMemo(
    () => buildRotationTable(bed.rotationHistory, currentYear, currentGroup, bed.rotationSlot),
    [bed.rotationHistory, currentYear, currentGroup, bed.rotationSlot]
  );
  const warnings = useMemo(
    () => getRotationWarnings(bed.rotationHistory, currentYear, currentGroup),
    [bed.rotationHistory, currentYear, currentGroup]
  );
  const nextSuggestion = useMemo(() => getNextGroupSuggestion(currentGroup), [currentGroup]);
  const rotationStatus = useMemo(() => getRotationStatus(warnings), [warnings]);
  const bedName = getBedDisplayName(bed, allBeds);

  // Companion conflicts: pairs of plants in this bed that are enemies of each other
  const bedConflicts = useMemo(() => {
    const conflicts: Array<{ plant1: ReturnType<typeof getPlantById>; plant2: ReturnType<typeof getPlantById>; reason?: string }> = [];
    const uniquePlantIds = [...new Set(plantsInBed.map(pp => pp.plantId))];
    const plantsWithData = uniquePlantIds.map(id => getPlantById(id)).filter(Boolean) as NonNullable<ReturnType<typeof getPlantById>>[];
    for (let i = 0; i < plantsWithData.length; i++) {
      for (let j = i + 1; j < plantsWithData.length; j++) {
        const p1 = plantsWithData[i];
        const p2 = plantsWithData[j];
        if (p1.enemies.includes(p2.id) || p2.enemies.includes(p1.id)) {
          const reason = getCompanionReason(p1.id, p2.id) || getCompanionReason(p2.id, p1.id);
          conflicts.push({ plant1: p1, plant2: p2, reason });
        }
      }
    }
    return conflicts;
  }, [plantsInBed]);

  const handleSaveName = () => {
    onUpdateBed({ ...bed, name: editName || undefined });
    setIsEditingName(false);
  };

  const handleSetCoverType = (ct: CoverType) => {
    onUpdateBed({ ...bed, coverType: ct });
  };

  const handleLogThisYear = () => {
    if (!currentGroup) return;
    const newHistory = [...(bed.rotationHistory ?? [])];
    const idx = newHistory.findIndex(e => e.year === currentYear);
    if (idx >= 0) newHistory[idx] = { year: currentYear, group: currentGroup };
    else newHistory.push({ year: currentYear, group: currentGroup });
    onUpdateBed({ ...bed, rotationHistory: newHistory });
  };


  const handleCellPointerDown = (col: number, row: number, e: React.PointerEvent) => {
    if (bedLocked) return;
    const key = `${col},${row}`;
    const cell = cellMap.get(key);
    if (!cell || movingCell) return;
    // Suppress context menu / iOS callout during the hold
    e.preventDefault();
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(40); } catch { /* ignore */ }
      }
      setMovingCell({ col, row, plant: cell.plant, placedPlant: cell.placedPlant });
      setSelectedCell(null);
      lastTapRef.current = null;
      longPressTimerRef.current = null;
    }, LONG_PRESS_MS);
  };

  const handleCellPointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleCellClick = (col: number, row: number) => {
    if (bedLocked) return;
    const key = `${col},${row}`;
    const cell = cellMap.get(key);

    // ── Move mode: commit or cancel ──
    if (movingCell) {
      if (col === movingCell.col && row === movingCell.row) {
        // Tap source again → cancel
        setMovingCell(null);
        return;
      }
      if (!cell) {
        // Check spacing excluding the plant we're moving
        const wouldBeBlocked = [...cellMap.values()]
          .filter(({ placedPlant }) => placedPlant.id !== movingCell.placedPlant.id)
          .some(({ placedPlant, plant: existing }) => {
            const dc = col - (placedPlant.x - bed.x);
            const dr = row - (placedPlant.y - bed.y);
            const dist = Math.sqrt(dc * dc + dr * dr);
            const spacingCells = Math.floor(Math.max(existing.spacingCm, movingCell.plant.spacingCm) / cellSizeCm);
            return spacingCells > 1 && dist < spacingCells;
          });
        if (!wouldBeBlocked) {
          onRemovePlant(movingCell.placedPlant.id);
          onAddPlant(movingCell.plant.id, col, row);
          setMovingCell(null);
          setSelectedCell(null);
          return;
        }
      }
      // Tapped another plant or a blocked cell → cancel move
      setMovingCell(null);
      return;
    }

    if (stampPlant && !cell) {
      // Stamp mode: place without opening picker, but respect spacing
      if (spacingBlockedCells.has(key)) return;
      onAddPlant(stampPlant.id, col, row);
      return;
    }

    if (cell) {
      // Double-tap detection: remove immediately on second tap within 400ms
      const now = Date.now();
      const last = lastTapRef.current;
      if (last && last.key === key && now - last.time < 400) {
        lastTapRef.current = null;
        onRemovePlant(cell.placedPlant.id);
        setSelectedCell(null);
        return;
      }
      lastTapRef.current = { key, time: now };

      // Occupied: toggle plant-info panel on single tap
      if (selectedCell?.col === col && selectedCell?.row === row) {
        setSelectedCell(null);
      } else {
        setSelectedCell({ kind: 'planted', col, row, placedPlant: cell.placedPlant, plant: cell.plant });
        setPickerSearch('');
      }
    } else {
      lastTapRef.current = null;
      // Empty: open picker (toggle)
      if (selectedCell?.kind === 'empty' && selectedCell.col === col && selectedCell.row === row) {
        setSelectedCell(null);
      } else {
        setSelectedCell({ kind: 'empty', col, row });
        setPickerSearch('');
      }
    }
  };

  const handlePickPlant = (plant: Plant) => {
    if (!selectedCell || selectedCell.kind !== 'empty') return;
    // Check spacing for the chosen plant against every existing plant in the bed
    const { col, row } = selectedCell;
    const tooClose = [...cellMap.values()].some(({ placedPlant, plant: existing }) => {
      const dc = col - (placedPlant.x - bed.x);
      const dr = row - (placedPlant.y - bed.y);
      const dist = Math.sqrt(dc * dc + dr * dr);
      const spacingCells = Math.floor(Math.max(existing.spacingCm, plant.spacingCm) / cellSizeCm);
      return dist < spacingCells;
    });
    if (tooClose) return;
    onAddPlant(plant.id, selectedCell.col, selectedCell.row);
    // Activate stamp mode with this plant
    setStampPlant(plant);
    setSelectedCell(null);
    setPickerSearch('');
  };

  const handleRemoveFromCell = () => {
    if (!selectedCell || selectedCell.kind !== 'planted') return;
    onRemovePlant(selectedCell.placedPlant.id);
    setSelectedCell(null);
  };

  const handleClearStamp = () => {
    setStampPlant(null);
    setSelectedCell(null);
  };

  // Plant picker list
  const inSeasonPlants = useMemo(() =>
    allPlants.filter(p => getSowingStatus(p, effectiveMonth).canSowNow)
      .sort((a, b) => {
        const sa = getSowingStatus(a, effectiveMonth);
        const sb = getSowingStatus(b, effectiveMonth);
        const scoreA = sa.sowOutdoorsNow ? 2 : 1;
        const scoreB = sb.sowOutdoorsNow ? 2 : 1;
        return scoreB - scoreA || a.name.localeCompare(b.name);
      }),
    [effectiveMonth]
  );

  // When a rotation slot is set, identify which plant groups belong to this slot.
  const rotationAllowedGroups: string[] | null = bed.rotationSlot != null
    ? GARDEN_ROTATION[bed.rotationSlot - 1].plantGroups
    : null;

  // All plants belonging to the rotation group — NOT filtered by season.
  // Sorted: sow-outdoors-now first, sow-indoors-now second, out-of-season last.
  const rotationGroupPlants = useMemo(() => {
    if (!rotationAllowedGroups) return [];
    const group = allPlants.filter(p => rotationAllowedGroups.includes(p.rotationGroup));
    return group.sort((a, b) => {
      const sa = getSowingStatus(a, effectiveMonth);
      const sb = getSowingStatus(b, effectiveMonth);
      const scoreA = sa.sowOutdoorsNow ? 3 : sa.sowIndoorsNow ? 2 : 0;
      const scoreB = sb.sowOutdoorsNow ? 3 : sb.sowIndoorsNow ? 2 : 0;
      return scoreB - scoreA || a.name.localeCompare(b.name);
    });
  }, [rotationAllowedGroups, effectiveMonth]);

  const pickerPlants = useMemo(() => {
    const q = pickerSearch.toLowerCase();
    if (pickerMode === 'rotation' && rotationAllowedGroups) {
      const base = q
        ? rotationGroupPlants.filter(p => p.name.toLowerCase().includes(q) || p.category.includes(q))
        : rotationGroupPlants;
      return base;
    }
    const base = pickerMode === 'all' ? allPlants : inSeasonPlants;
    const filtered = q ? base.filter(p => p.name.toLowerCase().includes(q) || p.category.includes(q)) : base;
    if (pickerMode === 'all' && !q) {
      const inSeason = filtered.filter(p => getSowingStatus(p, effectiveMonth).canSowNow);
      const out = filtered.filter(p => !getSowingStatus(p, effectiveMonth).canSowNow).sort((a, b) => a.name.localeCompare(b.name));
      return [...inSeason, ...out];
    }
    return filtered;
  }, [pickerSearch, pickerMode, inSeasonPlants, rotationGroupPlants, rotationAllowedGroups, effectiveMonth]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      {/* overflow-y-auto is on the inner scroll area (below the stamp banner), not here,
          so the "Planting … Done" bar stays visible when the bed grid is scrolled. */}
      <DialogContent className="max-h-[90vh] w-full sm:max-w-lg p-0 flex flex-col gap-0 overflow-hidden">

        {/* ── Header ── */}
        <div className="px-4 py-3 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-2">
            {isEditingName ? (
              <input
                type="text" value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setIsEditingName(false); }}
                autoFocus
                className="flex-1 text-lg font-bold border rounded px-2 py-1 bg-background"
              />
            ) : (
              <h2 className="flex-1 text-lg font-bold">{bedName}</h2>
            )}
            {!bedLocked && (
              <button onClick={() => { setEditName(bed.name || ''); setIsEditingName(!isEditingName); }} className="p-1 hover:bg-muted rounded" title="Rename bed">
                <PencilIcon className="h-4 w-4" />
              </button>
            )}
            {onDuplicateBed && (
              <button onClick={onDuplicateBed} className="p-1 hover:bg-muted rounded" title="Duplicate bed">
                <Copy className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => onUpdateBed({ ...bed, locked: !bedLocked })}
              className={`p-1 rounded transition-colors ${bedLocked ? 'text-amber-600 hover:bg-amber-50' : 'hover:bg-muted text-muted-foreground'}`}
              title={bedLocked ? 'Unlock bed' : 'Lock bed'}
            >
              {bedLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            </button>
            <button onClick={onClose} className="p-1 hover:bg-muted rounded">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-3 mt-1">
            {/* Width stepper */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground font-medium w-3">W</span>
              <button
                onClick={() => !bedLocked && onUpdateBed({ ...bed, widthCells: Math.max(1, bed.widthCells - 1) })}
                disabled={bedLocked}
                className="h-6 w-6 rounded border border-border bg-muted flex items-center justify-center text-sm font-bold leading-none hover:bg-muted/80 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
              >−</button>
              <span className="text-xs font-semibold w-5 text-center">{bed.widthCells}</span>
              <button
                onClick={() => !bedLocked && onUpdateBed({ ...bed, widthCells: Math.min(30, bed.widthCells + 1) })}
                disabled={bedLocked}
                className="h-6 w-6 rounded border border-border bg-muted flex items-center justify-center text-sm font-bold leading-none hover:bg-muted/80 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
              >+</button>
            </div>
            <span className="text-muted-foreground/40 text-xs">×</span>
            {/* Height stepper */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground font-medium w-3">H</span>
              <button
                onClick={() => !bedLocked && onUpdateBed({ ...bed, heightCells: Math.max(1, bed.heightCells - 1) })}
                disabled={bedLocked}
                className="h-6 w-6 rounded border border-border bg-muted flex items-center justify-center text-sm font-bold leading-none hover:bg-muted/80 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
              >−</button>
              <span className="text-xs font-semibold w-5 text-center">{bed.heightCells}</span>
              <button
                onClick={() => !bedLocked && onUpdateBed({ ...bed, heightCells: Math.min(30, bed.heightCells + 1) })}
                disabled={bedLocked}
                className="h-6 w-6 rounded border border-border bg-muted flex items-center justify-center text-sm font-bold leading-none hover:bg-muted/80 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
              >+</button>
            </div>
            <span className="text-[10px] text-muted-foreground ml-auto">{plantsInBed.length}/{bed.widthCells * bed.heightCells} planted</span>
          </div>

          {/* ── Rotation slot quick-picker ── */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide shrink-0">Rotation</span>
            <div className="flex gap-1.5 flex-1">
              {GARDEN_ROTATION.map((entry, idx) => {
                const slot = idx + 1;
                const isActive = bed.rotationSlot === slot;
                return (
                  <button
                    key={entry.key}
                    onClick={() => {
                      if (isActive) {
                        onUpdateBed({ ...bed, rotationSlot: undefined });
                      } else {
                        // First time assigning a slot: also record current year in history
                        const dominantGroup = getDominantRotationGroup(getPlantsInBed(bed, placedPlants));
                        const groupForHistory = dominantGroup ?? slotGroupName(slot);
                        const updatedHistory = [
                          ...(bed.rotationHistory ?? []).filter(e => e.year !== currentYear),
                          { year: currentYear, group: groupForHistory },
                        ];
                        onUpdateBed({ ...bed, rotationSlot: slot, rotationHistory: updatedHistory });
                      }
                    }}
                    title={entry.description}
                    className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg border-2 transition-all ${
                      isActive
                        ? `${entry.color} border-current`
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span className="text-base leading-none">{entry.emoji}</span>
                    <span className={`text-[10px] font-bold leading-none ${isActive ? '' : 'text-muted-foreground'}`}>{slot}</span>
                    <span className="text-[8px] leading-tight text-center px-0.5 line-clamp-1">{entry.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Cover type ── */}
        <div className="px-4 py-2 border-b border-border/50 shrink-0">
          <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Growing environment</p>
          <div className="flex gap-1.5">
            {COVER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleSetCoverType(opt.value)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg border text-[10px] font-medium transition-colors ${
                  coverType === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                <span className="text-base leading-none">{opt.emoji}</span>
                <span className="leading-tight text-center">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Bed lock banner — sticky ── */}
        {bedLocked && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 shrink-0">
            <Lock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-800 flex-1">Bed locked — tap <Unlock className="inline h-3 w-3" /> to make changes</p>
            <button
              onClick={() => onUpdateBed({ ...bed, locked: false })}
              className="text-[10px] font-semibold text-amber-700 underline hover:no-underline"
            >
              Unlock
            </button>
          </div>
        )}

        {/* ── Stamp mode banner — sticky, lives outside the scroll area ── */}
        {stampPlant && (
          <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2 shrink-0 z-10">
            <span className="text-xl">{stampPlant.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-emerald-800">Planting: {stampPlant.name}</p>
              <p className="text-[10px] text-emerald-600">Tap empty cells to repeat · tap a different cell to change</p>
            </div>
            <button
              onClick={handleClearStamp}
              className="shrink-0 text-xs font-semibold bg-red-600 text-white border border-red-600 rounded-lg px-2 py-1 hover:bg-red-700 active:bg-red-800 transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {/* ── Scrollable body — bed grid and everything below it ── */}
        <div className="flex-1 overflow-y-auto min-h-0">

        {/* ── Bed grid ── */}
        <div className="px-4 py-3 border-b border-border/50 shrink-0">
          {movingCell ? (
            <p className="text-[10px] text-primary font-semibold mb-2">
              Moving {movingCell.plant.emoji} {movingCell.plant.name} — tap an empty cell to place · tap source to cancel
            </p>
          ) : !stampPlant ? (
            <p className="text-[10px] text-muted-foreground mb-2">
              Tap empty cell to plant · hold to move · double-tap to remove · ⚠ = spacing conflict
            </p>
          ) : null}
          <div
            className="grid gap-1 w-full"
            style={{ gridTemplateColumns: `repeat(${bed.widthCells}, 1fr)` }}
          >
            {Array.from({ length: bed.heightCells }).flatMap((_, row) =>
              Array.from({ length: bed.widthCells }).map((_, col) => {
                const key = `${col},${row}`;
                const cell = cellMap.get(key);
                const isSelected = selectedCell?.col === col && selectedCell?.row === row;
                const isSpacingBlocked = !cell && spacingBlockedCells.has(key);
                const isStampTarget = stampPlant && !cell && !isSpacingBlocked;
                const isMovingSource = movingCell?.col === col && movingCell?.row === row;
                const isMoveTarget = movingCell && !cell && !isSpacingBlocked;

                return (
                  <button
                    key={key}
                    onClick={() => handleCellClick(col, row)}
                    onPointerDown={e => handleCellPointerDown(col, row, e)}
                    onPointerUp={handleCellPointerUp}
                    onPointerCancel={handleCellPointerUp}
                    title={isSpacingBlocked ? 'Too close — within another plant\'s spacing zone' : undefined}
                    style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
                    className={`
                      aspect-square rounded-lg border-2 flex flex-col items-center justify-center transition-all select-none
                      ${isMovingSource
                        ? 'border-primary bg-primary/20 scale-95 ring-2 ring-primary/40'
                        : isMoveTarget
                          ? 'border-dashed border-primary/60 bg-primary/5 hover:bg-primary/10'
                          : cell
                            ? isSelected
                              ? 'border-destructive bg-destructive/10'
                              : movingCell
                                ? 'border-border/40 bg-muted/10 opacity-50'
                                : 'border-primary/40 bg-primary/5 hover:bg-primary/10'
                            : isSpacingBlocked
                              ? 'border-dashed border-amber-400 bg-amber-50 cursor-not-allowed'
                              : isStampTarget
                                ? 'border-dashed border-emerald-400 bg-emerald-50 hover:bg-emerald-100'
                                : isSelected
                                  ? 'border-emerald-500 bg-emerald-50'
                                  : 'border-dashed border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-primary/40'
                      }
                    `}
                  >
                    {cell ? (() => {
                      const isHarvested = cell.placedPlant.stage === 'harvested';
                      return (
                        <div className={`relative flex flex-col items-center justify-center w-full h-full ${isHarvested ? 'opacity-50' : ''}`}>
                          {/* Info button */}
                          <button
                            className="absolute top-0 left-0 w-4 h-4 rounded-br-md bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center hover:bg-primary/40 transition-colors z-10"
                            onClick={e => { e.stopPropagation(); setInfoPlant(cell.placedPlant); }}
                            title={`Info: ${cell.plant.name}`}
                          >
                            i
                          </button>
                          {isHarvested && (
                            <span className="absolute top-0 right-0 text-[8px] leading-none" title="Harvested">🌾</span>
                          )}
                          <span className={`text-xl leading-none sm:text-2xl ${isMovingSource ? 'scale-110' : ''}`}>{cell.plant.emoji}</span>
                          <span className="text-[7px] sm:text-[8px] leading-tight text-center text-foreground/80 px-0.5 line-clamp-2 mt-0.5">
                            {cell.plant.name}
                          </span>
                        </div>
                      );
                    })() : isMovingSource ? null
                      : isMoveTarget ? (
                      <span className="text-lg leading-none opacity-40">{movingCell!.plant.emoji}</span>
                    ) : isSpacingBlocked ? (
                      <span className="text-amber-400 text-base leading-none">⚠</span>
                    ) : isStampTarget ? (
                      <span className="text-lg leading-none opacity-30">{stampPlant.emoji}</span>
                    ) : (
                      <span className="text-muted-foreground/20 text-lg">+</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Cell action area ── */}
        {selectedCell && !stampPlant && (
          <div className="border-b border-border/50 shrink-0">
            {selectedCell.kind === 'planted' ? (
              /* Occupied: plant info + remove */
              <div className="px-4 py-3 flex items-center gap-3">
                <span className="text-3xl">{selectedCell.plant.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{selectedCell.plant.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      const sow = getSowingStatus(selectedCell.plant, effectiveMonth);
                      if (sow.sowOutdoorsNow) return '🌿 Sow outdoors now';
                      if (sow.sowIndoorsNow) return '🏠 Sow indoors now';
                      return 'Out of season this month';
                    })()}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={() => setInfoPlant(selectedCell.placedPlant)}>
                  <Info className="h-3.5 w-3.5 mr-1" /> Info
                </Button>
                <Button variant="destructive" size="sm" className="h-8 text-xs shrink-0" onClick={handleRemoveFromCell}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                </Button>
              </div>
            ) : (
              /* Empty: plant picker */
              <div className="px-4 pt-3 pb-2">
                {/* 3-state segmented control */}
                <div className="flex rounded-lg border border-border overflow-hidden mb-2 text-[10px] font-semibold">
                  {rotationAllowedGroups && (
                    <button
                      onClick={() => setPickerMode('rotation')}
                      className={`flex-1 py-1.5 transition-colors ${
                        pickerMode === 'rotation'
                          ? `${GARDEN_ROTATION[bed.rotationSlot! - 1].color} border-r border-current`
                          : 'bg-background text-muted-foreground hover:bg-muted border-r border-border'
                      }`}
                    >
                      {GARDEN_ROTATION[bed.rotationSlot! - 1].emoji} {GARDEN_ROTATION[bed.rotationSlot! - 1].label}
                    </button>
                  )}
                  <button
                    onClick={() => setPickerMode('season')}
                    className={`flex-1 py-1.5 transition-colors ${
                      pickerMode === 'season'
                        ? 'bg-emerald-50 text-emerald-700 border-r border-emerald-200'
                        : 'bg-background text-muted-foreground hover:bg-muted border-r border-border'
                    }`}
                  >
                    {monthName}
                  </button>
                  <button
                    onClick={() => setPickerMode('all')}
                    className={`flex-1 py-1.5 transition-colors ${
                      pickerMode === 'all'
                        ? 'bg-muted text-foreground'
                        : 'bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    All
                  </button>
                </div>

                {/* Result count label */}
                <p className="text-[10px] text-muted-foreground mb-2">
                  {pickerMode === 'all'
                    ? `All plants (${pickerPlants.length})`
                    : pickerMode === 'rotation' && rotationAllowedGroups
                      ? `${GARDEN_ROTATION[bed.rotationSlot! - 1].label} — ${rotationGroupPlants.filter(p => getSowingStatus(p, effectiveMonth).canSowNow).length} ready now, ${rotationGroupPlants.filter(p => !getSowingStatus(p, effectiveMonth).canSowNow).length} out of season`
                      : `${monthName} in season (${inSeasonPlants.length})`
                  }
                </p>

                {/* Search */}
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={pickerSearch}
                    onChange={e => setPickerSearch(e.target.value)}
                    placeholder={
                      pickerMode === 'all' ? 'Search all plants…'
                      : pickerMode === 'rotation' && rotationAllowedGroups
                        ? `Search ${GARDEN_ROTATION[bed.rotationSlot! - 1].label} plants…`
                        : `Search ${monthName} plants…`
                    }
                    className="pl-8 h-8 text-xs rounded-lg"
                    autoFocus
                  />
                </div>

                {pickerPlants.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3 italic">
                    {pickerMode === 'season'
                      ? `Nothing to sow in ${monthName} — try "All"`
                      : 'No plants match — try a different search'}
                  </p>
                )}

                {/* Plant grid */}
                <div className="max-h-52 overflow-y-auto space-y-2">
                  {(() => {
                    if (pickerMode === 'rotation' && rotationAllowedGroups && !pickerSearch) {
                      const inSeason = pickerPlants.filter(p => getSowingStatus(p, effectiveMonth).canSowNow);
                      const outOfSeason = pickerPlants.filter(p => !getSowingStatus(p, effectiveMonth).canSowNow);
                      const PlantButton = (plant: typeof pickerPlants[0], dim = false) => {
                        const sow = getSowingStatus(plant, effectiveMonth);
                        return (
                          <button
                            key={plant.id}
                            onClick={() => handlePickPlant(plant)}
                            className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-colors ${dim ? 'opacity-40 hover:opacity-80' : 'hover:bg-muted active:bg-muted/80'}`}
                          >
                            <span className="text-xl leading-none">{plant.emoji}</span>
                            {sow.canSowNow ? (
                              <span className={`text-[7px] px-1 rounded-full font-semibold leading-none ${
                                sow.sowOutdoorsNow ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {sow.sowOutdoorsNow ? '🌿 Plant' : '🏠 Sow'}
                              </span>
                            ) : (
                              <span className="text-[7px] leading-none text-muted-foreground/30">–</span>
                            )}
                            <span className="text-[8px] text-center leading-tight text-foreground line-clamp-2">{plant.name}</span>
                          </button>
                        );
                      };
                      return (
                        <>
                          {inSeason.length > 0 && (
                            <div>
                              <p className="text-[9px] font-semibold text-emerald-700 uppercase tracking-wide mb-1 px-0.5">
                                🌿 Sow or plant now
                              </p>
                              <div className="grid grid-cols-4 sm:grid-cols-5 gap-1">
                                {inSeason.map(p => PlantButton(p, false))}
                              </div>
                            </div>
                          )}
                          {outOfSeason.length > 0 && (
                            <div>
                              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 px-0.5">
                                Out of season — plan ahead
                              </p>
                              <div className="grid grid-cols-4 sm:grid-cols-5 gap-1">
                                {outOfSeason.map(p => PlantButton(p, true))}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    }
                    // Season / All mode or searching: flat grid
                    return (
                      <div className="grid grid-cols-4 sm:grid-cols-5 gap-1">
                        {pickerPlants.slice(0, 80).map(plant => {
                          const sow = getSowingStatus(plant, effectiveMonth);
                          return (
                            <button
                              key={plant.id}
                              onClick={() => handlePickPlant(plant)}
                              className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors"
                            >
                              <span className="text-xl leading-none">{plant.emoji}</span>
                              {sow.canSowNow ? (
                                <span className={`text-[7px] px-1 rounded-full font-semibold leading-none ${
                                  sow.sowOutdoorsNow ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {sow.sowOutdoorsNow ? '🌿 Plant' : '🏠 Sow'}
                                </span>
                              ) : (
                                <span className="text-[7px] leading-none text-muted-foreground/50">·</span>
                              )}
                              <span className="text-[8px] text-center leading-tight text-foreground line-clamp-2">{plant.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Crop rotation (collapsible) ── */}
        <div className="px-4 py-2 border-b border-border/50 shrink-0">
          <button
            onClick={() => setShowRotation(v => !v)}
            className="flex items-center gap-1.5 w-full text-left py-1"
          >
            {showRotation
              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            }
            <span className="text-xs font-semibold text-muted-foreground">Crop Rotation</span>
            {bed.rotationSlot != null && (() => {
              const entry = getRotationEntry(slotGroupName(bed.rotationSlot!));
              return entry ? (
                <Badge className={`ml-2 text-[10px] px-1.5 py-0 ${entry.color}`}>
                  {entry.emoji} {entry.label}
                </Badge>
              ) : null;
            })()}
            {bed.rotationSlot == null && currentGroup && (() => {
              const entry = getRotationEntry(currentGroup);
              return (
                <Badge className={`ml-2 text-[10px] px-1.5 py-0 ${rotationColor(currentGroup)}`}>
                  {entry?.emoji} {ROTATION_GROUP_LABELS[currentGroup] ?? currentGroup}
                </Badge>
              );
            })()}
            <span className="text-xs ml-auto">{rotationStatus === 'good' ? '✅' : '⚠️'}</span>
          </button>

          {showRotation && (
            <div className="mt-2 space-y-3 pb-1">

              {/* ── Next-year preview / no-slot hint ── */}
              {bed.rotationSlot != null ? (() => {
                const curr = getRotationEntry(slotGroupName(bed.rotationSlot!))!;
                const next = getRotationEntry(slotGroupName(bed.rotationSlot! % 4 + 1))!;
                return (
                  <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted-foreground">
                    <span className={`px-1.5 py-0.5 rounded-full font-semibold ${curr.color}`}>{curr.emoji} {curr.label}</span>
                    <span>→ next year →</span>
                    <span className={`px-1.5 py-0.5 rounded-full font-semibold ${next.color}`}>{next.emoji} {next.label}</span>
                    <button
                      className="ml-auto text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                      onClick={() => {
                        const newSlot = ((bed.rotationSlot ?? 0) % 4) + 1;
                        const dominantGroup = getDominantRotationGroup(getPlantsInBed(bed, placedPlants));
                        const groupForHistory = dominantGroup ?? slotGroupName(newSlot - 1 || 4);
                        const updatedHistory = [
                          ...(bed.rotationHistory ?? []).filter(e => e.year !== currentYear),
                          { year: currentYear, group: groupForHistory },
                        ];
                        onUpdateBed({ ...bed, rotationSlot: newSlot, rotationHistory: updatedHistory });
                      }}
                    >
                      Advance Rotation →
                    </button>
                  </div>
                );
              })() : (
                <p className="text-[10px] text-muted-foreground italic">
                  Set a rotation slot above to auto-fill the 4-year plan for this bed.
                </p>
              )}

              {/* Mismatch: planted crops don't match rotation label */}
              {bed.rotationSlot != null && currentGroup && currentGroup !== slotGroupName(bed.rotationSlot) && (() => {
                const planned = getRotationEntry(slotGroupName(bed.rotationSlot!));
                const actual = getRotationEntry(currentGroup);
                return (
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    ⚠️ Planted crops ({actual?.emoji} {actual?.label ?? currentGroup}) don't match
                    the rotation label ({planned?.emoji} {planned?.label})
                  </div>
                );
              })()}

              {/* ── 7-year rotation table ── */}
              {bed.rotationSlot != null && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">4-year plan</p>
                  <div className="space-y-1">
                    {rotationTable.map((row, i) => {
                      const entry = row.group ? getRotationEntry(row.group) : null;
                      const isCurrent = row.source === 'current';
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs ${isCurrent ? 'bg-primary/10 font-semibold' : ''}`}
                        >
                          <span className="w-10 text-muted-foreground shrink-0">{row.year}</span>
                          {entry ? (
                            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${entry.color}`}>
                              {entry.emoji} {entry.label}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic text-[10px]">—</span>
                          )}
                          {isCurrent && <span className="ml-auto text-[9px] text-primary font-medium">NOW</span>}
                          {row.source === 'history' && <span className="ml-auto text-[9px] text-muted-foreground">📋</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {warnings.map((w, i) => (
                <div key={i} className="p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900">⚠️ {w}</div>
              ))}

              {/* Manual log (only when no slot plan active) */}
              {bed.rotationSlot == null && (
                <>
                  {nextSuggestion && (
                    <div className="p-2 rounded bg-blue-50 border border-blue-100 text-xs text-blue-900">
                      <span className="font-semibold">Next year: </span>
                      {ROTATION_GROUP_LABELS[nextSuggestion.group] ?? nextSuggestion.group} — {nextSuggestion.reason}
                    </div>
                  )}
                  <Button onClick={handleLogThisYear} disabled={!currentGroup} size="sm" className="w-full">
                    Log This Year Manually
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Companion conflicts ── */}
        {bedConflicts.length > 0 && (
          <div className="px-4 py-2 border-b border-border/50 shrink-0">
            <p className="text-[10px] font-semibold text-destructive uppercase tracking-wide mb-1.5 flex items-center gap-1">
              ⚠️ Conflicts in this bed ({bedConflicts.length})
            </p>
            <div className="space-y-1">
              {bedConflicts.map((c, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[10px] bg-destructive/5 border border-destructive/15 rounded-md px-2 py-1.5">
                  <span className="shrink-0">{c.plant1!.emoji} {c.plant1!.name}</span>
                  <span className="text-destructive/60">×</span>
                  <span className="shrink-0">{c.plant2!.emoji} {c.plant2!.name}</span>
                  {c.reason && <span className="text-muted-foreground ml-1 flex-1">— {c.reason}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Notes ── */}
        <div className="px-4 py-3 border-b border-border/50 shrink-0">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Notes</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={() => onUpdateBed({ ...bed, notes: notes.trim() || undefined })}
            disabled={bedLocked}
            placeholder="Add notes about this bed…"
            rows={3}
            className="w-full text-xs rounded-lg border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/50 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* ── Remove bed ── */}
        {!bedLocked && (
          <div className="px-4 py-3 shrink-0">
            <Button
              onClick={() => {
                if (window.confirm(`Remove "${bedName}"?`)) { onRemoveBed(bed.id); onClose(); }
              }}
              variant="destructive" size="sm" className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Remove Bed
            </Button>
          </div>
        )}

        </div>{/* end scrollable body */}
      </DialogContent>

      {/* Plant info panel — opens from the "i" button on each cell */}
      {infoPlant && (
        <PlantInfoPanel
          placed={infoPlant}
          allPlaced={placedPlants}
          onClose={() => setInfoPlant(null)}
          onRemove={(id) => { onRemovePlant(id); setInfoPlant(null); }}
          onUpdatePlaced={onUpdatePlacedPlant}
        />
      )}
    </Dialog>
  );
}
