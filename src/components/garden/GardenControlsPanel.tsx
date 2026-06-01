/**
 * GardenControlsPanel -- minimap + canvas layer controls (legend, rotation toggle, PNG export).
 * Extracted from GardenGrid.tsx.
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { PlacedPlant, PlacedStructure, PlotSettings } from '@/types/garden';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { GardenMinimap } from '../GardenMinimap';

interface GardenControlsPanelProps {
  plants: PlacedPlant[];
  structures: PlacedStructure[];
  shadeZones: Set<string>;
  settings: PlotSettings;
  cols: number;
  rows: number;
  panOffset: { x: number; y: number };
  containerRef: React.RefObject<HTMLDivElement>;
  showSunOverlay: boolean;
  showRotationOverlay: boolean;
  onSetRotationOverlay: (fn: (v: boolean) => boolean) => void;
  layersPanelCollapsed: boolean;
  onSetLayersPanelCollapsed: (fn: (v: boolean) => boolean) => void;
  onNavigate: (pan: { x: number; y: number }) => void;
  mainCanvasRef: React.RefObject<HTMLCanvasElement>;
  controlsPortalRef?: { current: HTMLElement | null };
  isMobile?: boolean;
}

function CanvasLayersContent({
  plants,
  showRotationOverlay,
  onSetRotationOverlay,
  layersPanelCollapsed,
  onSetLayersPanelCollapsed,
  mainCanvasRef,
}: Pick<GardenControlsPanelProps, 'plants' | 'showRotationOverlay' | 'onSetRotationOverlay' | 'layersPanelCollapsed' | 'onSetLayersPanelCollapsed' | 'mainCanvasRef'>) {
  if (plants.length === 0) return null;

  return (
    <div className="rounded border border-border/60 bg-card/90 select-none">
      <button
        onClick={() => onSetLayersPanelCollapsed(v => !v)}
        className="w-full flex items-center justify-between gap-1 hover:bg-muted/50 transition-colors"
        style={{ fontSize: 8, padding: '2px 6px', color: 'hsl(var(--muted-foreground))' }}
      >
        <span>canvas layers</span>
        {layersPanelCollapsed
          ? <ChevronRight className="h-2.5 w-2.5" />
          : <ChevronDown className="h-2.5 w-2.5" />
        }
      </button>
      {!layersPanelCollapsed && (
        <div className="p-2 space-y-1.5 border-t border-border/40">
          {/* Companion arc legend */}
          <div className="flex items-center gap-1.5">
            <svg width="22" height="10" className="shrink-0">
              <path d="M2 8 Q11 2 20 8" stroke="rgba(34,197,94,0.7)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 9, color: 'hsl(var(--muted-foreground))' }}>Companion</span>
          </div>
          {/* Enemy arc legend */}
          <div className="flex items-center gap-1.5">
            <svg width="22" height="10" className="shrink-0">
              <path d="M2 5 Q11 5 20 5" stroke="rgba(239,68,68,0.7)" strokeWidth="1.5" fill="none" strokeDasharray="3,2"/>
            </svg>
            <span style={{ fontSize: 9, color: 'hsl(var(--muted-foreground))' }}>Enemy</span>
          </div>
          {/* Growth ring legend */}
          <div className="flex items-center gap-1.5">
            <svg width="16" height="16" className="shrink-0">
              <circle cx="8" cy="8" r="6" stroke="rgba(0,0,0,0.1)" strokeWidth="2.5" fill="none"/>
              <path d="M8 2 A6 6 0 0 1 14 8" stroke="rgba(34,197,94,0.85)" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 9, color: 'hsl(var(--muted-foreground))' }}>Growth</span>
          </div>
          {/* Rotation toggle */}
          <div className="pt-1 border-t border-border/40">
            <button
              onClick={() => onSetRotationOverlay(v => !v)}
              className={`text-[9px] font-semibold px-2 py-1 rounded w-full transition-colors ${
                showRotationOverlay ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              🔄 {showRotationOverlay ? 'Hide rotation' : 'Show rotation'}
            </button>
          </div>
          {/* Rotation colour key */}
          {showRotationOverlay && (
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pt-0.5">
              {([
                ['legumes', 'rgba(134,239,172,0.8)', 'Legumes'],
                ['brassicas', 'rgba(196,181,253,0.8)', 'Brassicas'],
                ['roots', 'rgba(253,186,116,0.8)', 'Roots'],
                ['alliums', 'rgba(253,224,71,0.8)', 'Alliums'],
                ['solanaceae', 'rgba(252,165,165,0.8)', 'Solanaceae'],
                ['cucurbits', 'rgba(103,232,249,0.8)', 'Cucurbits'],
                ['leafy', 'rgba(167,243,208,0.8)', 'Leafy'],
                ['other', 'rgba(203,213,225,0.8)', 'Other'],
              ] as const).map(([, color, label]) => (
                <div key={label} className="flex items-center gap-1">
                  <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 8, color: 'hsl(var(--muted-foreground))' }} className="truncate">{label}</span>
                </div>
              ))}
            </div>
          )}
          {/* PNG export */}
          <div className="pt-1 border-t border-border/40">
            <button
              onClick={() => {
                const canvas = mainCanvasRef.current;
                if (!canvas) return;
                canvas.toBlob(blob => {
                  if (!blob) return;
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'garden-plan.png';
                  a.click();
                  URL.revokeObjectURL(url);
                }, 'image/png');
              }}
              className="text-[9px] font-semibold px-2 py-1 rounded w-full transition-colors text-muted-foreground hover:bg-muted flex items-center justify-center gap-1"
              title="Download garden as PNG"
            >
              <Download className="h-2.5 w-2.5" /> Save PNG
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function GardenControlsPanel({
  plants,
  structures,
  shadeZones,
  settings,
  cols,
  rows,
  panOffset,
  containerRef,
  showSunOverlay,
  showRotationOverlay,
  onSetRotationOverlay,
  layersPanelCollapsed,
  onSetLayersPanelCollapsed,
  onNavigate,
  mainCanvasRef,
  controlsPortalRef,
  isMobile,
}: GardenControlsPanelProps) {
  // Mobile minimap
  if (isMobile) {
    return (
      <div className="pointer-events-auto absolute z-[35]" style={{ bottom: 72, left: 10 }}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <GardenMinimap
          plants={plants}
          structures={structures}
          shadeZones={shadeZones}
          settings={settings}
          cols={cols}
          rows={rows}
          panOffset={panOffset}
          containerRef={containerRef}
          showSunOverlay={showSunOverlay}
          onNavigate={onNavigate}
        />
      </div>
    );
  }

  // Desktop: portal or overlay mode
  if (controlsPortalRef) {
    // Portal mode -- sidebar panel
    const canvasLayersPanel = (
      <div className="space-y-2">
        <GardenMinimap
          plants={plants}
          structures={structures}
          shadeZones={shadeZones}
          settings={settings}
          cols={cols}
          rows={rows}
          panOffset={panOffset}
          containerRef={containerRef}
          showSunOverlay={showSunOverlay}
          onNavigate={onNavigate}
          sidebarMode
        />
        <CanvasLayersContent
          plants={plants}
          showRotationOverlay={showRotationOverlay}
          onSetRotationOverlay={onSetRotationOverlay}
          layersPanelCollapsed={layersPanelCollapsed}
          onSetLayersPanelCollapsed={onSetLayersPanelCollapsed}
          mainCanvasRef={mainCanvasRef}
        />
      </div>
    );

    if (!controlsPortalRef.current) return null;
    return createPortal(canvasLayersPanel, controlsPortalRef.current);
  }

  // Overlay mode -- absolute positioned on canvas
  return (
    <div
      className="absolute pointer-events-none"
      style={{ bottom: 10, left: 70, right: 10, zIndex: 35, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}
    >
      <div className="pointer-events-auto">
        <CanvasLayersContent
          plants={plants}
          showRotationOverlay={showRotationOverlay}
          onSetRotationOverlay={onSetRotationOverlay}
          layersPanelCollapsed={layersPanelCollapsed}
          onSetLayersPanelCollapsed={onSetLayersPanelCollapsed}
          mainCanvasRef={mainCanvasRef}
        />
      </div>
      <div className="pointer-events-auto">
        <GardenMinimap
          plants={plants}
          structures={structures}
          shadeZones={shadeZones}
          settings={settings}
          cols={cols}
          rows={rows}
          panOffset={panOffset}
          containerRef={containerRef}
          showSunOverlay={showSunOverlay}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}
