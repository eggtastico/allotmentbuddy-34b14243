/**
 * Garden Render Worker — runs all 6 canvas draw passes off the main thread.
 *
 * The worker maintains its own OffscreenCanvas and emoji caches. On each render
 * request it draws the complete frame and posts back an ImageBitmap for the main
 * thread to blit onto the real <canvas> element (preserving toDataURL support).
 *
 * Message flow:
 *   Main → Worker: { type: 'render', id, state }
 *   Worker → Main: { type: 'frame', id, bitmap: ImageBitmap }
 *   Worker → Main: { type: 'sprites-ready' }  (when new Twemoji bitmaps load)
 */

import { getPlantById } from '@/data/plants';
import { getStructureById } from '@/data/structures';
import { getSunExposure } from '@/utils/sunCalculator';
import { categoryColors, categoryColorsDark, getCompanionReason } from '@/data/companionReasons';
import type { PlacedPlant, PlacedStructure } from '@/types/garden';
import type { CompanionInfo } from './gardenCompute.worker';

// ── Path2D cache (worker-local, cannot be transferred) ───────────────────────
const path2DCache = new Map<string, Path2D>();
function getCachedPath2D(w: number, h: number, r: number): Path2D {
  const key = `${Math.round(w)}_${Math.round(h)}_${Math.round(r * 10)}`;
  if (!path2DCache.has(key)) {
    const p = new Path2D();
    const minR = Math.min(r, w / 2, h / 2);
    p.moveTo(minR, 0); p.arcTo(w, 0, w, h, minR);
    p.arcTo(w, h, 0, h, minR); p.arcTo(0, h, 0, 0, minR);
    p.arcTo(0, 0, w, 0, minR); p.closePath();
    path2DCache.set(key, p);
  }
  return path2DCache.get(key)!;
}

function roundRect(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const minR = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + minR, y);
  ctx.arcTo(x + w, y, x + w, y + h, minR);
  ctx.arcTo(x + w, y + h, x, y + h, minR);
  ctx.arcTo(x, y + h, x, y, minR);
  ctx.arcTo(x, y, x + w, y, minR);
  ctx.closePath();
}

// ── OffscreenCanvas emoji atlas (worker-local) ───────────────────────────────
const emojiCache = new Map<string, OffscreenCanvas>();
function getCachedEmoji(emoji: string, size: number): OffscreenCanvas {
  const key = `${emoji}_${Math.round(size)}`;
  if (!emojiCache.has(key)) {
    const s = Math.ceil(size * 1.5);
    const c = new OffscreenCanvas(s, s);
    const cx = c.getContext('2d');
    if (cx) {
      cx.font = `${size}px sans-serif`;
      cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText(emoji, s / 2, s / 2);
    }
    emojiCache.set(key, c);
  }
  return emojiCache.get(key)!;
}

// ── Worker-local Twemoji cache ───────────────────────────────────────────────
const twemojiCache = new Map<string, ImageBitmap>();
const twemojiErrors = new Set<string>();
const twemojiPending = new Map<string, Promise<void>>();

function getEmojiUrl(emoji: string): string {
  const cps: string[] = [];
  for (const ch of [...emoji]) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && cp !== 0xFE0F) cps.push(cp.toString(16));
  }
  return `https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/${cps.join('-')}.png`;
}

async function loadTwemoji(emoji: string): Promise<void> {
  if (twemojiCache.has(emoji) || twemojiErrors.has(emoji)) return;
  if (twemojiPending.has(emoji)) return twemojiPending.get(emoji);
  const p = (async () => {
    try {
      const resp = await fetch(getEmojiUrl(emoji));
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      twemojiCache.set(emoji, await createImageBitmap(await resp.blob()));
    } catch {
      twemojiErrors.add(emoji);
    } finally {
      twemojiPending.delete(emoji);
    }
  })();
  twemojiPending.set(emoji, p);
  return p;
}

// ── Worker-local custom sprite cache ─────────────────────────────────────────
const customSpriteCache = new Map<string, ImageBitmap>();
const customSpriteErrors = new Set<string>();

async function loadCustomSprite(relPath: string, baseUrl: string): Promise<void> {
  if (customSpriteCache.has(relPath) || customSpriteErrors.has(relPath)) return;
  try {
    const resp = await fetch(`${baseUrl}${relPath}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    customSpriteCache.set(relPath, await createImageBitmap(await resp.blob()));
  } catch {
    customSpriteErrors.add(relPath);
  }
}

// ── Static layer cache (worker-local) ────────────────────────────────────────
let staticBitmap: ImageBitmap | null = null;
let staticBitmapKey = '';

// ── Shade mask cache (worker-local) ──────────────────────────────────────────
let shadeMask: OffscreenCanvas | null = null;
let shadeMaskZones: string[] | null = null;

export type RenderState = {
  id: number;
  gridW: number; gridH: number;
  cols: number; rows: number; cellSize: number;
  isDark: boolean;
  themeColors: { bgColor: string; primaryColor: string };
  plants: PlacedPlant[];
  structures: PlacedStructure[];
  shadeZonesArr: string[];
  showSunOverlay: boolean;
  showRotationOverlay: boolean;
  showColorCoding: boolean;
  companionMapEntries: [string, CompanionInfo][];
  spacingConflictsEntries: [string, string[]][];
  spatialBucketsEntries: [string, PlacedPlant[]][];
  baseUrl: string;
  // Viewport culling hints from main thread
  vpLeft: number; vpTop: number; vpRight: number; vpBottom: number;
};

async function render(state: RenderState): Promise<ImageBitmap> {
  const {
    gridW, gridH, cols, rows, cellSize, isDark, themeColors,
    plants, structures, shadeZonesArr, showSunOverlay, showRotationOverlay,
    showColorCoding, companionMapEntries, spacingConflictsEntries, spatialBucketsEntries,
    vpLeft, vpTop, vpRight, vpBottom, baseUrl,
  } = state;

  const dpr = 2; // Worker always renders at 2× for quality
  const canvas = new OffscreenCanvas(gridW * dpr, gridH * dpr);
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;

  const companionMap = new Map(companionMapEntries);
  const spacingConflicts = new Map(spacingConflictsEntries);
  const spatialBuckets = new Map(spatialBucketsEntries);
  const shadeZones = new Set(shadeZonesArr);

  const inViewport = (px: number, py: number) =>
    px >= vpLeft && px < vpRight && py >= vpTop && py < vpBottom;

  ctx.reset?.();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.save();
  roundRect(ctx, 0, 0, gridW, gridH, 8);
  ctx.clip();

  const { bgColor, primaryColor } = themeColors;

  // Static layer
  const staticKey = `${gridW},${gridH},${cols},${rows},${cellSize},${bgColor}`;
  if (!staticBitmap || staticBitmapKey !== staticKey) {
    const sl = new OffscreenCanvas(gridW * dpr, gridH * dpr);
    const sCtx = sl.getContext('2d') as OffscreenCanvasRenderingContext2D;
    sCtx.scale(dpr, dpr);
    sCtx.fillStyle = bgColor; sCtx.fillRect(0, 0, gridW, gridH);
    sCtx.beginPath();
    sCtx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
    sCtx.lineWidth = 0.5;
    for (let c = 1; c < cols; c++) { if (c % 5 === 0) continue; sCtx.moveTo(c * cellSize, 0); sCtx.lineTo(c * cellSize, gridH); }
    for (let r = 1; r < rows; r++) { if (r % 5 === 0) continue; sCtx.moveTo(0, r * cellSize); sCtx.lineTo(gridW, r * cellSize); }
    sCtx.stroke();
    sCtx.beginPath();
    sCtx.strokeStyle = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)';
    sCtx.lineWidth = 1;
    for (let c = 5; c <= cols; c += 5) { sCtx.moveTo(c * cellSize, 0); sCtx.lineTo(c * cellSize, gridH); }
    for (let r = 5; r <= rows; r += 5) { sCtx.moveTo(0, r * cellSize); sCtx.lineTo(gridW, r * cellSize); }
    sCtx.stroke();
    staticBitmap?.close();
    staticBitmap = sl.transferToImageBitmap();
    staticBitmapKey = staticKey;
  }
  ctx.drawImage(staticBitmap, 0, 0, gridW, gridH);

  // Structure fills
  for (const struct of structures) {
    const data = getStructureById(struct.structureId);
    if (!data?.showCells) continue;
    ctx.fillStyle = data.color; ctx.globalAlpha = 0.4;
    for (let row = 0; row < struct.heightCells; row++) {
      for (let col = 0; col < struct.widthCells; col++) {
        roundRect(ctx, (struct.x + col) * cellSize + 1, (struct.y + row) * cellSize + 1, cellSize - 2, cellSize - 2, 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Sun/shade overlay
  if (showSunOverlay && shadeZones.size > 0) {
    const zoneKey = shadeZonesArr.join(',');
    if (!shadeMask || shadeMaskZones?.join(',') !== zoneKey || shadeMask.width !== gridW || shadeMask.height !== gridH) {
      const mask = new OffscreenCanvas(gridW, gridH);
      const sCtx = mask.getContext('2d') as OffscreenCanvasRenderingContext2D;
      const exposureColorMap: Record<string, string> = {
        'full-sun': 'hsla(45,100%,60%,0.30)',
        'partial-shade': 'hsla(200,60%,60%,0.25)',
        'full-shade': 'hsla(220,20%,50%,0.30)',
      };
      const byExposure = new Map<string, Array<[number, number]>>();
      for (const key of shadeZones) {
        const [sx, sy] = key.split(',').map(Number);
        const exposure = getSunExposure(sx, sy, shadeZones);
        if (!byExposure.has(exposure)) byExposure.set(exposure, []);
        byExposure.get(exposure)!.push([sx, sy]);
      }
      for (const [exposure, cells] of byExposure) {
        sCtx.fillStyle = exposureColorMap[exposure] ?? 'transparent';
        for (const [sx, sy] of cells) sCtx.fillRect(sx * cellSize, sy * cellSize, cellSize, cellSize);
      }
      shadeMask = mask;
      shadeMaskZones = shadeZonesArr;
    }
    const blurPx = Math.max(Math.round(cellSize * 0.55), 3);
    (ctx as any).filter = `blur(${blurPx}px)`;
    ctx.drawImage(shadeMask, 0, 0);
    (ctx as any).filter = 'none';
  }

  // Rotation heatmap
  if (showRotationOverlay && plants.length > 0) {
    const RC: Record<string, string> = {
      legumes: 'rgba(134,239,172,0.5)', brassicas: 'rgba(196,181,253,0.5)',
      roots: 'rgba(253,186,116,0.5)', alliums: 'rgba(253,224,71,0.5)',
      solanaceae: 'rgba(252,165,165,0.5)', cucurbits: 'rgba(103,232,249,0.5)',
      leafy: 'rgba(167,243,208,0.5)', other: 'rgba(203,213,225,0.5)',
    };
    const byGroup = new Map<string, PlacedPlant[]>();
    for (const plant of plants) {
      const pData = getPlantById(plant.plantId);
      if (!pData) continue;
      const group = pData.rotationGroup ?? 'other';
      if (!byGroup.has(group)) byGroup.set(group, []);
      byGroup.get(group)!.push(plant);
    }
    for (const [group, groupPlants] of byGroup) {
      ctx.fillStyle = RC[group] ?? RC.other;
      for (const plant of groupPlants) {
        if (!inViewport(Math.floor(plant.x), Math.floor(plant.y))) continue;
        ctx.fillRect(Math.floor(plant.x) * cellSize, Math.floor(plant.y) * cellSize, cellSize, cellSize);
      }
    }
  }

  // Preload sprites for any new plants before rendering
  const plantDatas = plants.map(p => getPlantById(p.plantId)).filter(Boolean);
  const emojis = [...new Set(plantDatas.map(p => p!.emoji))];
  const sprites = [...new Set(plantDatas.map(p => p!.sprite).filter((s): s is string => Boolean(s)))];
  let spritesLoaded = false;
  await Promise.all([
    ...emojis.map(async e => { const before = twemojiCache.size; await loadTwemoji(e); if (twemojiCache.size > before) spritesLoaded = true; }),
    ...sprites.map(async s => { const before = customSpriteCache.size; await loadCustomSprite(s, baseUrl); if (customSpriteCache.size > before) spritesLoaded = true; }),
  ]);
  if (spritesLoaded) {
    (self as unknown as Worker).postMessage({ type: 'sprites-ready' });
  }

  // Plant tile passes A–F
  const hasLabel = cellSize >= 28;
  const tilePath = getCachedPath2D(cellSize - 2, cellSize - 2, 5);
  const sortedPlants = [...plants].sort((a, b) => {
    const aD = getPlantById(a.plantId), bD = getPlantById(b.plantId);
    return (aD?.category ?? '').localeCompare(bD?.category ?? '');
  });

  interface TileMeta {
    placed: PlacedPlant; plantData: NonNullable<ReturnType<typeof getPlantById>>;
    px: number; py: number; pw: number; ph: number;
    tileBg: string; hasHighlight: boolean;
    relations: CompanionInfo | undefined; spacingIssues: string[] | undefined;
    growthPct: number; emojiSize: number; emojiOffsetY: number;
  }
  const tileMetas: TileMeta[] = [];
  for (const placed of sortedPlants) {
    const plantData = getPlantById(placed.plantId);
    if (!plantData) continue;
    const aw = placed.areaW ?? 1, ah = placed.areaH ?? 1;
    const ax = Math.floor(placed.x), ay = Math.floor(placed.y);
    // Viewport: any part of the area must be visible
    if (ax + aw <= vpLeft || ax >= vpRight || ay + ah <= vpTop || ay >= vpBottom) continue;
    const relations = companionMap.get(placed.id);
    const spacingIssues = spacingConflicts.get(placed.id);
    const catColor = showColorCoding ? (isDark ? categoryColorsDark[plantData.category] : categoryColors[plantData.category]) : undefined;
    const tileBg = isDark
      ? (relations?.hasEnemy ? 'hsl(0 30% 14%)' : relations?.hasCompanion ? 'hsl(142 25% 14%)' : catColor || 'hsl(25 20% 12%)')
      : (relations?.hasEnemy ? 'hsl(0 60% 95%)' : relations?.hasCompanion ? 'hsl(142 40% 93%)' : catColor || 'hsl(25 30% 94%)');
    const hasHighlight = Boolean(relations?.hasEnemy || relations?.hasCompanion || spacingIssues?.length);
    const px = ax * cellSize, py = ay * cellSize;
    const pw = aw * cellSize, ph = ah * cellSize;
    const days = placed.plantedAt ? Math.floor((Date.now() - new Date(placed.plantedAt).getTime()) / 86400000) : 0;
    const isEst = placed.stage === 'established';
    const growthPct = isEst ? 1 : placed.stage === 'seedling' ? 0.3 : Math.min(1, days / (plantData.daysToHarvest ?? 90));
    // For area plants: emoji fills most of the shorter dimension; for single cells: fixed scale
    const emojiSize = aw > 1 || ah > 1
      ? Math.max(Math.min(pw, ph) * 0.82, 20)
      : Math.max(cellSize * (0.88 + Math.min(0.1, growthPct * 0.1)), 18);
    const emojiOffsetY = aw > 1 || ah > 1 ? 0 : (hasLabel ? -3 : 0);
    tileMetas.push({ placed, plantData, px, py, pw, ph, tileBg, hasHighlight, relations, spacingIssues, growthPct, emojiSize, emojiOffsetY });
  }

  // Pass A: normal fills, batched by bg colour
  const normalByBg = new Map<string, TileMeta[]>();
  for (const m of tileMetas) {
    if (m.hasHighlight) continue;
    if (!normalByBg.has(m.tileBg)) normalByBg.set(m.tileBg, []);
    normalByBg.get(m.tileBg)!.push(m);
  }
  for (const [bg, group] of normalByBg) {
    ctx.fillStyle = bg;
    ctx.shadowColor = 'rgba(0,0,0,0.10)'; ctx.shadowBlur = 2;
    ctx.beginPath();
    for (const { px, py, pw, ph } of group) roundRect(ctx, px + 1, py + 1, pw - 2, ph - 2, 5);
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
  }

  // Pass B: highlighted fills
  for (const { px, py, pw, ph, tileBg, relations, spacingIssues } of tileMetas) {
    if (!relations?.hasEnemy && !relations?.hasCompanion && !spacingIssues?.length) continue;
    ctx.save(); ctx.translate(px + 1, py + 1);
    if (relations?.hasEnemy) { ctx.shadowColor = 'rgba(239,68,68,0.35)'; ctx.shadowBlur = 8; }
    else if (relations?.hasCompanion) { ctx.shadowColor = 'rgba(34,197,94,0.3)'; ctx.shadowBlur = 8; }
    else { ctx.shadowColor = 'rgba(245,158,11,0.4)'; ctx.shadowBlur = 8; }
    ctx.fillStyle = tileBg;
    ctx.fill(pw === cellSize && ph === cellSize ? tilePath : getCachedPath2D(pw - 2, ph - 2, 5));
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.restore();
  }

  // Pass C: emoji / sprites — centred in the full area
  for (const { plantData, px, py, pw, ph, emojiSize, emojiOffsetY } of tileMetas) {
    const customBm = plantData.sprite ? customSpriteCache.get(plantData.sprite) : undefined;
    const twBm = !customBm ? twemojiCache.get(plantData.emoji) : undefined;
    const cx = px + pw / 2, cy = py + ph / 2;
    if (customBm || twBm) {
      const s = Math.round(emojiSize);
      ctx.drawImage((customBm ?? twBm)!, cx - s / 2, cy + emojiOffsetY - s / 2, s, s);
    } else {
      const img = getCachedEmoji(plantData.emoji, emojiSize);
      ctx.drawImage(img, cx - img.width / 2, cy + emojiOffsetY - img.height / 2);
    }
  }

  // Pass D: name labels — centred at bottom of area
  if (hasLabel) {
    ctx.font = '600 7px system-ui,sans-serif';
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (const { plantData, px, py, pw, ph } of tileMetas) {
      const name = plantData.name.length > 6 ? plantData.name.slice(0, 5) + '…' : plantData.name;
      ctx.fillText(name, px + pw / 2, py + ph - 2);
    }
  }

  // Pass E: stage badges — top-left corner
  ctx.font = '8px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  for (const { placed, px, py } of tileMetas) {
    const badge = placed.stage === 'seedling' ? '🌱' : placed.stage === 'established' ? '🌳' : '🌰';
    ctx.fillText(badge, px + 1, py + 1);
  }

  // Pass E.5: quantity badge — top-right corner of area
  if (cellSize >= 16) {
    ctx.font = `bold ${Math.max(7, Math.round(cellSize * 0.22))}px system-ui,sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const { placed, px, py, pw } of tileMetas) {
      const qty = placed.quantity ?? 1;
      if (qty <= 1) continue;
      const text = `×${qty}`;
      const tw = ctx.measureText(text).width;
      const bw = Math.round(tw + 5);
      const bh = Math.max(9, Math.round(cellSize * 0.28));
      const bx = px + pw - bw - 1;
      const by = py + 1;
      roundRect(ctx, bx, by, bw, bh, 3);
      ctx.fillStyle = primaryColor; ctx.fill();
      ctx.fillStyle = 'white';
      ctx.fillText(text, bx + bw / 2, by + bh / 2);
    }
  }

  // Pass F: bottom badges — centred at bottom of area
  if (cellSize >= 20) {
    for (const { plantData, px, py, pw, ph, relations, spacingIssues } of tileMetas) {
      let badgeText = '', badgeBg = '';
      if (spacingIssues?.length && !relations?.hasEnemy) { badgeText = '↔ Too close'; badgeBg = 'hsl(38 92% 50%)'; }
      else if (relations?.hasEnemy && relations.enemyNames.length > 0) { badgeText = `❌ ${relations.enemyNames[0]}`; badgeBg = 'hsl(0 84% 60%)'; }
      else if (relations?.hasCompanion && !relations.hasEnemy && relations.companionNames.length > 0 && cellSize >= 24) { badgeText = `✅ ${relations.companionNames[0]}`; badgeBg = primaryColor; }
      if (!badgeText) continue;
      ctx.font = '600 6px system-ui,sans-serif';
      const bw = Math.min(ctx.measureText(badgeText).width + 4, pw - 2);
      const bh = 9;
      const bx = px + (pw - bw) / 2, by = py + ph - bh - 2;
      roundRect(ctx, bx, by, bw, bh, 2);
      ctx.fillStyle = badgeBg; ctx.fill();
      ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, bx + bw / 2, by + bh / 2);
    }
  }

  // Growth rings — centred in the full area
  for (const plant of plants) {
    const aw = plant.areaW ?? 1, ah = plant.areaH ?? 1;
    const ax = Math.floor(plant.x), ay = Math.floor(plant.y);
    if (ax + aw <= vpLeft || ax >= vpRight || ay + ah <= vpTop || ay >= vpBottom) continue;
    const plantData = getPlantById(plant.plantId);
    if (!plantData) continue;
    const pw = aw * cellSize, ph = ah * cellSize;
    const radius = Math.min(pw, ph) / 2 - 2.5;
    if (radius < 5) continue;
    const days = plant.plantedAt ? Math.floor((Date.now() - new Date(plant.plantedAt).getTime()) / 86400000) : 0;
    const isEst = plant.stage === 'established';
    const growthPct = isEst ? 1 : plant.stage === 'seedling' ? 0.3 : Math.min(1, days / (plantData.daysToHarvest ?? 90));
    const cx2 = ax * cellSize + pw / 2, cy2 = ay * cellSize + ph / 2;
    ctx.beginPath(); ctx.arc(cx2, cy2, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 2.5; ctx.stroke();
    if (growthPct > 0) {
      const rc = isEst ? 'rgba(34,197,94,0.85)' : growthPct >= 0.7 ? 'rgba(132,204,22,0.85)' : growthPct >= 0.4 ? 'rgba(163,230,53,0.8)' : 'rgba(134,239,172,0.75)';
      ctx.beginPath(); ctx.arc(cx2, cy2, radius, -Math.PI / 2, -Math.PI / 2 + growthPct * Math.PI * 2);
      ctx.strokeStyle = rc; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
    }
  }

  // Companion / enemy arcs
  const BUCKET = 6;
  const drawn = new Set<string>();
  for (const plant of plants) {
    const pData = getPlantById(plant.plantId);
    if (!pData) continue;
    const bx = Math.floor(plant.x / BUCKET);
    const by = Math.floor(plant.y / BUCKET);
    for (let dbx = -1; dbx <= 1; dbx++) {
      for (let dby = -1; dby <= 1; dby++) {
        const neighbors = spatialBuckets.get(`${bx + dbx},${by + dby}`) ?? [];
        for (const other of neighbors) {
          if (plant.id === other.id) continue;
          const pairKey = [plant.id, other.id].sort().join('|');
          if (drawn.has(pairKey)) continue;
          const oData = getPlantById(other.plantId);
          if (!oData) continue;
          const isCompanion = pData.companions.includes(other.plantId) || oData.companions.includes(plant.plantId);
          const isEnemy = pData.enemies.includes(other.plantId) || oData.enemies.includes(plant.plantId);
          if (!isCompanion && !isEnemy) continue;
          const dist = Math.abs(plant.x - other.x) + Math.abs(plant.y - other.y);
          if (dist > 6) continue;
          if (!inViewport(Math.floor(plant.x), Math.floor(plant.y)) &&
              !inViewport(Math.floor(other.x), Math.floor(other.y))) continue;
          drawn.add(pairKey);
          const x1 = (plant.x + 0.5) * cellSize, y1 = (plant.y + 0.5) * cellSize;
          const x2 = (other.x + 0.5) * cellSize, y2 = (other.y + 0.5) * cellSize;
          const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1;
          const arc = Math.min(len * 0.28, cellSize * 1.4);
          const cpX = (x1 + x2) / 2 + (-dy / len) * arc;
          const cpY = (y1 + y2) / 2 + (dx / len) * arc;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cpX, cpY, x2, y2);
          ctx.strokeStyle = isEnemy ? 'rgba(239,68,68,0.55)' : 'rgba(34,197,94,0.6)';
          ctx.lineWidth = 1.5;
          if (isEnemy) ctx.setLineDash([3, 2]);
          ctx.stroke(); ctx.setLineDash([]);
        }
      }
    }
  }

  ctx.restore();
  return canvas.transferToImageBitmap();
}

// ── Message handler ──────────────────────────────────────────────────────────
let pendingRenderId = -1;

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type !== 'render') return;

  const state = msg as RenderState & { type: 'render' };
  pendingRenderId = state.id;

  try {
    const bitmap = await render(state);
    // Only send the bitmap if this is still the latest render request.
    if (state.id === pendingRenderId) {
      (self as unknown as Worker).postMessage({ type: 'frame', id: state.id, bitmap }, [bitmap]);
    } else {
      bitmap.close();
    }
  } catch (err) {
    console.error('[gardenRender.worker] render error:', err);
  }
};
