/**
 * GardenStructureTile -- renders a single structure (bed, polytunnel, greenhouse, etc.)
 * on the garden grid. Extracted from GardenGrid.tsx.
 */
import React, { useState } from 'react';
import { PlacedPlant, PlacedStructure, PlotSettings } from '@/types/garden';
import { getStructureById } from '@/data/structures';
import { X, Lightbulb, Wand2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { suggestPlantsForBed } from '@/utils/bedPlantSuggestions';
import {
  getPlantsInBed,
  getDominantRotationGroup,
  getRotationWarnings,
  getBedDisplayName,
  GARDEN_ROTATION,
} from '@/utils/bedRotationUtils';

interface GardenStructureTileProps {
  struct: PlacedStructure;
  structures: PlacedStructure[];
  plants: PlacedPlant[];
  settings: PlotSettings;
  cellSize: number;
  isMobile?: boolean;
  isMoving: boolean;
  locked: boolean;
  favouriteIds: string[];
  onRemoveStructure: (id: string) => void;
  onResizeStructure: (id: string, widthCells: number, heightCells: number) => void;
  onResizeStart: (e: React.PointerEvent, structId: string, startW: number, startH: number, edge: 'right' | 'bottom' | 'corner') => void;
  onMoveStart: (e: React.PointerEvent, structId: string, origX: number, origY: number) => void;
  onSelectBed?: (bed: PlacedStructure | null) => void;
  onSmartAutoFill?: (x: number, y: number, w: number, h: number, isContainer: boolean) => void;
  onDragStartPlant: (e: React.DragEvent, plantId: string) => void;
}

// Polytunnel SVG overlay
function PolytunnelOverlay({ bw, bh, cellSize, cellSizeCm }: { bw: number; bh: number; cellSize: number; cellSizeCm: number }) {
  const spacingPx = (160 / cellSizeCm) * cellSize;
  const tk = Math.max(5, cellSize * 0.25);
  const xPos: number[] = [];
  const yPos: number[] = [];
  for (let v = 0; v <= bw + 0.5; v += spacingPx) xPos.push(Math.min(v, bw));
  for (let v = 0; v <= bh + 0.5; v += spacingPx) yPos.push(Math.min(v, bh));
  const landscape = bw >= bh;
  const hoopPositions = landscape ? xPos : yPos;
  const hoopInner = (landscape ? xPos : yPos).filter(v => v > 2 && v < (landscape ? bw : bh) - 2);

  const hoopColor = 'rgba(90,105,90,0.7)';
  const hoopLight = 'rgba(160,180,160,0.5)';

  return (
    <svg width={bw} height={bh} viewBox={`0 0 ${bw} ${bh}`}
         style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
      <rect x="0.5" y="0.5" width={bw - 1} height={bh - 1} fill="none"
            stroke={hoopColor} strokeWidth="2.5" rx="2"/>
      <rect x="2" y="2" width={bw - 4} height={bh - 4} fill="none"
            stroke={hoopLight} strokeWidth="0.5" rx="1"/>
      {hoopPositions.filter(v => v > 0 && v < (landscape ? bw : bh)).map((pos, i) => (
        <g key={`h${i}`}>
          {landscape ? (
            <>
              <line x1={pos} y1={0} x2={pos} y2={bh}
                    stroke={hoopColor} strokeWidth="1.8" opacity="0.45"/>
              <line x1={pos + 1.5} y1={0} x2={pos + 1.5} y2={bh}
                    stroke={hoopLight} strokeWidth="0.5" opacity="0.35"/>
            </>
          ) : (
            <>
              <line x1={0} y1={pos} x2={bw} y2={pos}
                    stroke={hoopColor} strokeWidth="1.8" opacity="0.45"/>
              <line x1={0} y1={pos + 1.5} x2={bw} y2={pos + 1.5}
                    stroke={hoopLight} strokeWidth="0.5" opacity="0.35"/>
            </>
          )}
        </g>
      ))}
      {hoopInner.map((pos, i) => (
        <g key={`ht${i}`}>
          {landscape ? (
            <>
              <rect x={pos - 2} y={0} width={4} height={tk} fill={hoopColor} opacity="0.6" rx="1"/>
              <rect x={pos - 2} y={bh - tk} width={4} height={tk} fill={hoopColor} opacity="0.6" rx="1"/>
            </>
          ) : (
            <>
              <rect x={0} y={pos - 2} width={tk} height={4} fill={hoopColor} opacity="0.6" rx="1"/>
              <rect x={bw - tk} y={pos - 2} width={tk} height={4} fill={hoopColor} opacity="0.6" rx="1"/>
            </>
          )}
        </g>
      ))}
      <rect x="0" y="0" width={tk} height={tk} fill={hoopColor} opacity="0.3" rx="1"/>
      <rect x={bw - tk} y="0" width={tk} height={tk} fill={hoopColor} opacity="0.3" rx="1"/>
      <rect x="0" y={bh - tk} width={tk} height={tk} fill={hoopColor} opacity="0.3" rx="1"/>
      <rect x={bw - tk} y={bh - tk} width={tk} height={tk} fill={hoopColor} opacity="0.3" rx="1"/>
    </svg>
  );
}

// Greenhouse SVG overlay
function GreenhouseOverlay({ bw, bh, cellSize, cellSizeCm }: { bw: number; bh: number; cellSize: number; cellSizeCm: number }) {
  const spacingPx = (60 / cellSizeCm) * cellSize;
  const tk = Math.max(5, cellSize * 0.25);
  const frameColor = 'rgba(90,105,115,0.8)';
  const frameHi = 'rgba(180,200,220,0.45)';
  const ridgeDark = 'rgba(50,65,75,0.75)';
  const ridgeHorizontal = bw >= bh;
  const gablePeak = Math.max(6, Math.min(tk * 2.5, (ridgeHorizontal ? bw : bh) * 0.12));

  // We don't actually use xPos/yPos for greenhouse glazing bars since
  // texture tiling handles it, but we keep corner brackets + frame + ridge.
  void spacingPx; // suppress unused warning

  return (
    <svg width={bw} height={bh} viewBox={`0 0 ${bw} ${bh}`}
         style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
      {/* Two-slope shading */}
      {ridgeHorizontal ? (
        <>
          <rect x={0} y={0} width={bw} height={bh / 2} fill="rgba(255,255,230,0.09)"/>
          <rect x={0} y={bh / 2} width={bw} height={bh / 2} fill="rgba(0,20,50,0.12)"/>
        </>
      ) : (
        <>
          <rect x={0} y={0} width={bw / 2} height={bh} fill="rgba(255,255,230,0.09)"/>
          <rect x={bw / 2} y={0} width={bw / 2} height={bh} fill="rgba(0,20,50,0.12)"/>
        </>
      )}
      <rect x="0.5" y="0.5" width={bw - 1} height={bh - 1} fill="none"
            stroke={frameColor} strokeWidth="2.5" rx="2"/>
      <rect x="2" y="2" width={bw - 4} height={bh - 4} fill="none"
            stroke={frameHi} strokeWidth="0.5" rx="1"/>
      {/* Centre ridge */}
      {ridgeHorizontal ? (
        <>
          <rect x={0} y={bh / 2 - 2.5} width={bw} height={5} fill={ridgeDark}/>
          <line x1={0} y1={bh / 2 - 2.5} x2={bw} y2={bh / 2 - 2.5}
                stroke={frameHi} strokeWidth="0.7" opacity="0.5"/>
        </>
      ) : (
        <>
          <rect x={bw / 2 - 2.5} y={0} width={5} height={bh} fill={ridgeDark}/>
          <line x1={bw / 2 - 2.5} y1={0} x2={bw / 2 - 2.5} y2={bh}
                stroke={frameHi} strokeWidth="0.7" opacity="0.5"/>
        </>
      )}
      {/* Gable peaks */}
      {ridgeHorizontal ? (
        <>
          <path d={`M1,1 L${gablePeak},${bh / 2} L1,${bh - 1}`}
                fill="none" stroke={frameColor} strokeWidth="1.5" opacity="0.55"/>
          <path d={`M${bw - 1},1 L${bw - gablePeak},${bh / 2} L${bw - 1},${bh - 1}`}
                fill="none" stroke={frameColor} strokeWidth="1.5" opacity="0.55"/>
        </>
      ) : (
        <>
          <path d={`M1,1 L${bw / 2},${gablePeak} L${bw - 1},1`}
                fill="none" stroke={frameColor} strokeWidth="1.5" opacity="0.55"/>
          <path d={`M1,${bh - 1} L${bw / 2},${bh - gablePeak} L${bw - 1},${bh - 1}`}
                fill="none" stroke={frameColor} strokeWidth="1.5" opacity="0.55"/>
        </>
      )}
      {/* Corner brackets */}
      <rect x="0" y="0" width={tk} height={tk} fill={frameColor} opacity="0.25" rx="1"/>
      <rect x={bw - tk} y="0" width={tk} height={tk} fill={frameColor} opacity="0.25" rx="1"/>
      <rect x="0" y={bh - tk} width={tk} height={tk} fill={frameColor} opacity="0.25" rx="1"/>
      <rect x={bw - tk} y={bh - tk} width={tk} height={tk} fill={frameColor} opacity="0.25" rx="1"/>
    </svg>
  );
}

export function GardenStructureTile({
  struct,
  structures,
  plants,
  settings,
  cellSize,
  isMobile,
  isMoving,
  favouriteIds,
  onRemoveStructure,
  onResizeStructure,
  onResizeStart,
  onMoveStart,
  onSelectBed,
  onSmartAutoFill,
  onDragStartPlant,
}: GardenStructureTileProps) {
  const [editingStructure, setEditingStructure] = useState(false);
  const data = getStructureById(struct.structureId);
  if (!data) return null;

  const BED_BORDER: Record<string, string> = {
    'raised-bed':  'rgba(55,32,12,0.85)',
    'growing-bed': 'rgba(48,28,10,0.8)',
    'flower-bed':  'rgba(70,30,35,0.8)',
    'herb-bed':    'rgba(28,55,18,0.8)',
    'border':      'rgba(55,35,14,0.8)',
  };

  const isBed = !!data.showCells;
  const isFruitCage = data.id === 'fruit-cage';
  const hasTopSprite = !!data.topSprite;
  const isTiled = !!data.repeatTexture;
  const isDecorativeBorder = data.id === 'polytunnel' || data.id === 'greenhouse';
  const isSoilBed = isBed && !isFruitCage && hasTopSprite;
  const useTextureFill = hasTopSprite && !isBed;
  const spriteUrl = hasTopSprite ? `${import.meta.env.BASE_URL}${data.topSprite}` : undefined;

  const overlayClass = useTextureFill
    ? `overflow-hidden${data.shape === 'circle' ? ' rounded-full' : ''}`
    : isBed
      ? 'border-2 rounded-sm'
      : `border-4 ${data.shape === 'circle' ? 'rounded-full' : 'rounded-md'}`;

  const overlayStyle: React.CSSProperties = {
    left: struct.x * cellSize,
    top: struct.y * cellSize,
    width: struct.widthCells * cellSize,
    height: struct.heightCells * cellSize,
    zIndex: isMoving ? 10 : 1,
    ...(useTextureFill ? {
      backgroundImage: `url("${spriteUrl}")`,
      backgroundSize: data.id === 'greenhouse' ? `${cellSize * 3}px ${cellSize * 3}px` : (isTiled ? '48px 48px' : 'cover'),
      backgroundRepeat: isTiled ? 'repeat' : 'no-repeat',
      backgroundPosition: 'center',
      border: isDecorativeBorder ? 'none' : '1.5px solid rgba(0,0,0,0.25)',
      borderRadius: data.shape === 'circle' ? '50%' : '3px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.08)',
    } : isFruitCage ? {
      backgroundColor: data.color,
      backgroundImage: `url("${spriteUrl}")`,
      backgroundSize: '48px 48px',
      backgroundRepeat: 'repeat',
      border: `2px solid ${BED_BORDER['fruit-cage'] ?? 'rgba(45,45,45,0.9)'}`,
      borderRadius: '3px',
    } : isBed ? {
      backgroundColor: data.color,
      ...(isSoilBed ? {
        backgroundImage: `url("${spriteUrl}")`,
        backgroundSize: '48px 48px',
        backgroundRepeat: 'repeat',
      } : {}),
      borderColor: BED_BORDER[data.id] ?? 'rgba(60,40,20,0.75)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
    } : {
      backgroundColor: data.color,
      borderColor: 'hsl(var(--primary))',
    }),
  };

  const bw = struct.widthCells * cellSize;
  const bh = struct.heightCells * cellSize;

  return (
    <div key={struct.id}>
      <div
        data-structure-tile
        className={`absolute flex flex-col items-center justify-center group cursor-pointer ${overlayClass}`}
        style={overlayStyle}
        title={`${getBedDisplayName(struct, structures)} -- tap to manage, drag to move`}
        onPointerDown={e => onMoveStart(e, struct.id, struct.x, struct.y)}
        onClick={e => { if (!isMoving) { e.stopPropagation(); onSelectBed?.(struct); } }}
      >
        {/* Decorative border */}
        {isDecorativeBorder && (
          data.id === 'polytunnel'
            ? <PolytunnelOverlay bw={bw} bh={bh} cellSize={cellSize} cellSizeCm={settings.cellSizeCm} />
            : <GreenhouseOverlay bw={bw} bh={bh} cellSize={cellSize} cellSizeCm={settings.cellSizeCm} />
        )}
        {!useTextureFill && !isFruitCage && <span className="text-lg">{data.emoji}</span>}
        <span className={(useTextureFill || isFruitCage)
          ? 'text-[9px] font-semibold text-white/90 bg-black/30 px-1.5 py-0.5 rounded backdrop-blur-sm leading-tight'
          : 'text-[10px] font-medium text-foreground/80'
        }>{(() => {
          const bedLabel = struct.name || data.name || data.id;
          if (struct.rotationSlot != null) {
            const entry = GARDEN_ROTATION[struct.rotationSlot - 1];
            return `${entry.emoji} ${entry.label} · ${bedLabel}`;
          }
          return bedLabel;
        })()}</span>
        {struct.notes && (
          <span className="text-[11px] text-foreground/75 px-1 text-center line-clamp-2 max-w-full">{struct.notes}</span>
        )}
        {data.canGrowInside && !data.isContainer && (
          <span className="text-[8px] text-primary font-medium">🌱 Protected</span>
        )}
        {data.isContainer && (
          <span className="text-[8px] text-muted-foreground">{struct.widthCells}x{struct.heightCells}</span>
        )}
        <button
          onClick={e => { e.stopPropagation(); onRemoveStructure(struct.id); setEditingStructure(false); }}
          className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          title="Remove structure"
          data-no-plant-move="true"
        >
          <X className="h-3 w-3" />
        </button>
        {/* Edit size button for containers */}
        {data.isContainer && (
          <button
            onClick={e => { e.stopPropagation(); setEditingStructure(!editingStructure); }}
            className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
            title="Edit size"
            data-no-plant-move="true"
          >
            ✎
          </button>
        )}
        {/* Rotation badge */}
        {(struct.rotationSlot != null || (struct.rotationHistory && struct.rotationHistory.length > 0)) && (() => {
          const bedsInBed = getPlantsInBed(struct, plants);
          const currentGroup = getDominantRotationGroup(bedsInBed);
          const currentYear = new Date().getFullYear();
          const warnings = struct.rotationHistory?.length
            ? getRotationWarnings(struct.rotationHistory, currentYear, currentGroup)
            : [];
          const hasWarning = warnings.length > 0;
          if (struct.rotationSlot != null) {
            const entry = GARDEN_ROTATION[struct.rotationSlot - 1];
            return (
              <div
                className={`absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${entry.color}`}
                title={hasWarning ? 'Rotation issue -- open bed for details' : `Rotation ${struct.rotationSlot}: ${entry.label} · ${currentYear}`}
              >
                <span>{entry.emoji}</span>
                <span>{struct.rotationSlot}</span>
                <span className="opacity-70">·</span>
                <span>{currentYear}</span>
                {hasWarning && <span className="ml-0.5">⚠️</span>}
              </div>
            );
          }
          return (
            <div
              className="absolute top-1 left-1/2 -translate-x-1/2 text-sm font-medium"
              title={hasWarning ? 'Rotation issue -- open bed for details' : 'Rotation OK'}
            >
              {hasWarning ? '⚠️' : '✅'}
            </div>
          );
        })()}
        {/* Standalone auto-fill button */}
        {data.canGrowInside && onSmartAutoFill && (
          <button
            onClick={e => {
              e.stopPropagation();
              onSmartAutoFill(struct.x, struct.y, struct.widthCells, struct.heightCells, !!data.isContainer);
            }}
            className="absolute -bottom-2 -right-2 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
            title="Smart auto-fill with favourites"
            data-no-plant-move="true"
          >
            <Wand2 className="h-3 w-3" />
          </button>
        )}
        {/* Size editor + plant suggestions popover */}
        {editingStructure && (
          <div
            className="absolute -bottom-2 left-0 translate-y-full z-50 bg-card border border-border rounded-lg shadow-lg p-2.5 min-w-[220px]"
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          >
            <button
              onClick={e => { e.stopPropagation(); setEditingStructure(false); }}
              className="absolute top-1.5 right-1.5 h-5 w-5 rounded flex items-center justify-center hover:bg-muted text-muted-foreground"
              title="Close"
            >
              <X className="h-3 w-3" />
            </button>
            {data.isContainer && (
              <div className="flex items-center gap-2 mb-2">
                <label className="text-[10px] text-muted-foreground">W</label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={struct.widthCells}
                  onChange={e => onResizeStructure(struct.id, Math.max(1, Number(e.target.value)), struct.heightCells)}
                  className="w-12 h-6 text-xs text-center"
                />
                <label className="text-[10px] text-muted-foreground">H</label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={struct.heightCells}
                  onChange={e => onResizeStructure(struct.id, struct.widthCells, Math.max(1, Number(e.target.value)))}
                  className="w-12 h-6 text-xs text-center"
                />
              </div>
            )}
            {data.canGrowInside && (
              <div>
                <p className="text-[10px] font-semibold text-foreground flex items-center gap-1 mb-1">
                  <Lightbulb className="h-3 w-3 text-primary" /> Suggested plants
                  {favouriteIds.length > 0 && <span className="text-[8px] text-amber-500 ml-1">★ favourites first</span>}
                </p>
                <p className="text-[9px] text-muted-foreground mb-1.5">
                  {struct.widthCells}x{struct.heightCells} cells ({struct.widthCells * settings.cellSizeCm}x{struct.heightCells * settings.cellSizeCm}cm)
                </p>
                <div className="space-y-0.5 max-h-[120px] overflow-y-auto">
                  {suggestPlantsForBed(struct.widthCells, struct.heightCells, settings.cellSizeCm, data.isContainer, favouriteIds).map(s => (
                    <div
                      key={s.plant.id}
                      className={`flex items-center gap-1.5 text-[10px] px-1.5 py-1 rounded hover:bg-muted cursor-grab ${favouriteIds.includes(s.plant.id) ? 'bg-amber-500/5' : ''}`}
                      draggable
                      onDragStart={e => {
                        onDragStartPlant(e, s.plant.id);
                        setEditingStructure(false);
                      }}
                    >
                      {favouriteIds.includes(s.plant.id) && <span className="text-amber-500 text-[8px]">★</span>}
                      <span>{s.plant.emoji}</span>
                      <span className="font-medium text-foreground">{s.plant.name}</span>
                      <span className="text-muted-foreground ml-auto">{s.reason}</span>
                    </div>
                  ))}
                </div>
                {onSmartAutoFill && favouriteIds.length > 0 && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onSmartAutoFill(struct.x, struct.y, struct.widthCells, struct.heightCells, !!data.isContainer);
                      setEditingStructure(false);
                    }}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 text-[10px] font-semibold px-2 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Wand2 className="h-3 w-3" /> Smart auto-fill
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {/* Show suggestions button for growable non-container structures */}
        {data.canGrowInside && !data.isContainer && (
          <button
            onClick={e => { e.stopPropagation(); setEditingStructure(!editingStructure); }}
            className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
            title="Plant suggestions"
            data-no-plant-move="true"
          >
            💡
          </button>
        )}
        <div
          className={`absolute top-0 -right-1 cursor-ew-resize transition-opacity ${isMobile ? 'w-4 opacity-60' : 'w-2 opacity-0 group-hover:opacity-100'}`}
          style={{ height: '100%', background: 'hsl(var(--primary) / 0.4)', touchAction: 'none' }}
          onPointerDown={e => onResizeStart(e, struct.id, struct.widthCells, struct.heightCells, 'right')}
        />
        <div
          className={`absolute -bottom-1 left-0 w-full cursor-ns-resize transition-opacity ${isMobile ? 'h-4 opacity-60' : 'h-2 opacity-0 group-hover:opacity-100'}`}
          style={{ background: 'hsl(var(--primary) / 0.4)', touchAction: 'none' }}
          onPointerDown={e => onResizeStart(e, struct.id, struct.widthCells, struct.heightCells, 'bottom')}
        />
        <div
          className={`absolute -bottom-1 -right-1 cursor-nwse-resize rounded-sm transition-opacity ${isMobile ? 'w-5 h-5 opacity-80' : 'w-3 h-3 opacity-0 group-hover:opacity-100'}`}
          style={{ background: 'hsl(var(--primary) / 0.6)', touchAction: 'none' }}
          onPointerDown={e => onResizeStart(e, struct.id, struct.widthCells, struct.heightCells, 'corner')}
        />
      </div>
    </div>
  );
}
