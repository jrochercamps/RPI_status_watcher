export type Alarm = {
  name?: string
  chart?: string
  status?: string
  info?: string
  value_string?: string
  warn?: string | null
  crit?: string | null
  disabled?: boolean
}

const statusLabel = (alarm: Alarm) => {
  if (alarm.disabled) return 'Deshabilitada'
  switch (alarm.status) {
    case 'WARNING': return 'Advertencia'
    case 'CRITICAL': return 'Crítica'
    case 'CLEAR': return 'Sin activar'
    default: return 'Estado desconocido'
  }
}

export function ChartAlerts({ alarms, healthEnabled, chartIds }: { alarms: Alarm[] | null; healthEnabled: boolean | null; chartIds: string[] }) {
  const related = alarms?.filter(alarm => typeof alarm.chart === 'string' && chartIds.includes(alarm.chart)) ?? []
  return <section className="chart-alerts" aria-label="Límites y alertas de esta gráfica">
    <h3>Límites y alertas de esta gráfica</h3>
    <p>El máximo observado pertenece al intervalo elegido; no es un límite de seguridad del dispositivo.</p>
    {healthEnabled === false && <p className="alert">Netdata indica que la evaluación de alertas está deshabilitada.</p>}
    {alarms === null ? <p>No se pueden consultar las alertas de Netdata.</p> : related.length === 0 ? <p>No hay condiciones asociadas conocidas para esta gráfica. Esto no significa que sea segura.</p> : related.map((alarm, index) => <article className="chart-alarm" key={`${alarm.chart}-${alarm.name}-${index}`}>
      <strong>{alarm.name || 'Alerta sin nombre'} · {statusLabel(alarm)}</strong>
      {alarm.info && <p>{alarm.info}</p>}
      {alarm.value_string && <p>Valor evaluado: {alarm.value_string}</p>}
      {typeof alarm.warn === 'string' && alarm.warn.trim() && <p>Condición de advertencia de Netdata: <code>{alarm.warn}</code></p>}
      {typeof alarm.crit === 'string' && alarm.crit.trim() && <p>Condición crítica de Netdata: <code>{alarm.crit}</code></p>}
      {!alarm.warn && !alarm.crit && <p>Netdata no ha proporcionado las condiciones de esta alerta.</p>}
    </article>)}
    {healthEnabled === null && alarms !== null && <p>Estado del motor de alertas no comunicado por Netdata.</p>}
  </section>
}
