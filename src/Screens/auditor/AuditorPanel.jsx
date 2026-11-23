import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import './AuditorPanel.css'

const money = value => new Intl.NumberFormat('es-PR', { style: 'currency', currency: 'USD' }).format(Number(value) || 0)
const dateInput = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = dateInput(new Date())
const monthsAgo = count => { const d = new Date(); d.setMonth(d.getMonth() - count); return dateInput(d) }
const colors = ['#24658c', '#42a5a0', '#e2a65a', '#7e72ac', '#ca7776', '#83a85e', '#5c8fbd', '#d2b75e']

function Bars({ data, format = String, threshold = null }) {
  if (!data.length) return <p>No hay datos para mostrar.</p>
  const max = Math.max(1, ...data.map(d => Number(d.value)), threshold ?? 0)
  return <div className="aud-bars">{data.map((item, i) => <div className="aud-bar-row" key={item.key}>
    <span title={item.label}>{item.label}</span>
    <div className="aud-track"><div className="aud-fill" style={{ width: `${Math.max(0, Number(item.value)) / max * 100}%`, background: threshold !== null && item.value > threshold ? '#c15b48' : colors[i % colors.length] }} /></div>
    <strong>{format(item.value)}</strong>
  </div>)}</div>
}
function Pie({ data, emptyMessage = 'No hay vehículos registrados para calcular porcentajes.' }) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  if (!total) return <p>{emptyMessage}</p>
  let offset = 0
  const stops = data.map((d, i) => ({ ...d, color: colors[i % colors.length] })).filter(d => d.value > 0).map(d => { const start = offset; offset += d.value / total * 100; return `${d.color} ${start}% ${offset}%` })
  return <div className="aud-pie-layout"><div className="aud-pie" role="img" aria-label="Distribución porcentual" style={{ background: `conic-gradient(${stops.join(', ')})` }} />
    <ul className="aud-legend">{data.map((d, i) => <li key={d.key}><span className="aud-swatch" style={{ background: colors[i % colors.length] }} />{d.label}: {(d.value / total * 100).toFixed(1)}% ({d.value})</li>)}</ul>
  </div>
}

// Normal-distribution reference curve based on the observed monthly mean and SD.
// This is an illustrative model; monthly spending is not assumed to be normally distributed.
function StandardDeviationCurve({ mean, variance }) {
  const mu = Number(mean) || 0
  const sd = Math.sqrt(Math.max(0, Number(variance) || 0))
  if (sd === 0) return <p className="aud-note">La desviación estándar es 0: los 12 meses tienen el mismo gasto y no se puede representar una campana con dispersión.</p>
  const left = 64, right = 856, top = 42, baseline = 320
  const center = (left + right) / 2
  const unit = (right - left) / 8 // show -4σ to +4σ
  const x = z => center + z * unit
  const y = z => baseline - Math.exp(-0.5 * z * z) * 235
  const curve = Array.from({ length: 161 }, (_, i) => {
    const z = -4 + i * 0.05
    return `${i === 0 ? 'M' : 'L'} ${x(z).toFixed(2)} ${y(z).toFixed(2)}`
  }).join(' ')
  const bands = [
    { n: 3, label: '99.7%', height: 292, color: '#a78bfa' },
    { n: 2, label: '95%', height: 250, color: '#a78bfa' },
    { n: 1, label: '68%', height: 196, color: '#a78bfa' },
  ]
  return <div className="aud-normal-wrap">
    <svg className="aud-normal-curve" viewBox="0 0 920 385" role="img" aria-label={`Curva normal ilustrativa. Promedio ${money(mu)}; desviación estándar ${money(sd)}; intervalos a una, dos y tres desviaciones estándar.`}>
      <line x1={left} y1={baseline} x2={right} y2={baseline} stroke="#23365f" strokeWidth="3" />
      {[-3,-2,-1,0,1,2,3].map(n => <g key={n}>
        <line x1={x(n)} y1={baseline} x2={x(n)} y2={y(n)} stroke={n === 0 ? '#19b8aa' : '#57c8ce'} strokeWidth="1.6" strokeDasharray={n === 0 ? undefined : '7 6'} />
        <line x1={x(n)} y1={baseline} x2={x(n)} y2={baseline+8} stroke="#23365f" strokeWidth="2" />
        <text x={x(n)} y={baseline+27} textAnchor="middle" fontSize="14" fill="#243c65">{n === 0 ? 'μ' : `${n > 0 ? '+' : '−'}${Math.abs(n)}σ`}</text>
        <text x={x(n)} y={baseline+46} textAnchor="middle" fontSize="11" fill="#536780">{money(mu+n*sd)}</text>
      </g>)}
      {bands.map(({n,label,height,color}) => <g key={n}>
        <line x1={x(-n)} y1={height} x2={x(n)} y2={height} stroke={color} strokeWidth="2" />
        <path d={`M ${x(-n)+7} ${height-4} L ${x(-n)} ${height} L ${x(-n)+7} ${height+4} M ${x(n)-7} ${height-4} L ${x(n)} ${height} L ${x(n)-7} ${height+4}`} fill="none" stroke={color} strokeWidth="2" />
        <rect x={center-31} y={height-23} width="62" height="21" rx="5" fill="white" />
        <text x={center} y={height-8} textAnchor="middle" fontSize="16" fontWeight="700" fill="#243c65">{label}</text>
      </g>)}
      <path d={curve} fill="none" stroke="#2485eb" strokeWidth="4" strokeLinecap="round" />
    </svg>
    <p className="aud-note">Curva normal de referencia construida con el promedio y la desviación estándar de los gastos mensuales. Los porcentajes 68%, 95% y 99.7% son teóricos si los datos siguen una distribución normal; no son porcentajes observados de los registros.</p>
  </div>
}

function DateControls({ start, end, onStart, onEnd }) {
  return <><label>Desde<input type="date" value={start} max={today} onChange={e => onStart(e.target.value)} /></label><label>Hasta<input type="date" value={end} max={today} onChange={e => onEnd(e.target.value)} /></label></>
}
function validateRange(start, end) {
  return !start || !end || start > end || end > today ? 'Selecciona un intervalo válido que no termine en el futuro.' : ''
}
export default function AuditorPanel() {
  const [fuelStart, setFuelStart] = useState(monthsAgo(5))
  const [fuelEnd, setFuelEnd] = useState(today)
  const [fuelThreshold, setFuelThreshold] = useState('1000')
  const [fuelDepartment, setFuelDepartment] = useState('all')
  const [fuelTop, setFuelTop] = useState('all')
  const [keyStart, setKeyStart] = useState(monthsAgo(5))
  const [keyEnd, setKeyEnd] = useState(today)
  const [maintenanceStart, setMaintenanceStart] = useState(monthsAgo(5))
  const [maintenanceEnd, setMaintenanceEnd] = useState(today)
  const [maintenanceThreshold, setMaintenanceThreshold] = useState('1000')
  const [departments, setDepartments] = useState([])
  const [fuelData, setFuelData] = useState(null)
  const [fuelDepartmentsData, setFuelDepartmentsData] = useState([])
  const [fuelDepartmentsLoading, setFuelDepartmentsLoading] = useState(false)
  const [fuelDepartmentsError, setFuelDepartmentsError] = useState('')
  const [maintenanceData, setMaintenanceData] = useState(null)
  const [maintenanceLoading, setMaintenanceLoading] = useState(false)
  const [maintenanceError, setMaintenanceError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // Department counts do not depend on any category's filters.
  useEffect(() => {
    let alive = true
    async function loadDepartments() {
      const { data, error } = await supabase.rpc('auditor_departments')
      if (!alive) return
      if (error) setError(error.message)
      else setDepartments(data || [])
    }
    loadDepartments()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    const validationError = validateRange(fuelStart, fuelEnd)
    if (validationError) { setError(validationError); setFuelData(null); setLoading(false); return }
    async function loadFuel() {
      setLoading(true); setError('')
      const { data, error } = await supabase.rpc('auditor_fuel_v2', {
        p_start: fuelStart, p_end: fuelEnd,
        p_department_id: fuelDepartment === 'all' ? null : Number(fuelDepartment),
        p_top: fuelTop === 'all' ? null : Number(fuelTop),
      })
      if (!alive) return
      if (error) { setError(error.message); setFuelData(null) }
      else setFuelData(data)
      setLoading(false)
    }
    loadFuel()
    return () => { alive = false }
  }, [fuelStart, fuelEnd, fuelDepartment, fuelTop])

  // This RPC depends ONLY on the fuel date range, not department, Top N or monetary threshold.
  useEffect(() => {
    let alive = true
    const validationError = validateRange(fuelStart, fuelEnd)
    if (validationError) {
      setFuelDepartmentsError(validationError)
      setFuelDepartmentsData([])
      setFuelDepartmentsLoading(false)
      return () => { alive = false }
    }
    async function loadFuelDepartments() {
      setFuelDepartmentsLoading(true)
      setFuelDepartmentsError('')
      const { data, error } = await supabase.rpc('auditor_fuel_departments', {
        p_start: fuelStart,
        p_end: fuelEnd,
      })
      if (!alive) return
      if (error) {
        setFuelDepartmentsError(error.message)
        setFuelDepartmentsData([])
      } else {
        setFuelDepartmentsData(data || [])
      }
      setFuelDepartmentsLoading(false)
    }
    loadFuelDepartments()
    return () => { alive = false }
  }, [fuelStart, fuelEnd])

  useEffect(() => {
    let alive = true
    const validationError = validateRange(maintenanceStart, maintenanceEnd)
    if (validationError) {
      setMaintenanceError(validationError)
      setMaintenanceData(null)
      setMaintenanceLoading(false)
      return () => { alive = false }
    }
    async function loadMaintenance() {
      setMaintenanceLoading(true)
      setMaintenanceError('')
      const { data, error } = await supabase.rpc('auditor_maintenance_status', {
        p_start: maintenanceStart,
        p_end: maintenanceEnd,
      })
      if (!alive) return
      if (error) {
        setMaintenanceError(error.message)
        setMaintenanceData(null)
      } else {
        setMaintenanceData(data || [])
      }
      setMaintenanceLoading(false)
    }
    loadMaintenance()
    return () => { alive = false }
  }, [maintenanceStart, maintenanceEnd])

  const departmentChart = departments.map(d => ({ key: d.id, label: d.name || `Departamento ${d.id}`, value: Number(d.count) || 0 }))
  const period = (fuelData?.fuel_period || []).map(d => ({ key: d.month, label: String(d.month).slice(0, 7), value: Number(d.total) || 0 }))
  const limit = Math.max(0, Number(fuelThreshold) || 0)
  return <div className="auditor-page">
    <div className="section-heading"><div><h1>Panel del Auditor</h1><p>Análisis de la flota municipal · Acceso exclusivo para visores globales</p></div></div>
    {error && <div role="alert" className="admin-alert error">{error}</div>}
    <details className="aud-section" open><summary>1. Departamentos</summary><div className="aud-section-body">
      <div className="aud-card"><h3>Participación de cada departamento en la flota</h3><Pie data={departmentChart} /><p className="aud-note">Se muestran vehículos asignados, no frecuencia real de uso.</p></div>
    </div></details>
    <details className="aud-section" open><summary>2. Combustible</summary><div className="aud-section-body">
      <div className="aud-controls aud-controls-wide"><DateControls start={fuelStart} end={fuelEnd} onStart={setFuelStart} onEnd={setFuelEnd} />
        <label>Límite de gasto mensual (USD)<input type="number" min="0" step="0.01" value={fuelThreshold} onChange={e => setFuelThreshold(e.target.value)} /></label>
        <label>Departamento<select value={fuelDepartment} onChange={e => setFuelDepartment(e.target.value)}><option value="all">Todos los departamentos</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name || `Departamento ${d.id}`}</option>)}</select></label>
        <label>Vehículos<select value={fuelTop} onChange={e => setFuelTop(e.target.value)}><option value="all">Todos</option><option value="5">Top 5</option><option value="10">Top 10</option></select></label>
      </div>
      <div className="aud-card aud-card-full">
        <h3>Distribución de gastos de combustible por departamento</h3>
        {fuelDepartmentsError && <div role="alert" className="admin-alert error">{fuelDepartmentsError}</div>}
        {fuelDepartmentsLoading ? <p role="status">Cargando gastos por departamento…</p> : !fuelDepartmentsError && <>
          <Pie
            data={fuelDepartmentsData.map(d => ({
              key: d.id === null ? 'sin-departamento' : String(d.id),
              label: d.name || 'Sin departamento',
              value: Number(d.total) || 0,
            }))}
            emptyMessage="No hay gastos de combustible registrados en el período seleccionado."
          />
          <p className="aud-note">Este gráfico utiliza exclusivamente las fechas Desde y Hasta. No cambia con el departamento seleccionado, Top N ni el límite de gasto mensual. Los gastos se atribuyen al departamento actualmente asignado al vehículo.</p>
        </>}
      </div>
      {loading ? <p role="status">Cargando combustible…</p> : fuelData && <>
        <div className="aud-card"><h3>Gasto mensual · período seleccionado</h3><Bars data={period} format={money} threshold={limit} /><p className="aud-note">Meses sobre el límite: {period.filter(d => d.value > limit).map(d => d.label).join(', ') || 'Ninguno'}. Top de vehículos ordenado por gasto total en el período seleccionado.</p></div>
        <div className="aud-card aud-card-full"><h3>Desviación estándar · últimos 12 meses</h3><p>Promedio mensual (μ): <strong>{money(fuelData.fuel_mean)}</strong> · Desviación estándar (σ): <strong>{money(Math.sqrt(Math.max(0, Number(fuelData.fuel_variance) || 0)))}</strong></p>
          <StandardDeviationCurve mean={fuelData.fuel_mean} variance={fuelData.fuel_variance} /><p className="aud-note">Se incluyen los meses sin registros como cero. El departamento y Top N se aplican a ambos gráficos; el período de esta curva permanece en los últimos 12 meses.</p></div>
      </>}
    </div></details>
    <details className="aud-section"><summary>3. Registro de llaves</summary><div className="aud-section-body"><div className="aud-controls aud-controls-wide"><DateControls start={keyStart} end={keyEnd} onStart={setKeyStart} onEnd={setKeyEnd} /></div><div className="aud-placeholder">{validateRange(keyStart, keyEnd) || 'Próximamente. No hay gráficos implementados todavía.'}</div></div></details>
    <details className="aud-section"><summary>4. Mantenimiento</summary><div className="aud-section-body"><div className="aud-controls aud-controls-wide"><DateControls start={maintenanceStart} end={maintenanceEnd} onStart={setMaintenanceStart} onEnd={setMaintenanceEnd} /><label>Límite de gasto mensual (USD)<input type="number" min="0" step="0.01" value={maintenanceThreshold} onChange={e => setMaintenanceThreshold(e.target.value)} /></label></div>{maintenanceError && <div role="alert" className="admin-alert error">{maintenanceError}</div>}
      {maintenanceLoading ? <p role="status">Cargando mantenimiento…</p> : !maintenanceError && <div className="aud-card aud-card-full">
        <h3>Estado de solicitudes de mantenimiento</h3>
        <Pie data={(maintenanceData || []).map(d => ({ key: d.status, label: d.label, value: Number(d.count) || 0 }))} emptyMessage="No hay solicitudes de mantenimiento en el período seleccionado." />
        <p className="aud-note">Se cuentan solicitudes creadas entre las fechas seleccionadas según su estado actual. «Cerrada» incluye solicitudes completadas y canceladas. El límite de gasto mensual no afecta este gráfico.</p>
      </div>}</div></details>
  </div>
}
