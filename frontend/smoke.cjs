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
      await page.route('**/api/alerts?*', route => route.fulfill({ json: { status: true, alarms: { sample: { name: 'Alerta de prueba', chart: 'system.cpu', status: 'WARNING', info: 'Dato simulado', value_string: '72 %', warn: '$this > 70', crit: '$this > 80' } } } }));
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.getByText('Conectado a Netdata').first().waitFor();
      await page.getByText('Actualización del navegador cada 5 minutos').waitFor();
      if (viewport.width < 700) await page.locator('#mobile-page').selectOption({ label: 'Estado del sistema' });
      else await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Estado del sistema' }).click();
      await page.locator('[aria-label="Serie temporal interactiva"]').first().waitFor();
      assert.match(await page.locator('.panel-heading').first().innerText(), /system\.cpu · %/);
      const chartAlerts = page.getByRole('region', { name: 'Límites y alertas de esta gráfica' });
      await chartAlerts.getByText('Alerta de prueba · Advertencia').waitFor();
      await chartAlerts.getByText('$this > 70', { exact: true }).waitFor();
      await chartAlerts.getByText('$this > 80', { exact: true }).waitFor();
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
    await temperature.route('**/api/alerts?*', route => route.fulfill({ json: { status: false, alarms: {} } }));
    await temperature.goto(url, { waitUntil: 'networkidle' });
    await temperature.getByRole('navigation').getByRole('button', { name: 'Estado del sistema' }).click();
    await temperature.locator('[aria-label="Serie temporal interactiva"]').waitFor();
    assert.equal(await temperature.locator('.metric-value span').first().innerText(), '43 °C');
    assert.match(await temperature.locator('.metric-value small').first().innerText(), /Mín\. 40 °C · Media 41,5 °C · Máx\. 43 °C/);
    await temperature.getByText('Netdata indica que la evaluación de alertas está deshabilitada.').waitFor();
    await temperature.getByText('No hay condiciones asociadas conocidas para esta gráfica. Esto no significa que sea segura.').waitFor();
    await temperature.close();
    console.log('OK temperatura, unidades y valores nulos');
    const summary = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    let staleCpu = false;
    const chartMeta = {
      'system.cpu': { units: 'percentage', update_every: 300, first_entry: now - 20000 },
      'system.ram': { units: 'MiB', update_every: 300 },
      'disk_space.root': { units: 'GiB', context: 'disk.space', family: '/', update_every: 300 },
      'disk_space.backup': { units: 'GiB', context: 'disk.space', family: '/mnt/backup', update_every: 300 },
      'system.net': { units: 'kilobits/s', update_every: 300, first_entry: now - 20000 },
      'sensors.cpu_thermal-virtual-0_temperature': { units: 'Celsius', update_every: 300 },
      'empty.chart': { units: '%', first_entry: 0, last_entry: 0 },
      'zero.chart': { units: '%', first_entry: now - 300, last_entry: now },
      'unknown.chart': { units: '%' },
    };
    await summary.route('**/api/charts', route => route.fulfill({ json: { charts: chartMeta } }));
    await summary.route('**/api/data?*', route => {
      const chart = new URL(route.request().url()).searchParams.get('chart');
      const values = {
        'system.cpu': { labels: ['time', 'user', 'system', 'iowait'], data: [[staleCpu ? now - 10000 : now, 10, 12, 3], [now - 10000, 40, 20, 5]] },
        'system.ram': { labels: ['time', 'used', 'free', 'cached', 'buffers'], data: [[now, 2048, 2048, 2048, 2048]] },
        'disk_space.root': { labels: ['time', 'used', 'avail', 'reserved for root'], data: [[now, 100, 300, 10]] },
        'disk_space.backup': { labels: ['time', 'used', 'avail', 'reserved for root'], data: [[now, 67, 400, 0]] },
        'system.net': { labels: ['time', 'received', 'sent'], data: [[now, 0, -12], [now - 10000, 30, -3]] },
        'sensors.cpu_thermal-virtual-0_temperature': { labels: ['time', 'temperature'], data: [[now, 43]] },
        'empty.chart': { labels: ['time', 'empty'], data: [[now, null]] },
        'zero.chart': { labels: ['time', 'zero'], data: [[now, 0]] },
        'unknown.chart': { labels: ['time', 'unknown'], data: [[now, 1]] },
      };
      return route.fulfill({ json: values[chart] || { labels: ['time'], data: [] } });
    });
    await summary.route('**/api/alerts?*', route => route.fulfill({ json: { status: true, alarms: {} } }));
    await summary.goto(url, { waitUntil: 'networkidle' });
    await summary.getByRole('article', { name: 'CPU' }).getByText('25 %').waitFor();
    await summary.getByRole('article', { name: 'RAM' }).getByText('25 %').waitFor();
    await summary.getByRole('article', { name: 'Disco' }).getByText('100 / 410 GiB').waitFor();
    await summary.getByRole('article', { name: 'Disco backup' }).getByText('67 / 467 GiB').waitFor();
    await summary.getByRole('article', { name: 'Temperatura CPU' }).getByText('43 °C').waitFor();
    await summary.getByRole('article', { name: 'Red' }).getByText('↓ 0 · ↑ 12 kbit/s').waitFor();
    await summary.getByRole('article', { name: 'GPU' }).getByText('No disponible').waitFor();
    await summary.getByRole('navigation').getByRole('button', { name: 'Históricos' }).click();
    await summary.getByRole('article', { name: 'CPU' }).getByText('65 %').waitFor();
    await summary.getByRole('article', { name: 'Descarga' }).getByText('30 kbit/s').waitFor();
    await summary.getByRole('article', { name: 'Subida' }).getByText('12 kbit/s').waitFor();
    await summary.getByRole('navigation').getByRole('button', { name: 'Estado del sistema' }).click();
    let options = await summary.locator('#chart option').evaluateAll(items => items.map(item => item.value));
    assert(!options.includes('empty.chart'));
    assert(options.includes('zero.chart') && options.includes('unknown.chart'));
    await summary.getByLabel('Ocultar gráficas sin muestras registradas').uncheck();
    options = await summary.locator('#chart option').evaluateAll(items => items.map(item => item.value));
    assert(options.includes('empty.chart'));
    await summary.locator('#chart').selectOption('empty.chart');
    await summary.getByText('Sin muestras en este intervalo; el panel de datos se ha ocultado. Puedes elegir otro gráfico o intervalo.').waitFor();
    assert.equal(await summary.getByRole('region', { name: 'Datos de la gráfica' }).count(), 0);
    await summary.locator('#chart').selectOption('zero.chart');
    await summary.locator('.metric-value span').getByText('0 %', { exact: true }).waitFor();
    staleCpu = true;
    chartMeta['disk_space.other'] = { units: 'GiB', context: 'disk.space', family: '/', update_every: 300 };
    await summary.reload({ waitUntil: 'networkidle' });
    await summary.getByRole('article', { name: 'CPU' }).getByText('No disponible').waitFor();
    await summary.getByRole('article', { name: 'Disco' }).getByText('No disponible').waitFor();
    await summary.close();
    console.log('OK resumen, muestras ausentes y valor cero');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
