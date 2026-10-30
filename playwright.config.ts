import { randomBytes, scryptSync } from "node:crypto";
import { defineConfig, devices } from "playwright/test";

const PORT = 3200;
const TEST_PASSCODE = "e2e-test-passcode";

const salt = randomBytes(16).toString("hex");
const passcodeHash = `${salt}:${scryptSync(TEST_PASSCODE, salt, 64).toString("hex")}`;

// Inherited by the test workers so they log in with the same passcode.
process.env.E2E_PASSCODE = TEST_PASSCODE;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 120_000,
  // The dev server compiles each route on first hit, so allow slow first loads.
  expect: { timeout: 20_000 },
  retries: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: `npx next dev --webpack -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PGLITE_DATA_DIR: ".data/e2e",
      APP_PASSCODE_HASH: passcodeHash,
      SESSION_SECRET: randomBytes(32).toString("hex"),
      IP_HASH_SECRET: randomBytes(32).toString("hex"),
      APP_TIME_ZONE: "America/New_York",
    },
  },
});
