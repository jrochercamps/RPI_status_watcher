import { useEffect, useState } from 'react'
import type { Alarm } from './ChartAlerts'

type Chart = { units?: string; family?: string; context?: string; update_every?: number; first_entry?: number; chart_labels?: Record<string, string> }
type Catalog = Record<string, Chart>
type Data = { labels?: string[]; data?: (number | null)[][] }
type Card = { value: string; detail: string; score?: number }
type Summary = { cpu: Card; ram: Card; disk: Card; backup: Card; temperature: Card; network: Card; upload: Card }

const missing: Card = { value: 'No disponible', detail: 'Sin una muestra reciente e identificable' }
const initial: Summary = { cpu: missing, ram: missing, disk: missing, backup: missing, temperature: missing, network: missing, upload: missing }
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const fmt = (value: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(value)

// Conserva los ceros y rechaza muestras sin fecha o demasiado antiguas.
function latest(data: Data, chart: Chart): { values: Record<string, number>; timestamp: number } | null {
  if (!Array.isArray(data.labels) || !Array.isArray(data.data)) return null
  const rows = data.data.filter(row => Array.isArray(row) && isNumber(row[0])).slice().sort((a, b) => (b[0] as number) - (a[0] as number))
  const interval = isNumber(chart.update_every) && chart.update_every > 0 ? chart.update_every : 300
  const now = Date.now() / 1000
  for (const row of rows) {
    const timestamp = row[0] as number
    if (timestamp > now + 60 || now - timestamp > Math.max(900, interval * 3)) continue
    const values: Record<string, number> = {}
    data.labels.slice(1).forEach((name, i) => { if (typeof name === 'string' && isNumber(row[i + 1])) values[name.toLowerCase()] = row[i + 1] as number })
    if (Object.keys(values).length) return { values, timestamp }
  }
  return null
}

function timeDetail(timestamp: number) { return `Muestra de Netdata: ${new Date(timestamp * 1000).toLocaleString('es-ES')}` }

async function fetchChart(id: string, signal: AbortSignal, firstEntry?: number): Promise<Data> {
  const query = new URLSearchParams({ chart: id, after: firstEntry ? String(Math.floor(firstEntry)) : '-1800', before: '0', points: firstEntry ? '2000' : '30' })
  const response = await fetch(`/api/data?${query}`, { signal, cache: 'no-store' })
  if (!response.ok) throw new Error('Netdata no disponible')
  return response.json()
}

function cpuValue(data: Data, chart: Chart): Card {
  if (!/^(percentage|percent|%)$/i.test(chart.units || '')) return missing
  const sample = latest(data, chart)
  if (!sample) return missing
  const v = sample.values
  let value: number
  if (isNumber(v.idle)) { if (v.idle < 0 || v.idle > 100) return missing; value = 100 - v.idle }
  else {
    const labels = data.labels?.slice(1).map(name => typeof name === 'string' ? name.toLowerCase() : '') ?? []
    const allowed = new Set(['user', 'system', 'nice', 'iowait', 'irq', 'softirq', 'steal', 'guest', 'guest_nice'])
    if (!labels.includes('user') || !labels.includes('system') || labels.some(label => !allowed.has(label) || !isNumber(v[label]) || v[label] < 0)) return missing
    value = labels.reduce((sum, label) => sum + v[label], 0)
  }
  if (!Number.isFinite(value) || value < 0 || value > 100.5) return missing
  return { value: `${fmt(Math.min(value, 100))} %`, score: value, detail: `${timeDetail(sample.timestamp)} · uso total, incluye espera` }
}

function ramValue(data: Data, chart: Chart): Card {
  if ((chart.units || '').toLowerCase() !== 'mib') return missing
  const sample = latest(data, chart)
  if (!sample) return missing
  const v = sample.values
  if (!['used', 'free', 'cached', 'buffers'].every(key => isNumber(v[key]) && v[key] >= 0)) return missing
  const total = v.used + v.free + v.cached + v.buffers
  if (total <= 0 || v.used > total) return missing
  return { value: `${fmt(v.used / total * 100)} %`, score: v.used / total, detail: `${fmt(v.used / 1024)} / ${fmt(total / 1024)} GiB · uso sin caché ni buffers · ${timeDetail(sample.timestamp)}` }
}

function diskValue(data: Data, chart: Chart): Card {
  if ((chart.units || '').toLowerCase() !== 'gib') return missing
  const sample = latest(data, chart)
  if (!sample) return missing
  const v = sample.values
  const reserved = v['reserved for root'] ?? v.reserved_for_root
  if (![v.used, v.avail, reserved].every(value => isNumber(value) && value >= 0)) return missing
  const total = v.used + v.avail + reserved
  if (total <= 0 || v.used > total) return missing
  return { value: `${fmt(v.used)} / ${fmt(total)} GiB`, score: v.used, detail: `${fmt(v.used / total * 100)} % usado · ${timeDetail(sample.timestamp)}` }
}

function temperatureValue(data: Data, chart: Chart): Card {
  if (!/^(celsius|°c)$/i.test(chart.units || '')) return missing
  const sample = latest(data, chart)
  if (!sample) return missing
  const values = Object.values(sample.values)
  if (values.length !== 1 || values[0] < -50 || values[0] > 150) return missing
  return { value: `${fmt(values[0])} °C`, score: values[0], detail: timeDetail(sample.timestamp) }
}

function networkValue(data: Data, chart: Chart): Card {
  if (!/^(kilobits\/s|kbits\/s)$/i.test(chart.units || '')) return missing
  const sample = latest(data, chart)
  if (!sample || !isNumber(sample.values.received) || !isNumber(sample.values.sent) || sample.values.received < 0) return missing
  return { value: `↓ ${fmt(sample.values.received)} · ↑ ${fmt(Math.abs(sample.values.sent))} kbit/s`, detail: `Tráfico total comunicado por Netdata · ${timeDetail(sample.timestamp)}` }
}

function networkDirection(data: Data, chart: Chart, direction: 'received' | 'sent'): Card {
  if (!/^(kilobits\/s|kbits\/s)$/i.test(chart.units || '')) return missing
  const sample = latest(data, chart)
  const value = sample?.values[direction]
  if (!sample || !isNumber(value) || (direction === 'received' && value < 0)) return missing
  return { value: `${fmt(Math.abs(value))} kbit/s`, score: Math.abs(value), detail: timeDetail(sample.timestamp) }
}

export function Summary({ charts, enabled, alarms, healthEnabled, historical = false }: { charts: Catalog; enabled: boolean; alarms: Alarm[] | null; healthEnabled: boolean | null; historical?: boolean }) {
  const [summary, setSummary] = useState<Summary>(initial)
  useEffect(() => {
    if (!enabled) { setSummary(initial); return }
    const controller = new AbortController()
    setSummary(initial)
    // Solo se acepta el disco si el catálogo identifica sin ambigüedad el punto de montaje raíz.
    const rootCharts = Object.entries(charts).filter(([, chart]) => chart?.context === 'disk.space' && (chart.family === '/' || chart.chart_labels?.mount_point === '/'))
    const root = rootCharts.length === 1 ? rootCharts[0] : null
    const backupCharts = Object.entries(charts).filter(([, chart]) => chart?.context === 'disk.space' && (chart.family === '/mnt/backup' || chart.chart_labels?.mount_point === '/mnt/backup'))
    const backup = backupCharts.length === 1 ? backupCharts[0] : null
    const requests: Promise<void>[] = []
    const add = (key: keyof Summary, id: string, chart: Chart, convert: (data: Data, meta: Chart) => Card) => {
      if (historical && (!isNumber(chart.first_entry) || chart.first_entry <= 0)) return
      requests.push(fetchChart(id, controller.signal, historical ? chart.first_entry : undefined).then(data => {
        let result = convert(data, chart)
        if (historical) {
          result = missing
          for (const row of Array.isArray(data.data) ? data.data : []) {
            const candidate = convert({ labels: data.labels, data: [row] }, { ...chart, update_every: 1e12 })
            if (isNumber(candidate.score) && (!isNumber(result.score) || candidate.score > result.score)) result = candidate
          }
        }
        if (!controller.signal.aborted) setSummary(current => ({ ...current, [key]: result }))
      }).catch(() => { /* No usar datos del contenedor ni inventar valores. */ }))
    }
    if (charts['system.cpu']) add('cpu', 'system.cpu', charts['system.cpu'], cpuValue)
    if (charts['system.ram']) add('ram', 'system.ram', charts['system.ram'], ramValue)
    if (root) add('disk', root[0], root[1], diskValue)
    if (backup) add('backup', backup[0], backup[1], diskValue)
    if (charts['sensors.cpu_thermal-virtual-0_temperature']) add('temperature', 'sensors.cpu_thermal-virtual-0_temperature', charts['sensors.cpu_thermal-virtual-0_temperature'], temperatureValue)
    if (charts['system.net']) {
      add('network', 'system.net', charts['system.net'], historical ? (data, chart) => networkDirection(data, chart, 'received') : networkValue)
      if (historical) add('upload', 'system.net', charts['system.net'], (data, chart) => networkDirection(data, chart, 'sent'))
    }
    void Promise.all(requests)
    return () => controller.abort()
  }, [charts, enabled, historical])
  const cards = [
    { name: 'CPU', ...summary.cpu },
    { name: 'RAM', ...summary.ram },
    { name: 'GPU', value: 'No disponible', detail: 'Sin una fuente de utilización identificada y compatible' },
    { name: 'Disco', ...summary.disk },
    { name: 'Disco backup', ...summary.backup },
    { name: 'Temperatura CPU', ...summary.temperature },
    { name: historical ? 'Descarga' : 'Red', ...summary.network },
    ...(historical ? [{ name: 'Subida', ...summary.upload }] : []),
    { name: 'Uptime', value: 'No disponible', detail: 'Sin fuente de actividad del anfitrión identificada' },
    ...(!historical ? [{ name: 'Alertas', value: alarms === null ? 'No disponible' : `${alarms.filter(a => a.status === 'WARNING' || a.status === 'CRITICAL').length} activas`, detail: alarms === null ? 'No se pudieron consultar las alertas' : healthEnabled === false ? 'Motor de alertas deshabilitado; no implica seguridad' : healthEnabled === null ? 'Estado del motor desconocido' : 'Avisos y alertas críticas comunicadas por Netdata' }] : []),
  ]
  return <section className="summary-grid" aria-label="Resumen de recursos">{cards.map(card => <article className="card summary-card" key={card.name} aria-label={card.name}><h2>{card.name}</h2><strong>{card.value}</strong><p>{card.detail}</p></article>)}</section>
}
