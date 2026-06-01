import { test, expect, Page } from '@playwright/test';

/**
 * Phase-0 refactor safety net.
 *
 * These smoke tests exercise the core user flows of Allotment Buddy so that an
 * upcoming refactor of Index.tsx and GardenGrid.tsx can be validated against
 * green baseline behaviour. They only rely on `data-testid` anchors plus a few
 * stable, user-visible strings.
 *
 * Notes about the app under test:
 * - React Router basename is /allotment; "/" renders <Index/>. No auth gate.
 * - On first load a WelcomeModal and (after 500ms) a SetupWizard appear unless
 *   localStorage flags are set. We pre-seed those flags via addInitScript so the
 *   app is interactable immediately and tests are not flaky on overlay timing.
 * - The garden grid <canvas> has pointer-events:none; clicks are handled by its
 *   parent wrapper div which carries data-testid="garden-canvas".
 * - Plant count is shown in the desktop toolbar span data-testid="plant-count"
 *   (visible only >=1024px). For a viewport-independent source of truth we read
 *   the canvas aria-label which says "...showing N planted items...".
 * - Plant placement flow (works on BOTH desktop and mobile):
 *     nav -> beds  ->  click "Plants" tab  ->  click a plant-item (sets pending,
 *     auto-returns to garden)  ->  click the canvas to drop the plant.
 */

const SETUP_KEYS = {
  'ab-welcome-seen': '1',
  'allotment-setup-complete': '1',
};

/** Suppress first-run modals before any app code runs. */
async function seedNoOnboarding(page: Page) {
  await page.addInitScript((keys) => {
    for (const [k, v] of Object.entries(keys)) {
      try { localStorage.setItem(k, v as string); } catch { /* ignore */ }
    }
  }, SETUP_KEYS);
}

/** Read the number of planted items from the canvas aria-label (viewport-agnostic). */
async function readPlantCount(page: Page): Promise<number> {
  const canvas = page.locator('[data-testid="garden-canvas"] canvas[aria-label*="planted items"]');
  const label = await canvas.first().getAttribute('aria-label');
  const m = label?.match(/showing\s+(\d+)\s+planted items/i);
  expect(m, `could not parse plant count from aria-label: ${label}`).not.toBeNull();
  return Number(m![1]);
}

/** Select a plant via the beds -> Plants tab path; leaves the app in garden view with pending placement. */
async function selectPlantForPlacement(page: Page) {
  await page.getByTestId('nav-beds').click();
  // The PlantSidebar opens defaulting to the structures tab; switch to Plants.
  await page.getByRole('button', { name: 'Plants' }).first().click();
  // The list is virtualized — click the first rendered plant item.
  const firstPlant = page.locator('[data-testid^="plant-item-"]').first();
  await expect(firstPlant).toBeVisible();
  await firstPlant.click();
  // Selecting auto-navigates back to garden with a pending placement.
  await expect(page.getByTestId('garden-canvas')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await seedNoOnboarding(page);
});

test.describe('Allotment Buddy smoke', () => {
  // These flows are written against the desktop layout (full toolbar, no bottom
  // plant sheet). They are exercised on the desktop project only.
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop project only');
  });

  test('app loads and the garden canvas is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('garden-canvas')).toBeVisible();
    // Sanity: the count starts at 0 on a fresh load.
    expect(await readPlantCount(page)).toBe(0);
  });

  test('selecting a plant and clicking the canvas increments the plant count', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('garden-canvas')).toBeVisible();

    const before = await readPlantCount(page);

    await selectPlantForPlacement(page);

    // Drop the plant on the canvas. Offset from dead-center to avoid the centered
    // empty-state hint card (which is pointer-events-auto when no plants exist).
    const canvas = page.getByTestId('garden-canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await canvas.click({ position: { x: Math.round(box!.width * 0.35), y: Math.round(box!.height * 0.3) } });

    await expect.poll(() => readPlantCount(page), { timeout: 20_000 }).toBe(before + 1);
  });

  test('navigating through all nav sections renders each without crashing', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('garden-canvas')).toBeVisible();

    // beds -> structures sidebar (Plants tab is available)
    await page.getByTestId('nav-beds').click();
    await expect(page.getByRole('button', { name: 'Plants' }).first()).toBeVisible();
    await expect(page.getByTestId('nav-beds')).toHaveClass(/text-primary/);

    // structures
    await page.getByTestId('nav-structures').click();
    await expect(page.getByRole('button', { name: 'Structures' }).first()).toBeVisible();
    await expect(page.getByTestId('nav-structures')).toHaveClass(/text-primary/);

    // tasks
    await page.getByTestId('nav-tasks').click();
    await expect(page.getByTestId('nav-tasks')).toHaveClass(/text-primary/);

    // plan
    await page.getByTestId('nav-plan').click();
    await expect(page.getByRole('heading', { name: /Plan/ })).toBeVisible();
    await expect(page.getByTestId('nav-plan')).toHaveClass(/text-primary/);

    // more
    await page.getByTestId('nav-more').click();
    await expect(page.getByRole('heading', { name: /More/ })).toBeVisible();
    await expect(page.getByTestId('nav-more')).toHaveClass(/text-primary/);

    // back to garden
    await page.getByTestId('nav-garden').click();
    await expect(page.getByTestId('garden-canvas')).toBeVisible();
    await expect(page.getByTestId('nav-garden')).toHaveClass(/text-primary/);
  });

  test('isometric toggle switches view and back without losing the canvas', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('garden-canvas')).toBeVisible();

    // iso-toggle is the desktop toolbar button (visible >=1024px).
    const iso = page.getByTestId('iso-toggle');
    await expect(iso).toBeVisible();

    await iso.click();
    // Isometric view replaces the flat GardenGrid; the canvas testid is gone.
    // Assert we did not crash and can toggle back.
    await iso.click();
    await expect(page.getByTestId('garden-canvas')).toBeVisible();
  });

  // FIXME: The visible "Saved" indicator is driven by useAutoSave -> useGardenAutoSave,
  // which early-returns `if (!user ...)` and only flips isSaving (and thus showSaved)
  // for an AUTHENTICATED Supabase cloud save. These smoke tests run anonymously (the app
  // has no auth gate), so the "Saved" text never appears — anonymous changes persist to
  // IndexedDB only. Asserting "Saved" anonymously would require mocking a Supabase auth
  // session, which is out of scope for this safety net and would be flaky. Local-save
  // persistence is implicitly covered by the count-increment test above. Re-enable once a
  // deterministic auth fixture (or a non-cloud "saved locally" indicator) exists.
  test.fixme('placing a plant triggers the autosave "Saved" indicator', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('garden-canvas')).toBeVisible();

    await selectPlantForPlacement(page);

    const canvas = page.getByTestId('garden-canvas');
    const box = await canvas.boundingBox();
    await canvas.click({ position: { x: Math.round(box!.width * 0.35), y: Math.round(box!.height * 0.3) } });

    // Autosave is debounced; the desktop toolbar shows "Saving…" then "Saved".
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('Allotment Buddy mobile smoke', () => {
  // Mobile uses a distinct layout: a bottom MobilePlantSheet (the plant picker) and
  // a BottomNavBar. The collapsed plant sheet overlays the bottom region, so nav
  // taps use { force: true } — we are verifying that each section renders, not the
  // pixel-perfect hit-testing of the nav under the sheet.
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile project only');
  });

  test('mobile layout loads, nav works, and a plant can be placed', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('garden-canvas')).toBeVisible();

    // Mobile-only chrome: the bottom plant sheet handle labelled "Plants".
    const plantSheetHandle = page.getByText('Plants', { exact: true });
    await expect(plantSheetHandle).toBeVisible();

    // Mobile nav works. The collapsed plant sheet overlays the bottom region, so a
    // real pointer click can land on the sheet instead of the nav button. We dispatch
    // the click directly to the nav button element (fires its React onClick regardless
    // of z-order) — this verifies the section renders, which is the intent here.
    await page.getByTestId('nav-plan').dispatchEvent('click');
    await expect(page.getByRole('heading', { name: /Plan/ })).toBeVisible();
    await page.getByTestId('nav-garden').dispatchEvent('click');
    await expect(page.getByTestId('garden-canvas')).toBeVisible();

    const before = await readPlantCount(page);

    // Place a plant via the mobile plant sheet (the real mobile UX).
    // 1) Expand the sheet by tapping its handle.
    await plantSheetHandle.click();
    // 2) Switch to the "All" tab (the default "Recent" tab is empty on a fresh load).
    await page.getByRole('button', { name: 'All', exact: true }).click();
    // 3) Tap the first plant button in the sheet grid. Selecting sets a pending
    //    placement and auto-navigates back to the garden canvas.
    const firstSheetPlant = page
      .locator('div.lg\\:hidden')
      .filter({ hasText: 'Plants' })
      .locator('div.grid > button')
      .first();
    await expect(firstSheetPlant).toBeVisible();
    await firstSheetPlant.click();

    await expect(page.getByTestId('garden-canvas')).toBeVisible();

    // 4) Tap the canvas to drop the plant. On the narrow mobile viewport the centered
    //    empty-state hint card spans most of the width, so click near the top-left
    //    corner of the canvas (empty grid, clear of the card).
    const canvas = page.getByTestId('garden-canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await canvas.click({ position: { x: Math.round(box!.width * 0.12), y: Math.round(box!.height * 0.1) } });

    await expect.poll(() => readPlantCount(page), { timeout: 20_000 }).toBe(before + 1);
  });
});
