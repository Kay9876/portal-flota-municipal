import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ClipboardList, Fuel, Key, KeyRound, Loader2, Wrench } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { getDepartmentOptions } from '../utils/vehicleList'
import {
  filterByDepartment,
  countFleet,
  countInWorkshop,
  countKeysOut,
  countKeysNotReturnedYesterday,
  lastDaysRange,
  topVehicleByDepartures,
  fuelCostByDay,
} from '../utils/dashboard'
import './homeDashboard.css'

// "page" = the shortcut works. Without "page" it is a placeholder until that feature exists.
const shortcuts = [
  { label: 'Registrar combustible', description: 'Registrar el combustible despachado a un vehículo', Icon: Fuel, page: 'addFuel' },
  { label: 'Entregar llave', description: 'Registrar la salida de una llave', Icon: Key },
  { label: 'Recibir llave', description: 'Registrar la devolución de una llave', Icon: KeyRound },
  { label: 'Registro diario', description: 'Anotar el uso diario del vehículo', Icon: ClipboardList },
  { label: 'Reportar mantenimiento', description: 'Avisar que un vehículo necesita taller', Icon: Wrench },
]

// Small line chart of the daily fuel cost. Plain SVG, no chart library.
const W = 600
const H = 140
const PAD = 6

const money = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

function shortDate(date) {
  return new Date(date + 'T12:00:00').toLocaleDateString('es-PR', { day: 'numeric', month: 'short' })
}

function FuelCostChart({ points }) {
  const max = Math.max(...points.map((p) => p.total), 0)
  const step = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0
  const coords = points.map((p, i) => {
    const x = PAD + i * step
    const y = max === 0 ? H - PAD : PAD + (1 - p.total / max) * (H - PAD * 2)
    return [x, y]
  })
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${PAD},${H - PAD} ${line} ${(PAD + (points.length - 1) * step).toFixed(1)},${H - PAD}`

  return (
    <figure className="hd-chart">
      <div className="hd-chart-max">Maximo gastado en combustilble en un dia: {money(max)}</div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Costo diario de combustible, de ${shortDate(points[0].date)} a ${shortDate(points[points.length - 1].date)}`}
      >
        <polygon points={area} className="hd-chart-area" />
        <polyline points={line} className="hd-chart-line" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="hd-chart-dates">
        <span>{shortDate(points[0].date)}</span>
        <span>{shortDate(points[points.length - 1].date)}</span>
      </div>
    </figure>
  )
}

// Supabase returns at most 1000 rows per request, so bigger tables are read in pages.
// Without this, totals would silently miss rows. Returns { data, error } like a normal query.
const PAGE_SIZE = 1000
async function fetchAll(makeQuery) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await makeQuery().order('id').range(from, from + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    rows.push(...data)
    if (data.length < PAGE_SIZE) return { data: rows, error: null }
  }
}

function plural(n, one, many) {
  return n === 1 ? one : many
}

// Shortcuts block ("Accesos rápidos").
export function HomeShortcuts({ onNavigate }) {
  return (
    <div className="hd">
      <h2 className="hd-heading hd-heading-first">Accesos rápidos</h2>
      <div className="hd-shortcuts">
        {shortcuts.map(({ label, description, Icon, page }) => (
          <button
            key={label}
            type="button"
            className={'hd-shortcut' + (page ? '' : ' hd-shortcut-soon')}
            disabled={!page}
            onClick={() => page && onNavigate(page)}
          >
            <span className="hd-shortcut-icon"><Icon size={24} strokeWidth={2} aria-hidden="true" /></span>
            <span className="hd-shortcut-label">{label}</span>
            <span className="hd-shortcut-desc">{description}</span>
            {!page && <span className="hd-soon">Próximamente</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

// "Hoy en la flota" block: department dropdown + the three cards.
export function HomeFleetToday() {
  const [vehicles, setVehicles] = useState([])
  const [keyRows, setKeyRows] = useState([])
  const [dailyRows, setDailyRows] = useState([])
  const [fuelRows, setFuelRows] = useState([])
  // Both new widgets look at the last 30 days (the extended dashboard will have its own filters).
  const [range] = useState(() => lastDaysRange(30))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [departmentId, setDepartmentId] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      // Row level security limits both queries to the departments the user can view.
      const [veh, keys, daily, fuel] = await Promise.all([
        supabase
          .from('vehicles')
          .select('id, department_id, is_active, is_in_maintenance, manufacturer, model, license_plate, departments(name)'),
        supabase
          .from('key_register')
          .select('vehicle_id, kr_date, key_pickup, key_handover')
          .not('key_pickup', 'is', null)
          .is('key_handover', null),
        // Every row of daily_register is one trip ("salida").
        fetchAll(() => supabase
          .from('daily_register')
          .select('vehicle_id, departure_date')
          .gte('departure_date', range.start)
          .lte('departure_date', range.end)),
        fetchAll(() => supabase
          .from('fuel_register')
          .select('vehicle_id, dispatch_date, amount_dispatched')
          .gte('dispatch_date', range.start)
          .lte('dispatch_date', range.end)),
      ])
      if (cancelled) return
      const message = veh.error?.message || keys.error?.message || daily.error?.message || fuel.error?.message
      if (message) setError('No se pudo cargar el resumen de la flota: ' + message)
      setVehicles(veh.data || [])
      setKeyRows(keys.data || [])
      setDailyRows(daily.data || [])
      setFuelRows(fuel.data || [])
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [range])

  const departmentOptions = useMemo(() => getDepartmentOptions(vehicles), [vehicles])
  const scoped = useMemo(() => filterByDepartment(vehicles, departmentId), [vehicles, departmentId])
  const fleet = useMemo(() => countFleet(scoped), [scoped])
  const inWorkshop = useMemo(() => countInWorkshop(scoped), [scoped])
  const keysOut = useMemo(() => countKeysOut(scoped, keyRows), [scoped, keyRows])
  const notReturned = useMemo(() => countKeysNotReturnedYesterday(scoped, keyRows), [scoped, keyRows])

  const topVehicle = useMemo(() => topVehicleByDepartures(scoped, dailyRows, range), [scoped, dailyRows, range])
  const fuel = useMemo(() => fuelCostByDay(scoped, fuelRows, range), [scoped, fuelRows, range])

  const dash = '—'

  return (
    <div className="hd">
      <div className="hd-title-row">
        <h2 className="hd-heading">Hoy en la flota</h2>
        <div className="hd-field">
          <label htmlFor="hd-department">Departamento</label>
          <select id="hd-department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">Todos</option>
            {departmentOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="hd-alert" role="alert">
          <AlertCircle size={16} aria-hidden="true" /> {error}
        </div>
      )}

      <div className="hd-cards" aria-busy={loading}>
        <article className="hd-card">
          <p className="hd-card-label">Vehículos disponibles</p>
          <p className="hd-card-value">
            {loading ? <Loader2 size={26} className="hd-spin" aria-label="Cargando" /> : `${fleet.active} de ${fleet.total}`}
          </p>
          <p className="hd-card-note">{loading ? dash : plural(fleet.active, 'disponible', 'disponibles')}</p>
        </article>

        <article className="hd-card">
          <p className="hd-card-label">Vehículos fuera ahora</p>
          <p className="hd-card-value">{loading ? dash : keysOut}</p>
          <p className="hd-card-note">
            {loading ? dash : `${notReturned} ${plural(notReturned, 'llave no se devolvió', 'llaves no se devolvieron')} ayer`}
          </p>
        </article>

        <article className="hd-card">
          <p className="hd-card-label">En el taller</p>
          <p className="hd-card-value">{loading ? dash : inWorkshop}</p>
          <p className="hd-card-note">{loading ? dash : plural(inWorkshop, 'vehículo', 'vehículos')}</p>
        </article>
      </div>

      <div className="hd-row2">
        <article className="hd-card">
          <p className="hd-card-label">Vehículo con más salidas</p>
          <p className="hd-card-value">{loading ? dash : topVehicle ? topVehicle.vehicle.license_plate || 'Sin tablilla' : dash}</p>
          <p className="hd-card-note">
            {loading
              ? dash
              : topVehicle
                ? `${[topVehicle.vehicle.manufacturer, topVehicle.vehicle.model].filter(Boolean).join(' ')} · ${topVehicle.count} ${plural(topVehicle.count, 'salida', 'salidas')}`
                : 'Sin salidas en los últimos 30 días'}
          </p>
          <p className="hd-card-foot">Últimos 30 días</p>
        </article>

        <article className="hd-card">
          <p className="hd-card-label">Gasto de combustible (últimos 30 días)</p>
          <p className="hd-card-value">{loading ? dash : money(fuel.total)}</p>
          {loading ? (
            <p className="hd-card-note">{dash}</p>
          ) : fuel.total > 0 ? (
            <FuelCostChart points={fuel.points} />
          ) : (
            <p className="hd-card-note">Sin registros de combustible en los últimos 30 días</p>
          )}
          <p className="hd-card-foot">Últimos 30 días</p>
        </article>
      </div>

      <div className="hd-cards" style={{ marginTop: 16 }}>
  <article className="hd-card">
    <p className="hd-card-label">Incidentes</p>
    <p className="hd-card-value">—</p>
    <p className="hd-card-note">Todavia sin implementar</p>
  </article>
</div>
    </div>
  )
}
