import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

export type Series = { labels?: string[]; data?: (number | null)[][] }
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const display = (value: number | null, unit: string) => value === null ? 'Sin datos' : `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value)}${unit ? ` ${unit}` : ''}`

export function MetricGraph({ series, units }: { series: Series | null; units?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const rawUnit = units?.trim() || ''
  const unit = /^celsius$/i.test(rawUnit) ? '°C' : rawUnit
  const rows = useMemo(() => (series?.data ?? []).filter(row => Array.isArray(row) && number(row[0])).slice().sort((a, b) => (a[0] as number) - (b[0] as number)), [series])
  const labels = series?.labels?.slice(1) ?? []
  const summary = labels.map((name, index) => {
    const values = rows.map(row => row[index + 1]).filter(number)
    const latest = rows[rows.length - 1]?.[index + 1]
    return { name, latest: number(latest) ? latest : null, min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null, average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null }
  })
  const hasValues = summary.some(item => item.min !== null)

  useEffect(() => {
    if (!ref.current || !hasValues) return
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' })
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(ref.current)
    return () => { observer.disconnect(); chart.dispose() }
  }, [hasValues])

  useEffect(() => {
    if (!ref.current || !hasValues) return
    const chart = echarts.getInstanceByDom(ref.current)
    if (!chart) return
    chart.setOption({
      animation: false,
      color: ['#69e3b1', '#7baafa', '#e9bb72', '#d69bef', '#ea8d8d', '#83d6df'],
      grid: { left: 70, right: 25, top: 25, bottom: 65, containLabel: true },
      legend: { bottom: 0, textStyle: { color: '#b9c9c8' }, type: 'scroll' },
      tooltip: { trigger: 'axis', renderMode: 'richText', valueFormatter: (value: unknown) => { const sample = Array.isArray(value) ? value[value.length - 1] : value; return display(number(sample) ? sample : null, unit) } },
      xAxis: { type: 'time', axisLabel: { color: '#9fb2b4', formatter: (value: number) => new Date(value).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }, splitLine: { show: false } },
      yAxis: { type: 'value', name: unit, nameTextStyle: { color: '#9fb2b4' }, scale: true, axisLabel: { color: '#9fb2b4' }, splitLine: { lineStyle: { color: '#26343a' } } },
      series: labels.map((name, index) => ({ name, type: 'line', showSymbol: rows.length < 3, connectNulls: false, data: rows.map(row => [(row[0] as number) * 1000, number(row[index + 1]) ? row[index + 1] : null]) })),
    }, { notMerge: true })
  }, [rows, series, hasValues, unit])

  if (!series) return <div className="chart-empty">Consultando datos…</div>
  if (!hasValues) return <div className="chart-empty">Sin datos disponibles para este intervalo</div>
  const lastTime = rows[rows.length - 1]?.[0]
  return <>
    <p className="metric-note">Última muestra: {number(lastTime) ? new Date(lastTime * 1000).toLocaleString('es-ES') : 'fecha desconocida'}. Estadísticas calculadas sobre las muestras recibidas.</p>
    <div className="metric-summary">{summary.map(item => <div className="metric-value" key={item.name}><strong>{item.name}</strong><span>{display(item.latest, unit)}</span><small>Mín. {display(item.min, unit)} · Media {display(item.average, unit)} · Máx. {display(item.max, unit)}</small></div>)}</div>
    <div className="metric-chart" ref={ref} role="img" aria-label="Serie temporal interactiva" />
  </>
}
