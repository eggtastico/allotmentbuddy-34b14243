import { test, expect, Page } from '@playwright/test';

/**
 * Canvas-rendering visual regression guard (Phase 3 of the refactor).
 *
 * Phase 3 extracts GardenGrid's imperative canvas-draw effects into a hook +
 * pure helpers. These snapshots pin the *pixels* the main canvas produces in
 * two deterministic states, so any unintended change to the drawing output is
 * caught — something the behaviour-only smoke tests can't see.
 *
 * Baselines are generated on the pre-Phase-3 code and committed; the refactor
 * must reproduce them. Desktop project only (fixed 1440x900 viewport → stable
 * canvas dimensions). A small maxDiffPixelRatio absorbs anti-aliasing noise.
 */

const SETUP_KEYS = {
  'ab-welcome-seen': '1',
  'allotment-setup-complete': '1',
};

async function seedNoOnboarding(page: Page) {
  await page.addInitScript((keys) => {
    for (const [k, v] of Object.entries(keys)) {
      try { localStorage.setItem(k, v as string); } catch { /* ignore */ }
    }
  }, SETUP_KEYS);
}

async function selectPlantForPlacement(page: Page) {
  await page.getByTestId('nav-beds').click();
  await page.getByRole('button', { name: 'Plants' }).first().click();
  const firstPlant = page.locator('[data-testid^="plant-item-"]').first();
  await expect(firstPlant).toBeVisible();
  await firstPlant.click();
  await expect(page.getByTestId('garden-canvas')).toBeVisible();
}

/** The main (non-overlay) canvas element — the layer the draw effects render to. */
function mainCanvas(page: Page) {
  return page.locator('[data-testid="garden-canvas"] canvas').first();
}

const SNAPSHOT_OPTS = { maxDiffPixelRatio: 0.02, animations: 'disabled' as const };

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'visual baselines are desktop-only');
  await seedNoOnboarding(page);
});

test.describe('GardenGrid canvas rendering', () => {
  test('empty garden grid renders consistently', async ({ page }) => {
    await page.goto('/');
    const canvas = mainCanvas(page);
    await expect(canvas).toBeVisible();
    // Let the initial grid render settle (rAF draw + any font/grid setup).
    await page.waitForTimeout(1500);
    await expect(canvas).toHaveScreenshot('garden-empty.png', SNAPSHOT_OPTS);
  });

  test('garden grid with one placed plant renders consistently', async ({ page }) => {
    await page.goto('/');
    await selectPlantForPlacement(page);
    // Drop a plant at a fixed position so the rendered output is deterministic.
    await page.getByTestId('garden-canvas').click({ position: { x: 150, y: 150 } });
    // Wait for the sprite/emoji draw to settle on the canvas.
    await page.waitForTimeout(2000);
    const canvas = mainCanvas(page);
    await expect(canvas).toHaveScreenshot('garden-one-plant.png', SNAPSHOT_OPTS);
  });
});
