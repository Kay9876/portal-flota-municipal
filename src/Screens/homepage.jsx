// En esta pagina todos tendrán acceso al dashboard e información general
// accesible para todos, pero tendrán información distinta expuesta dependiente
// de los permisos que tenga el usuario
import {useState} from 'react'
import {
  CarFront,
  Car,
  TriangleAlert,
  Wrench,
  ClipboardList,
  Fuel,
  FileText,
  House,
  Building2,
  CalendarDays,
  KeyRound,
  ChartNoAxesCombined,
  Users,
  Settings,
  Bell,
} from 'lucide-react'

import escudoLogo from '../assets/escudoVA.png'
import AddVehicle from './addVehicle'
import ViewVehicles from './viewVehicles'
import ViewVehicleInfo from './viewVehicleInfo'
const vehicleStats = [
  { label: 'Total de vehículos', value: '# would be in these sections', Icon: CarFront, color: 'navy' },
  { label: 'En uso', value: '-', Icon: Car, color: 'green' },
  { label: 'Fuera de servicio', value: '-', Icon: TriangleAlert, color: 'red' },
  { label: 'En mantenimiento', value: '-', Icon: Wrench, color: 'navy' },
]

const quickActions = [
  { label: 'Registrar uso diario', Icon: ClipboardList },
  { label: 'Registrar combustible', Icon: Fuel },
  { label: 'Registrar mantenimiento', Icon: Wrench },
  { label: 'Ver reportes', Icon: FileText },
]

const sidebarItems = [
  { label: 'Inicio', Icon: House },
  { label: 'Vehículos', Icon: CarFront },
  { label: 'Departamentos', Icon: Building2 },
  { label: 'Registros diarios', Icon: CalendarDays },
  { label: 'Recibos de combustible', Icon: Fuel },
  { label: 'Mantenimiento', Icon: Wrench },
  { label: 'Llaves', Icon: KeyRound },
  { label: 'Reportes', Icon: ChartNoAxesCombined },
  { label: 'Usuarios', Icon: Users },
  { label: 'Configuración', Icon: Settings },
]

export default function Homepage({ user, onSignOut }) {
  const firstName = user?.user_metadata?.first_name || user?.email || 'Usuario'
  const roleLabel = user?.user_metadata?.is_admin ? 'Administrador' : 'Usuario'
  const [showAddVehicle, setShowAddVehicle] = useState(false)
  const [showVehicles, setShowVehicles] = useState(false)
  const [selectedVehicleId, setSelectedVehicleId] = useState(null)
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="sidebar-brand">
            <div className="logo-box">
              <img
                src={escudoLogo}
                alt="Escudo del Municipio de Vega Alta"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
                      <rect width="100" height="100" rx="12" fill="#dfeaf5"/>
                      <rect x="20" y="18" width="60" height="60" rx="8" fill="#0d3d5d"/>
                      <text x="50" y="58" font-size="34" font-family="Arial, sans-serif" text-anchor="middle" fill="white">?</text>
                    </svg>
                  `)
                }}
              />
            </div>
            <div>
              <h2>Municipio de Vega Alta</h2>
              <p>Gestión de Flota Municipal</p>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Navegación principal">
          {sidebarItems.map(({ label, Icon }) => {
            const isActive =
              (label === 'Inicio' && !showVehicles && !showAddVehicle && selectedVehicleId === null) ||
              (label === 'Vehículos' && (showVehicles || showAddVehicle || selectedVehicleId !== null))
            return (
              <a
                href="#"
                key={label}
                className={isActive ? 'active' : ''}
                onClick={(e) => {
                  e.preventDefault()
                    if (label === 'Inicio') { setShowVehicles(false); setShowAddVehicle(false); setSelectedVehicleId(null) }
                    if (label === 'Vehículos') { setShowVehicles(true); setShowAddVehicle(false); setSelectedVehicleId(null) }
                }}
              >
                <span className="nav-icon"><Icon size={28} strokeWidth={2} /></span>
                <span>{label}</span>
              </a>
            )
          })}
        </nav>

      </aside>

      <main className="main-content">
        <header className="page-header">
          <div className="search-wrap">
            <input
              type="search"
              placeholder="Buscar..."
              aria-label="Buscar"
            />
          </div>
          <div className="user-profile">
            <span aria-label="Notificaciones">♧</span>
            <span className="avatar">{firstName.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{firstName}</strong>
              <p>{roleLabel}</p>
            </div>
            <button className="btn-ghost" type="button" onClick={onSignOut}>Salir</button>
          </div>
        </header>

        <section className="page-content">
          {selectedVehicleId !== null ? (
            <ViewVehicleInfo
              vehicleId={selectedVehicleId}
              onBack={() => setSelectedVehicleId(null)}
            />
          ) : showVehicles ? (
            <ViewVehicles
              pressViewVehicle={(id) => setSelectedVehicleId(id)}
            />
          ) : showAddVehicle ? (
            <AddVehicle onDone={() => setShowAddVehicle(false)} />
          ) : (
            <>
        <div className="section-heading">
            <h1>Resumen de la Flota</h1>
            <span>Fecha would be here</span>
          </div>

          <div className="stats">
            {vehicleStats.map((stat) => (
              <article className={`stat ${stat.color}`} key={stat.label}>
                <span className="stat-icon">
                  <stat.Icon size={30} strokeWidth={2} />
                </span>
                <div>
                  <p className="label">{stat.label}</p>
                  <p className="value">{stat.value}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="overview-grid">
            <article className="card">
              <h2>Vehículos por departamento</h2>
              <p>El desglose por departamento aparecerá aquí.</p>
            </article>

            <article className="card">
              <h2>Gastos mensuales</h2>
              <p>El resumen de gastos aparecerá aquí.</p>
            </article>
          </div>

          <h2 className="actions-heading">Accesos rápidos</h2>

          <div className="actions-grid">
            {quickActions.map(({ label, Icon }) => (
              <button className="action-card" key={label} type="button">
                <span className="action-icon">
                  <Icon size={28} strokeWidth={2} />
                </span>
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowAddVehicle(true)}
          >
            Agregar Vehículo
          </button>
          </>
          )}
        </section>
      </main>
    </div>
  )
}


