import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie as RechartsPie,
  Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea,
} from 'recharts'
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
  return <div className="aud-rechart" style={{ height: Math.max(240, data.length * 38 + 65) }}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 15, right: 24, bottom: 12, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" domain={[0, max]} tickFormatter={format} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="label" width={75} tick={{ fontSize: 12 }} interval={0} />
        <Tooltip formatter={value => [format(value), 'Gasto']} />
        {threshold !== null && <ReferenceLine x={threshold} stroke="#c15b48" strokeDasharray="5 4" />}
        <Bar dataKey="value" name="Gasto" radius={[0, 4, 4, 0]} maxBarSize={24}>
          {data.map((item, i) => <Cell key={item.key} fill={threshold !== null && item.value > threshold ? '#c15b48' : colors[i % colors.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
}

function Pie({ data, format = String, emptyMessage = 'No hay vehículos registrados para calcular porcentajes.' }) {
  // Assign colors before filtering so zero-value categories cannot shift colors.
  const coloredData = data.map((d, i) => ({ ...d, color: colors[i % colors.length] }))
  const total = coloredData.reduce((sum, d) => sum + d.value, 0)
  if (!total) return <p>{emptyMessage}</p>
  const visible = coloredData.filter(d => d.value > 0)
  return <div className="aud-pie-layout">
    <div className="aud-rechart-pie">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <RechartsPie data={visible} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius="88%" startAngle={90} endAngle={-270}>
            {visible.map(d => <Cell key={d.key} fill={d.color} />)}
          </RechartsPie>
          <Tooltip formatter={(value, name) => [`${format(value)} (${(Number(value) / total * 100).toFixed(1)}%)`, name]} />
        </PieChart>
      </ResponsiveContainer>
    </div>
    <ul className="aud-legend">{coloredData.map(d => <li key={d.key}>
      <span className="aud-swatch" style={{ background: d.color }} />
      {d.label}: {(d.value / total * 100).toFixed(1)}% ({format(d.value)})
    </li>)}</ul>
  </div>
}

// Illustrative normal model, not an empirical distribution of monthly spending.
function StandardDeviationCurve({ mean, variance }) {
  const mu = Number(mean) || 0
  const sd = Math.sqrt(Math.max(0, Number(variance) || 0))
  if (sd === 0) return <p className="aud-note">La desviación estándar es 0: los 12 meses tienen el mismo gasto y no se puede representar una campana con dispersión.</p>
  const data = Array.from({ length: 161 }, (_, i) => {
    const z = (i - 80) / 20
    return { z, density: Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI) }
  })
  const ticks = [-3, -2, -1, 0, 1, 2, 3]
  return <div className="aud-normal-wrap">
    <div className="aud-rechart-normal">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 30, right: 35, bottom: 25, left: 35 }}>
          <XAxis type="number" dataKey="z" domain={[-4, 4]} ticks={ticks} tickFormatter={z => money(mu + z * sd)} tick={{ fontSize: 11 }} interval={0} />
          <YAxis domain={[0, 0.46]} hide />
          <ReferenceArea x1={-3} x2={3} fill="#e2a65a" fillOpacity={0.12} />
          <ReferenceArea x1={-2} x2={2} fill="#42a5a0" fillOpacity={0.15} />
          <ReferenceArea x1={-1} x2={1} fill="#24658c" fillOpacity={0.18} />
          {ticks.map(z => <ReferenceLine key={z} x={z} stroke="#57aeb8" strokeDasharray={z === 0 ? undefined : '5 5'} label={{ value: z === 0 ? 'μ' : `${z > 0 ? '+' : '−'}${Math.abs(z)}σ`, position: 'top', fontSize: 12 }} />)}
          <Tooltip labelFormatter={z => `Gasto: ${money(mu + Number(z) * sd)}`} formatter={value => [Number(value).toFixed(4), 'Densidad normal estándar']} />
          <Line type="monotone" dataKey="density" stroke="#2485eb" strokeWidth={3} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
    <ul className="aud-legend aud-normal-intervals">
      {[1, 2, 3].map((n, i) => <li key={n}>μ ± {n}σ: {money(mu - n * sd)} – {money(mu + n * sd)} ({['68%', '95%', '99.7%'][i]})</li>)}
    </ul>
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
            format={money}
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
