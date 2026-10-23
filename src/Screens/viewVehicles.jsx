import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CarFront, Loader2, Search } from 'lucide-react'
import { supabase } from '../supabaseClient'
import './viewVehicles.css'
import carPlaceholder from 'url:../assets/carplaceholder.png'

const PHOTO_BUCKET = 'vehicle-photos'

export default function ViewVehicles() {
  const [vehicles, setVehicles] = useState([])
  const [photoUrls, setPhotoUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [departmentId, setDepartmentId] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, department_id, manufacturer, model, year, license_plate, is_active, image_path, departments(name)')
        .order('license_plate')
      if (cancelled) return
      if (error) setError('No se pudieron cargar los vehículos: ' + error.message)
      const rows = data || []
      setVehicles(rows)
      setLoading(false)

      // Las fotos están en un bucket privado: se piden direcciones temporales (1 hora).
      const paths = rows.map((v) => v.image_path).filter(Boolean)
      if (paths.length > 0) {
        const { data: signed } = await supabase.storage
          .from(PHOTO_BUCKET)
          .createSignedUrls(paths, 3600)
        if (cancelled) return
        const urls = {}
        ;(signed || []).forEach((s) => { if (s.signedUrl) urls[s.path] = s.signedUrl })
        setPhotoUrls(urls)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const deptName = (v) => v.departments?.name ?? `Departamento ${v.department_id}`

  const departmentOptions = useMemo(() => {
    const seen = new Map()
    vehicles.forEach((v) => {
      if (!seen.has(v.department_id)) seen.set(v.department_id, deptName(v))
    })
    return [...seen].sort((a, b) => a[1].localeCompare(b[1], 'es'))
  }, [vehicles])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return vehicles.filter((v) => {
      if (departmentId && String(v.department_id) !== departmentId) return false
      if (!q) return true
      return [v.license_plate, v.manufacturer, v.model, v.year, deptName(v)]
        .some((x) => String(x ?? '').toLowerCase().includes(q))
    })
  }, [vehicles, search, departmentId])

  return (
    <div className="vv">
      <div className="vv-heading">
        <div>
          <h1>Vehículos</h1>
          <p>Flota municipal registrada en el sistema.</p>
        </div>
        <span className="vv-count" aria-live="polite">
          {loading ? 'Cargando…' : `${visible.length} de ${vehicles.length} vehículos`}
        </span>
      </div>

      <section className="vv-card">
        <div className="vv-toolbar">
          <div className="vv-field">
            <label htmlFor="vehicle-search">Buscar</label>
            <div className="vv-search-wrap">
              <Search size={18} aria-hidden="true" />
              <input
                id="vehicle-search"
                type="search"
                placeholder="Matrícula, marca, modelo…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="vv-field">
            <label htmlFor="vehicle-department">Departamento</label>
            <select
              id="vehicle-department"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">Todos</option>
              {departmentOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="vv-alert" role="alert">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {loading && (
          <div className="vv-state">
            <Loader2 size={24} className="vv-spin" />
            <span>Cargando vehículos…</span>
          </div>
        )}

        {!loading && !error && vehicles.length === 0 && (
          <div className="vv-state">
            <CarFront size={28} />
            <span>No hay vehículos para mostrar.</span>
          </div>
        )}

        {!loading && vehicles.length > 0 && visible.length === 0 && (
          <div className="vv-state">
            <Search size={28} />
            <span>Ningún vehículo coincide con la búsqueda.</span>
          </div>
        )}

        {visible.length > 0 && (
          <div className="vv-table-wrap">
            <table className="vv-table" aria-label="Lista de vehículos">
              <thead>
                <tr>
                  <th>Vehículo</th>
                  <th>Año</th>
                  <th>Matrícula</th>
                  <th>Departamento</th>
                  <th>Estado</th>
                  <th>Imagen</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((v) => (
                  <tr key={v.id}>
                   <td data-label="Vehículo">{v.manufacturer} {v.model}</td>
                    <td data-label="Año">{v.year ?? '—'}</td>
                    <td data-label="Matrícula"><span className="vv-plate">{v.license_plate}</span></td>
                    <td data-label="Departamento">{deptName(v)}</td>
                    <td data-label="Estado">
                      <span className={'vv-pill ' + (v.is_active !== false ? 'vv-pill-on' : 'vv-pill-off')}>
                        {v.is_active !== false ? 'Activo' : 'Fuera de servicio'}
                      </span>
                    </td>
                    <td data-label="Imagen">
                      {photoUrls[v.image_path] ? (
                        <img
                          className="vv-thumb"
                          src={photoUrls[v.image_path]}
                          alt={`Foto de ${v.manufacturer} ${v.model}`}
                          loading="lazy"
                        />
                      ) : (
                        <img
                          className="vv-thumb vv-thumb-placeholder"
                          src={carPlaceholder}
                          alt="Sin foto"
                          loading="lazy"
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}