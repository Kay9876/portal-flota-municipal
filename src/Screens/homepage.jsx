// Dashboard principal. La autorización real de cada operación se aplica también en Supabase.
import { useEffect, useMemo, useState } from 'react'
import {
  CarFront, TriangleAlert, Wrench, ClipboardList, Fuel, House,
  Building2, CalendarDays, KeyRound, ChartNoAxesCombined, Users, Settings, LogOut,
  AlertCircle, Loader2, 
} from 'lucide-react'
import { supabase } from '../supabaseClient'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import escudoVA from 'url:../assets/escudoVA.png'
import AddVehicle from './addVehicle'
import AdminUsers from './adminIT/AdminUsers'
import AddFuel from './addFuel'
import ViewVehicles from './viewVehicles'
import ViewVehicleInfo from './viewVehicleInfo'
import Departments from './departments'
import AuditorPanel from './auditor/AuditorPanel'
import AddDailyLog from './addDailyLog'
import ReportIssue from './reportIssue'
import KeyControl from './keyControl'
import IncidentReport from './incidentReport'
import { getDepartmentOptions } from '../utils/vehicleList'
import {
  filterByDepartment,
  countFleet,
  countInWorkshop,
  countKeysOut,
  countKeysNotReturnedYesterday,
  lastDaysRange,
  topVehicleByDepartures,
  keysOutList,
  incidentsForDepartment,
  recentIncidents,
  formatWhen, 
  fuelCostFromDaily,
} from '../utils/dashboardHelper'
import './homepage.css'

// const vehicleStats = [
//   { label: 'Total de vehículos', value: '—', Icon: CarFront, color: 'navy' },
//   { label: 'En uso', value: '—', Icon: Car, color: 'green' },
//   { label: 'Fuera de servicio', value: '—', Icon: TriangleAlert, color: 'red' },
//   { label: 'En mantenimiento', value: '—', Icon: Wrench, color: 'navy' },
// ]

const quickActions = [
  { label: 'Registrar uso diario', Icon: ClipboardList, page: 'daily' },
  { label: 'Registrar combustible', Icon: Fuel, page: 'addFuel' },
  { label: 'Registrar mantenimiento', Icon: Wrench, page: 'reportIssue' },
  { label: 'Registrar incidente', Icon: TriangleAlert, page: 'incidentReport' },
  { label: 'Entregar ó Recibir Llaves', Icon: KeyRound, page: 'keys'}
]


const money = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

function shortDate(date) {
  return new Date(date + 'T12:00:00').toLocaleDateString('es-PR', { day: 'numeric', month: 'short' })
}

function FuelCostChart({ points }) {
 return (
    <div className="hd-chart" role="img" aria-label={`Costo diario de combustible, de ${shortDate(points[0].date)} a ${shortDate(points[points.length - 1].date)}`}>
      <ResponsiveContainer width="100%" height={150}>
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="date" tickFormatter={shortDate} interval="preserveStartEnd" tick={{ fontSize: 12, fill: '#667085' }} tickLine={false} axisLine={false} />
          <YAxis width={56} tickFormatter={(v) => '$' + v.toLocaleString('en-US')} tick={{ fontSize: 12, fill: '#667085' }} tickLine={false} axisLine={false} />
          <Tooltip labelFormatter={shortDate} formatter={(value) => [money(value), 'Combustible']} />
          <Area type="monotone" dataKey="total" stroke="#1d5fa8" strokeWidth={2} fill="#e8f1fb" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
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
function HomeShortcuts({ onNavigate }) {
  return (
    <div className="hd">
      <h2 className="hd-heading hd-heading-first">Accesos rápidos</h2>
      <div className="hd-shortcuts">
        {quickActions.map(({ label, description, Icon, page }) => (
          <button
            key={label}
            type="button"
            className={'hd-shortcut' + (page ? '' : ' hd-shortcut-soon')}
            disabled={!page}
            onClick={() => page && onNavigate(page)}
          >
            <span className="hd-shortcut-icon"><Icon size={24} strokeWidth={2} aria-hidden="true" /></span>
            <span className="hd-shortcut-label">{label}</span>
            {description && <span className="hd-shortcut-desc">{description}</span>}
            {!page && <span className="hd-soon">Próximamente</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

// "Hoy en la flota" block: department dropdown + the three cards.
function HomeFleetToday() {
  const [vehicles, setVehicles] = useState([])
  const [keyRows, setKeyRows] = useState([])
  const [dailyRows, setDailyRows] = useState([])
  const [fuelRows, setFuelRows] = useState([])
  const [incidentRows, setIncidentRows] = useState([])
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
      const [veh, keys, daily, fuel, incidents] = await Promise.all([
        supabase
          .from('vehicles')
          .select('id, department_id, is_active, manufacturer, model, license_plate, departments(name)'),
        supabase
         .from('key_register')
          .select('vehicle_id, kr_date, key_pickup, key_handover, return_unknown, driver_name')
          .not('key_pickup', 'is', null)
          .or('key_handover.is.null,return_unknown.eq.true'),
        // Every row of daily_register is one trip ("salida").
        fetchAll(() => supabase
          .from('daily_register')
          .select('vehicle_id, departure_date')
          .gte('departure_date', range.start)
          .lte('departure_date', range.end)),
        
        supabase.rpc('fuel_cost_by_day', { p_start: range.start, p_end: range.end }),

        fetchAll(() => supabase
        .from('incident_reports')
        .select('id, created_at, plate, description, reporter_department_id')
        .gte('created_at', range.start + 'T00:00:00-04:00'))
      ])
        
      if (cancelled) return
      const message = veh.error?.message || keys.error?.message || daily.error?.message || fuel.error?.message || incidents.error?.message
      if (message) setError('No se pudo cargar el resumen de la flota: ' + message)
      setVehicles(veh.data || [])
      setKeyRows(keys.data || [])
      setDailyRows(daily.data || [])
      setFuelRows(fuel.data || [])
      setIncidentRows(incidents.data || [])
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
  const fuel = useMemo(() => fuelCostFromDaily(fuelRows, departmentId, range), [fuelRows, departmentId, range])
  const outList =  useMemo(() => keysOutList(scoped, keyRows), [scoped, keyRows])
  const incidents = useMemo(() => recentIncidents(incidentsForDepartment(incidentRows, departmentId), range),
    [incidentRows, departmentId, range],)

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
          {!loading && outList.length > 0 && (
            <ul className="hd-list">
              {outList.map(({ vehicle, driver_name, key_pickup }) => (
                <li key={vehicle.id}>
                  <strong>{vehicle.license_plate || 'Sin tablilla'}</strong>
                  <span>{[driver_name, 'desde ' + formatWhen(key_pickup)].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ul>
          )}
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
          <p className="hd-card-label">Costo de combustible</p>
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
          <p className="hd-card-value">{loading ? dash : incidents.count}</p>
          <p className="hd-card-note">
            {loading ? dash : `${plural(incidents.count, 'incidente reportado', 'incidentes reportados')} en los últimos 30 días`}
          </p>
          {!loading && incidents.latest.length > 0 && (
            <ul className="hd-list hd-list-full">
              {incidents.latest.map((i) => (
                <li key={i.id}>
                  <strong>{i.plate}</strong>
                  <span className="hd-list-text">{i.description}</span>
                  <small>{formatWhen(i.created_at)}</small>
                </li>
              ))}
            </ul>
          )}
          {departmentId && <p className="hd-card-foot">Incidentes reportados por el departamento seleccionado</p>}
        </article>
      </div>
    </div>
  )
}

const baseSidebarItems = [
  { label: 'Inicio', Icon: House, page: 'home' },
  { label: 'Vehículos', Icon: CarFront, page: 'vehicles' },
  { label: 'Registros diarios', Icon: CalendarDays, page: 'daily' },
  { label: 'Recibos de combustible', Icon: Fuel, page: 'fuel' },
  { label: 'Mantenimiento', Icon: Wrench, page: 'maintenance' },
  { label: 'Llaves', Icon: KeyRound, page: 'keys' },
  { label: 'Reportes', Icon: ChartNoAxesCombined, page: 'reports' },
]

export default function Homepage({ user, onSignOut }) {
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState('')
  const [activePage, setActivePage] = useState('home')
  const [showAddVehicle, setShowAddVehicle] = useState(false)
  const [selectedVehicleId,setSelectedVehicleId] = useState(null)

  useEffect(() => {
    let alive = true
    async function loadProfile() {
      setProfileLoading(true)
      const { data, error } = await supabase.from('profiles')
        .select('id,first_name,last_name,second_last_name,department_id,is_admin,is_global_viewer,is_mechanic,is_director,is_active')
        .eq('id', user.id).maybeSingle()
      if (!alive) return
      if (error) setProfileError(error.message)
      setProfile(data || null)
      setProfileLoading(false)
    }
    loadProfile()
    return () => { alive = false }
  }, [user.id])

  const isAdmin = profile?.is_admin === true && profile?.is_active !== false
  const isAuditor = profile?.is_active === true && (profile?.is_global_viewer === true || profile?.is_director === true)
  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || user?.email || 'Usuario'
  const roleLabel = isAdmin ? 'Administrador' : profile?.is_global_viewer ? 'Visor global' : profile?.is_director ? 'Director' : 'Usuario'
  const sidebarItems = [
  ...baseSidebarItems,

  ...(isAuditor
    ? [
        {
          label: 'Panel Analítico',
          Icon: ChartNoAxesCombined,
          page: 'auditor',
        },
      ]
    : []),

  ...(isAdmin
    ? [
        { label: 'Usuarios', Icon: Users, page: 'users' },
        { label: 'Departamentos', Icon: Building2, page: 'departments' },
        { label: 'Configuración', Icon: Settings, page: 'settings' },
      ]
    : []),
]


  function navigate(page) {
    if (page === 'auditor' && !isAuditor) return
    setActivePage(page)
    setShowAddVehicle(false)
    setProfileError('')
    setSelectedVehicleId(null)
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand"><div className="sidebar-brand">
          <div className="logo-box"><img src={escudoVA} alt="Escudo del Municipio de Vega Alta" /></div>
          <div><h2>Municipio de Vega Alta</h2><p>Gestión de Flota Municipal</p></div>
        </div></div>
        <nav className="sidebar-nav" aria-label="Navegación principal">
          {sidebarItems.map(({ label, Icon, page }) => (
            <button type="button" key={page} className={`sidebar-nav-button ${activePage === page && !showAddVehicle ? 'active' : ''}`} onClick={() => navigate(page)}>
              <span className="nav-icon"><Icon size={21} strokeWidth={2} /></span><span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div className="user-profile">
            <span className="avatar">{displayName.slice(0, 2).toUpperCase()}</span>
            <div><strong>{displayName}</strong><p>{profileLoading ? 'Cargando perfil…' : roleLabel}</p></div>
            <button className="btn-ghost" type="button" onClick={onSignOut}><LogOut size={16} /> Salir</button>
          </div>
        </header>

        <section className="page-content">
          {profileError && <div className="admin-alert error">No se pudo cargar tu perfil: {profileError}</div>}
          {!profileLoading && !profile && <div className="admin-alert error">No se encontró un perfil para esta cuenta. Contacta al administrador del sistema.</div>}
          {activePage === 'auditor' ? (
            !profileLoading && isAuditor ? <AuditorPanel key={user.id} isGlobalViewer={profile?.is_global_viewer === true} /> : <div className="admin-alert error">Acceso restringido a directores y visores globales activos.</div>
          ) : activePage === 'users' && isAdmin ? (
            <AdminUsers onBack={() => navigate('home')} />
          ) : showAddVehicle ? (
            <AddVehicle onDone={() => setShowAddVehicle(false)} />
          ) : activePage === 'home' ? (
            <>
              <HomeShortcuts onNavigate={navigate} />
              {isAdmin && <div className="hd-between"><div className="admin-shortcut"><div><strong>Administración del sistema</strong><p>Gestiona cuentas y permisos de acceso.</p></div><button className="admin-button primary" type="button" onClick={() => navigate('users')}><Users size={17} /> Gestionar usuarios</button></div></div>}
              <div className="section-heading"><div><h1>Resumen de la Flota</h1><p className="admin-subtitle">Bienvenido/a, {displayName}</p></div><span>{new Date().toLocaleDateString('es-PR', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
              <HomeFleetToday />
            </>
          ) : activePage === 'addFuel' ? (
            <AddFuel onDone={()=>navigate('home')}/>
          ): activePage === 'daily' ? (
            <AddDailyLog onDone={()=>navigate('home')}/>
          ): activePage==='reportIssue'?(
            <ReportIssue user={user} profile={profile} onDone={()=>navigate('home')}/>
          ): activePage==='incidentReport'?(
            <IncidentReport user={user} profile={profile} onDone={()=>navigate('home')}/>
          ): activePage==='keys'?(
            <KeyControl onDone={()=>navigate('home')}/>
          ): activePage=== 'vehicles'?(
          selectedVehicleId!==null?(
            <ViewVehicleInfo 
            vehicleId={selectedVehicleId}
            onBack={()=>setSelectedVehicleId(null)}
            />
          ) : (
            <ViewVehicles pressViewVehicle={setSelectedVehicleId} />
          )
          ) : activePage === 'departments' && isAdmin ? (<Departments />          
          ) : activePage === 'settings' && isAdmin ? (
            <div className="admin-panel"><h1>Configuración</h1><p>La configuración del sistema estará disponible aquí.</p></div>
          ) : (
            <div className="admin-panel"><h1>{sidebarItems.find(item => item.page === activePage)?.label || 'Sección'}</h1><p>Esta pantalla todavía no está implementada. La navegación está preparada para añadir su funcionalidad sin afectar la gestión de usuarios.</p></div>
          )}
        </section>
      </main>
    </div>
  )
}
