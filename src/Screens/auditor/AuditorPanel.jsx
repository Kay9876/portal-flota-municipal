import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import './AuditorPanel.css'

const money = value => new Intl.NumberFormat('es-PR', { style: 'currency', currency: 'USD' }).format(Number(value) || 0)
const dateInput = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const today = dateInput(new Date())
const initialStart = (() => { const d = new Date(); d.setMonth(d.getMonth() - 5); return dateInput(d) })()
const colors = ['#24658c', '#42a5a0', '#e2a65a', '#7e72ac', '#ca7776', '#83a85e', '#5c8fbd', '#d2b75e']

function Bars({ data, format = value => value, threshold = null }) {
  if (!data.length) return <p>No hay datos para mostrar.</p>
  const max = Math.max(1, ...data.map(d => Number(d.value)), threshold || 0)
  return <div className="aud-bars">{data.map((item, index) => <div className="aud-bar-row" key={item.key ?? index}>
    <span title={item.label}>{item.label}</span>
    <div className="aud-track"><div className="aud-fill" style={{ width: `${Math.max(0, Number(item.value)) / max * 100}%`, background: colors[index % colors.length] }} /></div>
    <strong>{format(item.value)}</strong>
  </div>)}{threshold !== null && <p className="aud-note">Umbral configurado: {format(threshold)}. Los valores que lo superan se indican abajo.</p>}</div>
}
function Pie({ data }) {
  const total = data.reduce((sum, item) => sum + Number(item.value), 0)
  if (!total) return <p>No hay vehículos registrados para calcular porcentajes.</p>
  let offset = 0
  const stops = data.filter(d => d.value > 0).map((item, index) => {
    const from = offset; offset += item.value / total * 100
    return `${colors[index % colors.length]} ${from}% ${offset}%`
  })
  return <div className="aud-pie-layout"><div className="aud-pie" role="img" aria-label="Distribución porcentual de vehículos por departamento" style={{ background: `conic-gradient(${stops.join(', ')})` }} />
    <ul className="aud-legend">{data.map((item, index) => <li key={item.key}><span className="aud-swatch" style={{ background: colors[index % colors.length] }} />{item.label}: {(Number(item.value) / total * 100).toFixed(1)}% ({item.value})</li>)}</ul>
  </div>
}
export default function AuditorPanel() {
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(today)
  const [threshold, setThreshold] = useState('1000')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    let alive = true
    async function load() {
      if (start > end || end > today) { setError('Selecciona un intervalo válido que no termine en el futuro.'); setData(null); return }
      setLoading(true); setError('')
      const result = await supabase.rpc('auditor_dashboard', { p_start: start, p_end: end })
      if (alive) { if (result.error) { setError(result.error.message); setData(null) } else setData(result.data); setLoading(false) }
    }
    load()
    return () => { alive = false }
  }, [start, end])
  const departments = (data?.departments || []).map(d => ({ key: d.id, label: d.name || `Departamento ${d.id}`, value: Number(d.count) }))
  const period = (data?.fuel_period || []).map(d => ({ key: d.month, label: d.month.slice(0, 7), value: Number(d.total) }))
  const last12 = (data?.fuel_12_months || []).map(d => ({ key: d.month, label: d.month.slice(0, 7), value: Number(d.total) }))
  const limit = Math.max(0, Number(threshold) || 0)
  const mean = Number(data?.fuel_mean) || 0
  const sd = Number(data?.fuel_stddev) || 0
  return <div className="auditor-page">
    <div className="section-heading"><div><h1>Panel del Auditor</h1><p>Análisis de la flota municipal · Acceso exclusivo para visores globales</p></div></div>
    <div className="aud-controls admin-panel"><label>Desde <input aria-label="Fecha inicial" type="date" value={start} max={today} onChange={e => setStart(e.target.value)} /></label><label>Hasta <input aria-label="Fecha final" type="date" value={end} max={today} onChange={e => setEnd(e.target.value)} /></label><label>Umbral monetario (USD) <input aria-label="Umbral monetario" type="number" min="0" step="0.01" value={threshold} onChange={e => setThreshold(e.target.value)} /></label></div>
    {loading && <p role="status">Cargando indicadores…</p>}
    {error && <div role="alert" className="admin-alert error">{error}</div>}
    {!loading && data && <>
      <details className="aud-section" open><summary>1. Departamentos</summary><div className="aud-section-body"><div className="aud-card"><h3>Vehículos por departamento</h3><Bars data={departments} /></div><div className="aud-card"><h3>Participación de cada departamento en la flota</h3><Pie data={departments} /><p className="aud-note">La proporción se calcula con vehículos asignados por departamento, no con registros de uso diario.</p></div></div></details>
      <details className="aud-section" open><summary>2. Combustible</summary><div className="aud-section-body"><div className="aud-card"><h3>Gastos por mes · intervalo seleccionado</h3><Bars data={period} format={money} threshold={limit} /><p className="aud-note">Meses que superan el umbral: {period.filter(d => d.value > limit).map(d => d.label).join(', ') || 'Ninguno'}. Fuente: fuel_register.amount_dispatched.</p></div><div className="aud-card"><h3>Desviación estándar · últimos 12 meses</h3><p>Promedio mensual: <strong>{money(mean)}</strong> · Desviación estándar poblacional: <strong>{money(sd)}</strong></p><Bars data={last12} format={money} /><p className="aud-note">Banda de referencia: {money(Math.max(0, mean - sd))} a {money(mean + sd)} (promedio ± 1σ). Incluye meses sin registros como cero.</p></div></div></details>
      <details className="aud-section"><summary>3. Registro de llaves</summary><div className="aud-placeholder">Próximamente. Los gráficos se incorporarán cuando se implemente esta funcionalidad.</div></details>
      <details className="aud-section"><summary>4. Mantenimiento</summary><div className="aud-placeholder">Próximamente. Los gráficos se incorporarán cuando se implemente esta funcionalidad.</div></details>
    </>}
  </div>
}
