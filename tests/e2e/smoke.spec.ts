import { expect, test, type Page } from "playwright/test";

const passcode = process.env.E2E_PASSCODE ?? "";

/** Sets a weight or reps value through the set editor sheet's keypad field. */
async function typeSetValue(
  page: Page,
  set: number,
  field: "weight" | "reps",
  value: number,
) {
  await page
    .getByRole("button", { name: new RegExp(`^Set ${set} ${field},`) })
    .click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel(`Type ${field}`).fill(String(value));
  await sheet.getByRole("button", { name: "Done" }).click();
}

test("log in, set up gear, build a program, and log a workout", async ({
  page,
}) => {
  // Login
  await page.goto("/login");
  await page.getByLabel("Passcode").fill(passcode);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/$/);

  // Equipment
  await page.goto("/setup/equipment");
  for (const name of ["Dumbbells", "Incline bench"]) {
    await page.getByLabel("Add equipment").fill(name);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(
      page.getByRole("button", { name: `Edit ${name}` }),
    ).toBeVisible();
  }
  const hasWeights = page.getByRole("button", {
    name: "Dumbbells has weights",
  });
  const saved = page.waitForResponse(
    (r) =>
      r.request().method() === "PUT" && r.url().includes("/api/equipment/"),
  );
  await hasWeights.click();
  await saved;
  await expect(hasWeights).toHaveAttribute("aria-pressed", "true");

  // Location
  await page.goto("/setup/locations/new");
  await page.getByLabel("Name").fill("Home");
  const equipmentGroup = page.getByRole("group", {
    name: "Equipment at this location",
  });
  await equipmentGroup.getByRole("button", { name: "Dumbbells" }).click();
  await equipmentGroup.getByRole("button", { name: "Incline bench" }).click();
  const weights = page.getByRole("region", { name: "Dumbbells weights" });
  await weights.getByLabel("Min").fill("5");
  await weights.getByLabel("Max").fill("80");
  await weights.getByLabel("Step").fill("5");
  await weights.getByRole("button", { name: "Create weights" }).click();
  await expect(
    page
      .getByRole("group", { name: "Available Dumbbells weights" })
      .getByRole("button", { name: "80", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add location" }).click();
  await expect(page).toHaveURL(/\/setup\/locations$/);

  // Movement
  await page.goto("/setup/movements");
  await page.getByLabel("Add movement").fill("Horizontal press");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Horizontal press" }),
  ).toBeVisible();

  // Exercise
  await page.goto("/setup/exercises/new");
  await page.getByLabel("Name").fill("Incline dumbbell press");
  await page
    .getByRole("group", { name: "Movement", exact: true })
    .getByRole("button", { name: "Horizontal press" })
    .click();
  const required = page.getByRole("group", { name: "Required equipment" });
  await required.getByRole("button", { name: "Dumbbells" }).click();
  await required.getByRole("button", { name: "Incline bench" }).click();
  await page.getByRole("radio", { name: /Per hand/ }).click();
  await page
    .getByRole("group", { name: "Weight list for the stepper" })
    .getByRole("button", { name: "Dumbbells" })
    .click();
  await page.getByRole("button", { name: "Save exercise" }).click();
  await expect(page).toHaveURL(/\/setup\/exercises$/);
  await expect(page.getByText("Incline dumbbell press")).toBeVisible();

  // Program
  await page.goto("/programs/new");
  await page.getByLabel("Program name").fill("Test PPL");
  await page.getByRole("button", { name: "Create program" }).click();
  await expect(page).toHaveURL(/\/programs\/[^/]+$/);
  await page.getByRole("button", { name: "Add day" }).click();
  await page.getByLabel("Day name").fill("Push");
  await page.getByRole("button", { name: "Add slot" }).click();
  const slotSheet = page.getByRole("dialog");
  await slotSheet
    .getByLabel("Movement", { exact: true })
    .selectOption({ label: "Horizontal press" });
  await slotSheet.getByRole("button", { name: "Add slot" }).click();
  await expect(page.getByText("Horizontal press").first()).toBeVisible();
  await page.getByRole("button", { name: "Set as active" }).click();
  await expect(page.getByText("Active program.")).toBeVisible();
  await expect(page.getByText(/^Saved/)).toBeVisible();

  // Today -> preview
  await page.goto("/");
  await page.getByRole("link", { name: "Start lifting" }).click();
  await expect(page).toHaveURL(/\/session\/new$/, { timeout: 60_000 });
  await expect(page.getByLabel("Location")).toHaveValue(/.+/);
  await expect(
    page
      .getByRole("region", { name: "Exercises" })
      .getByText("Incline dumbbell press"),
  ).toBeVisible();
  await expect(
    page.getByLabel("Location").locator("option:checked"),
  ).toHaveText("Home");
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page).toHaveURL(/\/session\/[^/]+$/);

  // Log sets
  const exercise = page.getByRole("region", { name: "Incline dumbbell press" });
  await expect(exercise).toBeVisible();
  await page.getByRole("button", { name: /^Set 1 weight,/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("group", { name: "Weight quick picks" })
    .getByRole("button", { name: "50", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
  await typeSetValue(page, 1, "reps", 10);
  await page.getByRole("button", { name: "Set 1 done" }).click();
  await expect(
    page.getByRole("button", { name: "Set 1 done" }),
  ).toHaveAttribute("aria-pressed", "true");

  // Set 2 carries the previous set's numbers forward; fall back to typing them.
  const set2Weight = page.getByRole("button", { name: /^Set 2 weight,/ });
  if (!(await set2Weight.getAttribute("aria-label"))?.includes("50 lb")) {
    await typeSetValue(page, 2, "weight", 50);
  }
  const set2Reps = page.getByRole("button", { name: /^Set 2 reps,/ });
  if (!(await set2Reps.getAttribute("aria-label"))?.includes("10")) {
    await typeSetValue(page, 2, "reps", 10);
  }
  await page.getByRole("button", { name: "Set 2 done" }).click();

  // Finish
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(
    page.getByRole("region", { name: "Session finished" }),
  ).toBeVisible();
  // Changes are queued optimistically; wait until the server has them all
  // (the first request to each API route compiles on demand in dev).
  await expect(
    page.getByRole("status").filter({ hasText: "Saved" }),
  ).toBeVisible({ timeout: 90_000 });
  await page
    .getByRole("region", { name: "Session finished" })
    .getByRole("link", { name: "Back to Today" })
    .click();
  await expect(page).toHaveURL(/\/$/);
  const todays = page.getByRole("region", { name: "Today's sessions" });
  await expect(todays).toContainText("Test PPL");
  await expect(todays).toContainText("2 sets");

  // History summary: 50 lb x 2 hands x 10 reps x 2 sets
  await page.goto("/history/summary");
  await expect(page.getByText("2,000 lb", { exact: true })).toBeVisible();
});

test.describe("installable PWA", () => {
  test("serves a manifest and icons to a signed-in browser", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Passcode").fill(passcode);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/$/);

    const manifestHref = await page
      .locator('link[rel="manifest"]')
      .getAttribute("href");
    expect(manifestHref).toBeTruthy();
    const manifest = await (await page.request.get(manifestHref!)).json();
    expect(manifest).toMatchObject({
      short_name: "Workouts",
      display: "standalone",
      start_url: "/",
    });
    for (const icon of manifest.icons as { src: string }[]) {
      const response = await page.request.get(icon.src);
      expect(response.headers()["content-type"]).toContain("image/png");
    }
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      "href",
      /apple-touch-icon\.png/,
    );
  });

  // The browser fetches the manifest and home-screen icons without the session
  // cookie, but proxy.ts redirects every non-public path to /login.
  test("serves the manifest and icons without a session", async ({
    request,
  }) => {
    for (const path of ["/manifest.webmanifest", "/icon-192.png"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(200);
    }
  });
});
