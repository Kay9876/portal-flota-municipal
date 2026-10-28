// Dashboard principal. La autorización real de cada operación se aplica también en Supabase.
import { useEffect, useState } from 'react'
import {
  CarFront, Car, TriangleAlert, Wrench, ClipboardList, Fuel, FileText, House,
  Building2, CalendarDays, KeyRound, ChartNoAxesCombined, Users, Settings, LogOut,
} from 'lucide-react'
import { supabase } from '../supabaseClient'
import escudoVA from '../assets/escudoVA.png'
import AddVehicle from './addVehicle'
import AdminUsers from './adminIT/AdminUsers'
import AddFuel from './addFuel'
import ViewVehicles from './viewVehicles'


const vehicleStats = [
  { label: 'Total de vehículos', value: '—', Icon: CarFront, color: 'navy' },
  { label: 'En uso', value: '—', Icon: Car, color: 'green' },
  { label: 'Fuera de servicio', value: '—', Icon: TriangleAlert, color: 'red' },
  { label: 'En mantenimiento', value: '—', Icon: Wrench, color: 'navy' },
]
const quickActions = [
  { label: 'Registrar uso diario', Icon: ClipboardList },
  { label: 'Registrar combustible', Icon: Fuel, page: 'addFuel' },
  { label: 'Registrar mantenimiento', Icon: Wrench },
  { label: 'Ver reportes', Icon: FileText },
]
const baseSidebarItems = [
  { label: 'Inicio', Icon: House, page: 'home' },
  { label: 'Vehículos', Icon: CarFront, page: 'vehicles' },
  { label: 'Departamentos', Icon: Building2, page: 'departments' },
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

  useEffect(() => {
    let alive = true
    async function loadProfile() {
      setProfileLoading(true)
      const { data, error } = await supabase.from('profiles')
        .select('id,first_name,last_name,second_last_name,department_id,is_admin,is_global_viewer,is_active')
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
  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || user?.email || 'Usuario'
  const roleLabel = isAdmin ? 'Administrador' : profile?.is_global_viewer ? 'Visor global' : 'Usuario'
  const sidebarItems = isAdmin ? [...baseSidebarItems, { label: 'Usuarios', Icon: Users, page: 'users' }, { label: 'Configuración', Icon: Settings, page: 'settings' }] : baseSidebarItems

  function navigate(page) {
    setActivePage(page)
    setShowAddVehicle(false)
    setProfileError('')
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
        <div className="sidebar-footer"><span className="sidebar-footer-dot" /> Portal de Flota Municipal</div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div className="search-wrap"><input type="search" placeholder="Buscar..." aria-label="Buscar" onChange={() => {}} /></div>
          <div className="user-profile">
            <span className="avatar">{displayName.slice(0, 2).toUpperCase()}</span>
            <div><strong>{displayName}</strong><p>{profileLoading ? 'Cargando perfil…' : roleLabel}</p></div>
            <button className="btn-ghost" type="button" onClick={onSignOut}><LogOut size={16} /> Salir</button>
          </div>
        </header>

        <section className="page-content">
          {profileError && <div className="admin-alert error">No se pudo cargar tu perfil: {profileError}</div>}
          {!profileLoading && !profile && <div className="admin-alert error">No se encontró un perfil para esta cuenta. Contacta al administrador del sistema.</div>}
          {activePage === 'users' && isAdmin ? (
            <AdminUsers onBack={() => navigate('home')} />
          ) : showAddVehicle ? (
            <AddVehicle onDone={() => setShowAddVehicle(false)} />
          ) : activePage === 'home' ? (
            <>
              <div className="section-heading"><div><h1>Resumen de la Flota</h1><p className="admin-subtitle">Bienvenido/a, {displayName}</p></div><span>{new Date().toLocaleDateString('es-PR', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
              <div className="stats">{vehicleStats.map(({ label, value, Icon, color }) => <article className={`stat ${color}`} key={label}><span className="stat-icon"><Icon size={28} strokeWidth={2} /></span><div><p className="label">{label}</p><p className="value">{value}</p></div></article>)}</div>
              <div className="overview-grid"><article className="card"><h2>Vehículos por departamento</h2><p>El desglose aparecerá cuando se conecte el resumen de datos de la flota.</p></article><article className="card"><h2>Gastos mensuales</h2><p>El resumen de gastos aparecerá cuando se conecten los registros de combustible y mantenimiento.</p></article></div>
              <h2 className="actions-heading">Accesos rápidos</h2>
              <div className="actions-grid">{quickActions.map(({ label, Icon,page }) => <button className="action-card" key={label} type="button" onClick={() => page ? navigate(page):setProfileError(`La sección “${label}” aún no está implementada.`)}><span className="action-icon"><Icon size={26} strokeWidth={2} /></span>{label}</button>)}</div>
              <button type="button" className="btn-primary" onClick={() => setShowAddVehicle(true)}>Agregar vehículo</button>
              {isAdmin && <div className="admin-shortcut"><div><strong>Administración del sistema</strong><p>Gestiona cuentas y permisos de acceso.</p></div><button className="admin-button primary" type="button" onClick={() => navigate('users')}><Users size={17} /> Gestionar usuarios</button></div>}
            </>
          ) : activePage === 'addFuel' ? (
            <AddFuel onDone={()=>navigate('home')}/>
          ): activePage==='vehicles'?(
            <ViewVehicles />
          ) : activePage === 'departments' && isAdmin ? (
            <div className="admin-panel"><h1>Departamentos</h1><p>La administración de usuarios permite asignar un departamento. Para crear, editar o eliminar departamentos se debe implementar una pantalla específica y sus políticas RLS.</p></div>
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
