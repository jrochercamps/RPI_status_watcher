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
      await page.route('**/api/alerts?*', route => route.fulfill({ json: { alarms: { sample: { name: 'Alerta de prueba', chart: 'system.cpu', status: 'WARNING', info: 'Dato simulado' } } } }));
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.getByText('Conectado a Netdata').first().waitFor();
      await page.getByText('Actualización del navegador cada 5 minutos').waitFor();
      await page.locator('[aria-label="Serie temporal interactiva"]').first().waitFor();
      assert.equal(await page.locator('.metric-value span').first().innerText(), '12 %');
      assert.match(await page.locator('.metric-value small').first().innerText(), /11,5 %/);
      await page.getByText('Últimas 6 horas', { exact: true }).first().waitFor({ state: 'attached' });
      const periodRequest = page.waitForRequest(request => request.url().includes('/api/data?') && request.url().includes('after=-21600'));
      await page.locator('#period').selectOption('21600');
      await periodRequest;
      await page.locator('[aria-label="Serie temporal interactiva"]').first().waitFor();
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.getByRole('button', { name: 'Actualizar datos' }).click();
      for (const section of ['Rendimiento', 'Temperatura', 'Memoria', 'Almacenamiento', 'Red', 'Docker', 'Servicios', 'Históricos', 'Alertas', 'Configuración']) {
        if (viewport.width < 700) await page.locator('#mobile-page').selectOption({ label: section });
        else await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: section, exact: true }).click();
        await page.getByRole('heading', { name: section, exact: true }).first().waitFor();
        if (section === 'Alertas') await page.getByText('Alerta de prueba').first().waitFor();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Desbordamiento en ${section}`);
      }
      assert.deepEqual(await page.locator('#refresh-interval option').allTextContents(), ['1 minuto', '2 minutos', '5 minutos', '10 minutos', '30 minutos']);
      await page.locator('#refresh-interval').selectOption('1800');
      assert.equal(await page.evaluate(() => localStorage.getItem('rpi-status-refresh-seconds')), '1800');
      await page.reload({ waitUntil: 'networkidle' });
      await page.getByText('Actualización del navegador cada 30 minutos').waitFor();
      assert.deepEqual(errors, []);
      console.log(`OK ${viewport.width}x${viewport.height}`);
      await page.close();
    }
    const temperature = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const now = Math.floor(Date.now() / 1000);
    await temperature.route('**/api/charts', route => route.fulfill({ json: { charts: { 'sensors.temperature': { title: 'Temperatura CPU', units: 'Celsius' } } } }));
    await temperature.route('**/api/data?*', route => route.fulfill({ json: { labels: ['time', 'CPU'], data: [[now, 43], [now - 60, null], [now - 120, 40]] } }));
    await temperature.route('**/api/alerts?*', route => route.fulfill({ json: { alarms: {} } }));
    await temperature.goto(url, { waitUntil: 'networkidle' });
    await temperature.locator('[aria-label="Serie temporal interactiva"]').waitFor();
    assert.equal(await temperature.locator('.metric-value span').first().innerText(), '43 °C');
    assert.match(await temperature.locator('.metric-value small').first().innerText(), /Mín\. 40 °C · Media 41,5 °C · Máx\. 43 °C/);
    await temperature.close();
    console.log('OK temperatura, unidades y valores nulos');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
