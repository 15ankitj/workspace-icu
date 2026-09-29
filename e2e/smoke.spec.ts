import { expect, test } from "@playwright/test";

test("health endpoint answers", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.supabase_url_present).toBe(true);
});

test("sign-in page renders with security headers", async ({ page }) => {
  const response = await page.goto("/sign-in");
  expect(response).not.toBeNull();
  const headers = response!.headers();
  expect(headers["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("textbox")).toBeVisible();
});

test("skip link is the first thing keyboard users reach", async ({ page }) => {
  await page.goto("/sign-in");
  await page.keyboard.press("Tab");
  await expect(page.getByText("Skip to content")).toBeFocused();
});

test("sign-in email link opens a button page and verifies nothing on GET", async ({
  page,
}) => {
  // A mail security scanner fetching the link gets this page and a form it
  // will not submit; the one-time token is only verified by the button.
  const response = await page.goto(
    "/auth/confirm?next=%2Fw%2Fabc&token_hash=placeholder&type=email",
  );
  expect(response).not.toBeNull();
  expect(response!.status()).toBe(200);
  expect(response!.headers()["cache-control"]).toContain("no-store");
  await expect(page).toHaveURL(/\/auth\/continue\?/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex",
  );
  const form = page.locator('form[action="/auth/confirm"][method="post"]');
  await expect(form.locator('input[name="token_hash"]')).toHaveValue(
    "placeholder",
  );
  await expect(form.locator('input[name="type"]')).toHaveValue("email");
  await expect(form.locator('input[name="next"]')).toHaveValue("/w/abc");
  await expect(
    form.getByRole("button", { name: "Continue to WorkspaceICU" }),
  ).toBeVisible();
  await expect(page.getByText("email security scanners")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Privacy notice" }),
  ).toBeVisible();
});

test("a sign-in form POST without a token is sent back to sign-in", async ({
  request,
}) => {
  const response = await request.post("/auth/confirm", {
    form: { type: "email", next: "/" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  expect(response.headers()["location"]).toMatch(/\/sign-in\?error=/);
});

test("workspace routes require sign-in", async ({ page }) => {
  await page.goto("/w/00000000-0000-0000-0000-000000000000");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("file URLs never serve bytes to anonymous requests", async ({
  request,
}) => {
  const response = await request.get("/api/files/not-a-file", {
    maxRedirects: 0,
  });
  // Signed-in users get a redirect to a signed URL; anyone else is sent
  // to sign in or told the file does not exist — never a 200 body.
  expect([302, 303, 307, 401, 404]).toContain(response.status());
});
