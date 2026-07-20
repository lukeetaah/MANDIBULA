import { expect, test } from "@playwright/test";

test("inicia el tutorial de mando y permite elegir una patrulla", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /MANDÍBULA/i })).toBeVisible();
  await page.getByRole("button", { name: /FUNDAR LA RED/ }).click();
  await expect(page.getByText("Alimentá lo que no ves.")).toBeVisible();
  await expect(page.getByText("Elegí una patrulla")).toBeVisible();
  await page.getByRole("button", { name: "ELEGIR 12 DISPONIBLES" }).click();
  await expect(page.getByText("12 conciencias, una intención")).toBeVisible();
});

test("abre opciones de percepción accesibles", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /FUNDAR LA RED/ }).click();
  await page.getByRole("button", { name: "Abrir accesibilidad" }).click();
  await expect(
    page.getByRole("dialog", { name: "Accesibilidad y controles" }),
  ).toBeVisible();
  await expect(page.getByText("Reducir movimiento")).toBeVisible();
});
