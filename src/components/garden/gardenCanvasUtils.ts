/**
 * Module-level canvas helpers, caches, and frame scheduling utilities.
 * Extracted from GardenGrid.tsx to reduce file size.
 */

// Canvas helper: draw a rounded rectangle path
export function roundRect(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const minR = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + minR, y);
  ctx.arcTo(x + w, y, x + w, y + h, minR);
  ctx.arcTo(x + w, y + h, x, y + h, minR);
  ctx.arcTo(x, y + h, x, y, minR);
  ctx.arcTo(x, y, x + w, y, minR);
  ctx.closePath();
}

// Module-level emoji glyph atlas -- avoids repeated font-metric lookups and text
// rasterisation on every canvas frame. Keyed by "emoji_size".
// Uses OffscreenCanvas so this function works identically in Web Workers.
const emojiCache = new Map<string, OffscreenCanvas>();
export function getCachedEmoji(emoji: string, size: number): OffscreenCanvas {
  const key = `${emoji}_${Math.round(size)}`;
  if (!emojiCache.has(key)) {
    const s = Math.ceil(size * 1.5); // extra padding so emoji aren't clipped
    const c = new OffscreenCanvas(s, s);
    const cx = c.getContext('2d');
    if (cx) {
      cx.font = `${size}px sans-serif`;
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(emoji, s / 2, s / 2);
    }
    emojiCache.set(key, c);
  }
  return emojiCache.get(key)!;
}

// Context reset helper -- ctx.reset() clears the canvas AND resets all state in one
// GPU op. Universally supported: Chrome 99+, Firefox 113+, Safari 17.4+.
export function resetCtx(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ctx as any).reset();
}

// Frame scheduler: prefers requestVideoFrameCallback (rVFC) for true vsync-aligned
// redraws; falls back to rAF on browsers that don't yet support rVFC.
export type FrameId = number;
export function scheduleFrame(fn: FrameRequestCallback): FrameId {
  const w = window as typeof window & { requestVideoFrameCallback?: (cb: FrameRequestCallback) => number };
  return w.requestVideoFrameCallback ? w.requestVideoFrameCallback(fn) : requestAnimationFrame(fn);
}
export function cancelFrame(id: FrameId): void {
  const w = window as typeof window & { cancelVideoFrameCallback?: (id: number) => void };
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  w.cancelVideoFrameCallback ? w.cancelVideoFrameCallback(id) : cancelAnimationFrame(id);
}

// Twemoji sprite cache
// Loads plant emoji as GPU-resident ImageBitmap from the Twemoji CDN (CC BY 4.0).
// Falls back to getCachedEmoji (system font) on failure or when offline.
export const twemojiCache = new Map<string, ImageBitmap>();
const twemojiErrors = new Set<string>();
const twemojiPending = new Map<string, Promise<void>>();

function getEmojiUrl(emoji: string): string {
  // Convert emoji to Twemoji PNG URL.
  // Strip variation selector U+FE0F; join remaining codepoints with '-'.
  const codepoints: string[] = [];
  for (const char of [...emoji]) {
    const cp = char.codePointAt(0);
    if (cp !== undefined && cp !== 0xFE0F) codepoints.push(cp.toString(16));
  }
  return `https://cdn.jsdelivr.net/npm/twemoji@14.0.2/assets/72x72/${codepoints.join('-')}.png`;
}

function loadTwemoji(emoji: string): Promise<void> {
  if (twemojiCache.has(emoji) || twemojiErrors.has(emoji)) return Promise.resolve();
  if (twemojiPending.has(emoji)) return twemojiPending.get(emoji)!;
  const p = (async () => {
    try {
      const resp = await fetch(getEmojiUrl(emoji));
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      twemojiCache.set(emoji, await createImageBitmap(await resp.blob()));
    } catch {
      twemojiErrors.add(emoji); // use system-font fallback permanently
    } finally {
      twemojiPending.delete(emoji);
    }
  })();
  twemojiPending.set(emoji, p);
  return p;
}

export async function preloadTwemojis(emojis: string[]): Promise<void> {
  await Promise.all(emojis.map(loadTwemoji));
}

// Custom plant sprite cache
// Plants can optionally supply a `sprite` path (relative to BASE_URL) to
// override the default Twemoji glyph with a hand-crafted SVG/PNG image.
export const customSpriteCache = new Map<string, ImageBitmap>();
const customSpriteErrors = new Set<string>();
const customSpritePending = new Map<string, Promise<void>>();

export function loadCustomSprite(relPath: string): Promise<void> {
  if (customSpriteCache.has(relPath) || customSpriteErrors.has(relPath)) return Promise.resolve();
  if (customSpritePending.has(relPath)) return customSpritePending.get(relPath)!;
  const url = `${import.meta.env.BASE_URL}${relPath}`;
  const p = (async () => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      customSpriteCache.set(relPath, await createImageBitmap(await resp.blob()));
    } catch {
      customSpriteErrors.add(relPath);
    } finally {
      customSpritePending.delete(relPath);
    }
  })();
  customSpritePending.set(relPath, p);
  return p;
}

// Path2D cache -- rounded-rect paths at origin (0,0), keyed by "w_h_r".
// Reused via ctx.translate() so the GPU tessellation is computed once per geometry.
const path2DCache = new Map<string, Path2D>();
export function getCachedPath2D(w: number, h: number, r: number): Path2D {
  const key = `${Math.round(w)}_${Math.round(h)}_${Math.round(r * 10)}`;
  if (!path2DCache.has(key)) {
    const p = new Path2D();
    const minR = Math.min(r, w / 2, h / 2);
    p.moveTo(minR, 0);
    p.arcTo(w, 0, w, h, minR);
    p.arcTo(w, h, 0, h, minR);
    p.arcTo(0, h, 0, 0, minR);
    p.arcTo(0, 0, w, 0, minR);
    p.closePath();
    path2DCache.set(key, p);
  }
  return path2DCache.get(key)!;
}
