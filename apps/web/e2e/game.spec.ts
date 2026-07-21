import { expect, test } from "@playwright/test";

test("inicia partida y muestra el HUD", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /MANDÍBULA/i })).toBeVisible();
  await page.getByRole("button", { name: /INICIAR PARTIDA/ }).click();
  // Game should start and show the game shell
  await expect(page.locator(".game-shell")).toBeVisible({ timeout: 10000 });
});

test("abre opciones de percepción accesibles", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /INICIAR PARTIDA/ }).click();
  await page.getByRole("button", { name: "Abrir accesibilidad" }).click();
  await expect(
    page.getByRole("dialog", { name: "Accesibilidad y controles" }),
  ).toBeVisible();
  await expect(page.getByText("Reducir movimiento")).toBeVisible();
});
