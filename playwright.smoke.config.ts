import { defineConfig, devices } from '@playwright/test';

/**
 * Self-contained Playwright config for the Phase-0 refactor safety net.
 * Deliberately does NOT import the Lovable agent config package (which is
 * not installed).
 *
 * NOTE ON PORT: port 5173 (the dev port baked into vite.config.ts) is held by
 * a long-running production Express server (server.js) that is auto-respawned
 * by a supervisor, so it cannot be used for a fresh dev server carrying the
 * source under test. We therefore launch the Vite dev server on a dedicated
 * port (5181) via `--port --strictPort`, with reuseExistingServer:false so the
 * tests always run against the current source (including the new data-testid
 * anchors), never the prebuilt dist/. The base path /allotment/ comes from
 * vite.config.ts.
 */
const DEV_PORT = 5181;
const BASE_URL = `http://localhost:${DEV_PORT}/allotment/`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],

  // The canvas app is heavy; give actions/assertions room to breathe.
  timeout: 90_000,
  expect: { timeout: 20_000 },

  use: {
    baseURL: BASE_URL,
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 5'],
      },
    },
  ],

  webServer: {
    command: `npm run dev -- --port ${DEV_PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
