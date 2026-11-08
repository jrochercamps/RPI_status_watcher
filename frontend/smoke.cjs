// Servidor de pruebas y Chrome deben estar disponibles por separado.
const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');

(async () => {
  const url = process.env.TEST_URL || 'http://127.0.0.1:18765/';
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox'],
  });
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.getByText('Conectado a Netdata').first().waitFor();
      await page.locator('svg[aria-label="Serie temporal"]').first().waitFor();
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.getByRole('button', { name: 'Actualizar datos' }).click();
      for (const section of ['Rendimiento', 'Temperatura', 'Memoria', 'Almacenamiento', 'Red', 'Docker', 'Servicios', 'Históricos', 'Alertas', 'Configuración']) {
        if (viewport.width < 700) await page.locator('#mobile-page').selectOption({ label: section });
        else await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: section, exact: true }).click();
        await page.getByRole('heading', { name: section, exact: true }).first().waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Desbordamiento en ${section}`);
      }
      assert.deepEqual(errors, []);
      console.log(`OK ${viewport.width}x${viewport.height}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
