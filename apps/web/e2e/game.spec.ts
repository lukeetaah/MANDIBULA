import { expect, test } from "@playwright/test";

test("inicia una partida local y muestra el primer objetivo", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /MANDÍBULA/i })).toBeVisible();
  await page.getByRole("button", { name: "EMERGER" }).click();
  await expect(page.getByText("ABASTECÉ EL CULTIVO")).toBeVisible();
  await expect(page.getByText("Orientate")).toBeVisible();
});

test("abre opciones de percepción accesibles", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "EMERGER" }).click();
  await page.getByRole("button", { name: "Abrir accesibilidad" }).click();
  await expect(
    page.getByRole("dialog", { name: "Accesibilidad y controles" }),
  ).toBeVisible();
  await expect(page.getByText("Reducir movimiento")).toBeVisible();
});
