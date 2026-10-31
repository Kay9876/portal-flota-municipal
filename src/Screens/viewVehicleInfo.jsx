
 // Aqui se exhibe la información de un vehiculo específico seleccionado en la
 // página de viewVehicles

import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import './viewVehicleInfo.css'

const PHOTO_BUCKET = 'vehicle-photos'

export default function ViewVehicleInfo({ vehicleId, onBack }) {
  const [vehicle, setVehicle] = useState(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('General')

  const [dailyRecords, setDailyRecords] = useState([])
  const [dailyLoading, setDailyLoading] = useState(false)
  const [dailyError, setDailyError] = useState('')

  const [fuelRecords, setFuelRecords] = useState([])
  const [fuelLoading, setFuelLoading] = useState(false)
  const [fuelError, setFuelError] = useState('')

  const [maintenanceRecords, setMaintenanceRecords] = useState([])
  const [maintenanceLoading, setMaintenanceLoading] = useState(false)
  const [maintenanceError, setMaintenanceError] = useState('')

  const [keyRecords, setKeyRecords] = useState([])
  const [keyLoading, setKeyLoading] = useState(false)
  const [keyError, setKeyError] = useState('')

  const [documents, setDocuments] = useState([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [documentsError, setDocumentsError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadVehicle() {
      setLoading(true)
      setError('')
      setVehicle(null)
      setPhotoUrl('')

      const { data, error } = await supabase
        .from('vehicles')
        .select(`
          id,
          manufacturer,
          model,
          year,
          license_plate,
          is_active,
          image_path,
          department_id,
          vin,
          total_mileage,
          departments(name)
        `)
        .eq('id', vehicleId)
        .single()

      if (cancelled) return

      if (error) {
        setError('No se pudo cargar la información del vehículo.')
        setLoading(false)
        return
      }

      setVehicle(data)

      if (data.image_path) {
        const { data: photo, error: photoError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .createSignedUrl(data.image_path, 3600)

        if (!cancelled && !photoError) {
          setPhotoUrl(photo.signedUrl)
        }
      }

      if (!cancelled) setLoading(false)
    }

    loadVehicle()

    return () => {
      cancelled = true
    }
  }, [vehicleId])


useEffect(() => {
  if (activeTab !== 'Registros Diarios') return

  let cancelled = false

  async function loadDailyRecords() {
    setDailyLoading(true)
    setDailyError('')

    const { data, error } = await supabase
      .from('daily_register')
      .select(`
        id,
        departure_date,
        driver_name,
        user_department,
        destination,
        departure_time,
        departure_mileage,
        arrival_time,
        arrival_mileage,
        has_signature
      `)
      .eq('vehicle_id', vehicleId)
      .order('departure_date', { ascending: false })

    if (cancelled) return

    if (error) {
      setDailyError('No se pudieron cargar los registros diarios.')
    } else {
      setDailyRecords(data || [])
    }

    setDailyLoading(false)
  }

  loadDailyRecords()

  return () => {
    cancelled = true
  }
}, [activeTab, vehicleId])


useEffect(() => {
  if (activeTab !== 'Combustible') return

  let cancelled = false

  async function loadFuelRecords() {
    setFuelLoading(true)
    setFuelError('')

    const { data, error } = await supabase
      .from('fuel_register')
      .select(`
        id,
        control_number,
        dispatch_date,
        liters,
        amount_dispatched,
        fuel_type,
        supplier_name,
        requester_name,
        mileage
      `)
      .eq('vehicle_id', vehicleId)
      .order('dispatch_date', { ascending: false })

        console.log('Vehicle ID:', vehicleId)
        console.log('Fuel data:', data)
        console.log('Fuel error:', error)

    if (cancelled) return

    if (error) {
      setFuelError('No se pudieron cargar los registros de combustible.')
    } else {
      setFuelRecords(data || [])
    }

    setFuelLoading(false)
  }

  loadFuelRecords()

  return () => {
    cancelled = true
  }
}, [activeTab, vehicleId])

useEffect(() => {
  if (activeTab !== 'Mantenimiento') return

  let cancelled = false

  async function loadMaintenanceRecords() {
    setMaintenanceLoading(true)
    setMaintenanceError('')

    const { data, error } = await supabase
      .from('maintenance')
      .select(`
        id,
        start_date,
        end_date,
        location,
        description,
        cost
      `)
      .eq('vehicle_id', vehicleId)
      .order('start_date', { ascending: false })

        console.log('Vehicle ID:', vehicleId)
        console.log('Maintenance data:', data)
        console.log('Maintenance error:', error)

    if (cancelled) return

    if (error) {
      setMaintenanceError('No se pudieron cargar los registros de mantenimiento.')
    } else {
      setMaintenanceRecords(data || [])
    }

    setMaintenanceLoading(false)
  }

  loadMaintenanceRecords()

  return () => {
    cancelled = true
  }
}, [activeTab, vehicleId])


useEffect(() => {
  if (activeTab !== 'Llaves') return

  let cancelled = false

  async function loadKeyRecords() {
    setKeyLoading(true)
    setKeyError('')

    const { data, error } = await supabase
      .from('key_register')
      .select(`
        id,
        kr_date,
        departure_time,
        arrival_time,
        driver_name,
        driver_license_num,
        destination,
        passenger_name,
        user_department,
        key_pickup,
        key_handover
      `)
      .eq('vehicle_id', vehicleId)
      .order('kr_date', { ascending: false })

    if (cancelled) return

    // if (error) {
    //   console.error('Key register error:', error)
    //   setKeyError('No se pudieron cargar los registros de llaves.')
    // } 
    // else {
    //   setKeyRecords(data || [])
    // }

    if (error) {
    console.error('Key register error:', error.message, error.details, error.hint)
    setKeyError(error.message)
    } else {
    setKeyRecords(data || [])
    }

    setKeyLoading(false)
  }

  loadKeyRecords()

  return () => {
    cancelled = true
  }
}, [activeTab, vehicleId])


useEffect(() => {
  if (activeTab !== 'Documentos') return

  let cancelled = false

  async function loadDocuments() {
    setDocumentsLoading(true)
    setDocumentsError('')

    const { data, error } = await supabase
      .from('document_scans')
      .select(`
        id,
        template_id,
        vehicle_id,
        file_path,
        uploaded_by,
        created_at,
        document_templates(name, description)
      `)
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false })

    if (cancelled) return

    if (error) {
      console.error('Document scans error:', error.message, error.details)
      setDocumentsError('No se pudieron cargar los documentos escaneados.')
    } else {
      setDocuments(data || [])
    }

    setDocumentsLoading(false)
  }

  loadDocuments()

  return () => {
    cancelled = true
  }
}, [activeTab, vehicleId])



  const departmentName =
    vehicle?.departments?.name ??
    (vehicle ? `Departamento ${vehicle.department_id}` : '')

  const isActive = vehicle?.is_active === true
  const statusLabel =
    vehicle?.is_active == null
      ? 'Estado no registrado'
      : isActive
        ? 'Activo'
        : 'Fuera de servicio'

  return (
    <div className="vdi">
      <button
        type="button"
        className="vdi-back-button"
        onClick={onBack}
      >
        ← Volver a vehículos
      </button>

      <div className="section-heading vdi-heading">
        <h1>Información del vehículo</h1>
      </div>

      {loading && (
        <p className="empty">Cargando información del vehículo...</p>
      )}

      {error && (
        <p className="msg error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && vehicle && (
        <>
          <section className="card vdi-vehicle-header">
            {photoUrl ? (
              <img
                className="vdi-photo"
                src={photoUrl}
                alt={`${vehicle.manufacturer || ''} ${vehicle.model || ''}`.trim()}
              />
            ) : (
              <div className="vdi-photo-placeholder">
                Foto no disponible
              </div>
            )}

            <div className="vdi-summary">
              <div className="vdi-title-row">
                <h2>
                  {vehicle.license_plate || `Vehículo ${vehicle.id}`}
                </h2>

                <span
                  className={`pill ${
                    vehicle.is_active === true
                      ? 'on'
                      : vehicle.is_active === false
                        ? 'off'
                        : 'unknown'
                  }`}
                >
                  {statusLabel}
                </span>
              </div>

              <p className="vdi-model">
                {[vehicle.manufacturer, vehicle.model]
                  .filter(Boolean)
                  .join(' ') || 'Marca y modelo no registrados'}
                {vehicle.year != null ? ` (${vehicle.year})` : ''}
              </p>

              <p className="vdi-department">
                Departamento: {departmentName}
              </p>
            </div>
          </section>

          <nav className="vdi-tabs" aria-label="Secciones del vehículo">
            {[
              'General',
              'Registros Diarios',
              'Combustible',
              'Mantenimiento',
              'Llaves',
              'Documentos',
            ].map((tab) => (
              <button
                key={tab}
                type="button"
                className={`vdi-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
                aria-pressed={activeTab === tab}
              >
                {tab}
              </button>
            ))}
          </nav>

          {activeTab === 'General' && (
            <section className="card vdi-information">
              <h2>Datos del vehículo</h2>

              <div className="vdi-details-grid">
                <div className="vdi-detail">
                  <span className="vdi-label">Tablilla</span>
                  <strong>{vehicle.license_plate || '—'}</strong>
                </div>

                <div className="vdi-detail">
                  <span className="vdi-label">Marca</span>
                  <strong>{vehicle.manufacturer || '—'}</strong>
                </div>

                <div className="vdi-detail">
                  <span className="vdi-label">Modelo</span>
                  <strong>{vehicle.model || '—'}</strong>
                </div>

                <div className="vdi-detail">
                  <span className="vdi-label">Año</span>
                  <strong>{vehicle.year ?? '—'}</strong>
                </div>

                <div className="vdi-detail">
                  <span className="vdi-label">Departamento</span>
                  <strong>{departmentName}</strong>
                </div>

                <div className="vdi-detail">
                  <span className="vdi-label">Estado</span>
                  <strong>{statusLabel}</strong>
                </div>

                <div className="vdi-detail">
                  <span className="vdi-label">VIN</span>
                  <strong className="vdi-long-value">
                    {vehicle.vin || 'No registrado'}
                  </strong>
                </div>

                <div className="vdi-detail">
                  <span className="vdi-label">Millaje total</span>
                  <strong>
                    {vehicle.total_mileage != null
                      ? `${Number(vehicle.total_mileage).toLocaleString('en-US')} millas`
                      : 'No registrado'}
                  </strong>
                </div>

                <div className="vdi-detail">
                  <span className="vdi-label">ID</span>
                  <strong>{vehicle.id}</strong>
                </div>
              </div>
            </section>
          )}


        {activeTab === 'Registros Diarios' && (
        <section className="card">
            <h2>Registros diarios</h2>

            {dailyLoading && (
            <p className="empty">Cargando registros diarios...</p>
            )}

            {dailyError && (
            <p className="msg error" role="alert">{dailyError}</p>
            )}

            {!dailyLoading && !dailyError && dailyRecords.length === 0 && (
            <p className="empty">
                No hay registros diarios para este vehículo.
            </p>
            )}

            {!dailyLoading && !dailyError && dailyRecords.length > 0 && (
            <div className="table-wrap">
                <table>
                <thead>
                    <tr>
                    <th>Fecha</th>
                    <th>Conductor</th>
                    <th>Departamento</th>
                    <th>Destino</th>
                    <th>Salida</th>
                    <th>Millaje de salida</th>
                    <th>Llegada</th>
                    <th>Millaje de llegada</th>
                    <th>Firma</th>
                    </tr>
                </thead>
                <tbody>
                    {dailyRecords.map((record) => (
                    <tr key={record.id}>
                        <td>{record.departure_date || '—'}</td>
                        <td>{record.driver_name || '—'}</td>
                        <td>{record.user_department || '—'}</td>
                        <td>{record.destination || '—'}</td>
                        <td>{record.departure_time || '—'}</td>
                        <td>{record.departure_mileage ?? '—'}</td>
                        <td>{record.arrival_time || '—'}</td>
                        <td>{record.arrival_mileage ?? '—'}</td>
                        <td>
                        {record.has_signature == null
                            ? 'No registrado'
                            : record.has_signature
                            ? 'Sí'
                            : 'No'}
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
            )}
        </section>
        )}


    {activeTab === 'Combustible' && (
    <section className="card">
        <h2>Historial de combustible</h2>

        {fuelLoading && (
        <p className="empty">Cargando registros de combustible...</p>
        )}

        {fuelError && (
        <p className="msg error" role="alert">{fuelError}</p>
        )}

        {!fuelLoading && !fuelError && fuelRecords.length === 0 && (
        <p className="empty">
            No hay registros de combustible para este vehículo.
        </p>
        )}

        {!fuelLoading && !fuelError && fuelRecords.length > 0 && (
        <div className="table-wrap">
            <table>
            <thead>
                <tr>
                  <th>Control #</th>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Costo</th>
                <th>Proveedor</th>
                <th>Conductor</th>
                <th>Millaje</th>
                </tr>
            </thead>
            <tbody>
                {fuelRecords.map((record) => (
                <tr key={record.id}>
                    <td>{record.control_number || '-'} </td>
                    <td>{record.dispatch_date || '—'}</td>
                    <td>{record.fuel_type || '—'}</td>
                    <td>
                    {record.amount_dispatched != null
                        ? `$${Number(record.amount_dispatched).toFixed(2)}`
                        : '—'}
                    </td>
                    <td>{record.supplier_name || '—'}</td>
                    <td>{record.requester_name || '—'}</td>
                    <td>
                    {record.mileage != null
                        ? Number(record.mileage).toLocaleString('en-US')
                        : '—'}
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
        )}
    </section>
    )}

    {activeTab === 'Mantenimiento' && (
        <section className="card">
            <h2>Historial de mantenimiento</h2>

            {maintenanceLoading && (
            <p className="empty">Cargando registros de mantenimiento...</p>
            )}

            {maintenanceError && (
            <p className="msg error" role="alert">
                {maintenanceError}
            </p>
            )}

            {!maintenanceLoading &&
            !maintenanceError &&
            maintenanceRecords.length === 0 && (
                <p className="empty">
                No hay registros de mantenimiento para este vehículo.
                </p>
            )}

            {!maintenanceLoading &&
            !maintenanceError &&
            maintenanceRecords.length > 0 && (
                <div className="table-wrap">
                <table>
                    <thead>
                    <tr>
                        <th>Fecha de inicio</th>
                        <th>Fecha de finalización</th>
                        <th>Ubicación</th>
                        <th>Descripción</th>
                        <th>Costo</th>
                    </tr>
                    </thead>

                    <tbody>
                    {maintenanceRecords.map((record) => (
                        <tr key={record.id}>
                        <td>{record.start_date || '—'}</td>
                        <td>{record.end_date || '—'}</td>
                        <td>{record.location || '—'}</td>
                        <td>{record.description || '—'}</td>
                        <td>
                            {record.cost != null
                            ? `$${Number(record.cost).toFixed(2)}`
                            : '—'}
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
            )}
        </section>
        )}

        {activeTab === 'Llaves' && (
          <section className="card">
            <h2>Registro de llaves</h2>

            {keyLoading && (
              <p className="empty">Cargando registros de llaves...</p>
            )}

            {keyError && (
              <p className="msg error" role="alert">{keyError}</p>
            )}

            {!keyLoading && !keyError && keyRecords.length === 0 && (
              <p className="empty">
                No hay registros de llaves para este vehículo.
              </p>
            )}

            {!keyLoading && !keyError && keyRecords.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Conductor</th>
                      <th>Licencia</th>
                      <th>Departamento</th>
                      <th>Destino</th>
                      <th>Pasajero</th>
                      <th>Salida</th>
                      <th>Llegada</th>
                      <th>Entrega de llave</th>
                      <th>Devolución de llave</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keyRecords.map((record) => (
                      <tr key={record.id}>
                        <td>{record.kr_date || '—'}</td>
                        <td>{record.driver_name || '—'}</td>
                        <td>{record.driver_license_num || '—'}</td>
                        <td>{record.user_department || '—'}</td>
                        <td>{record.destination || '—'}</td>
                        <td>{record.passenger_name || '—'}</td>
                        <td>{record.departure_time || '—'}</td>
                        <td>{record.arrival_time || '—'}</td>
                        <td>{record.key_pickup_time || '—'}</td>
                        <td>{record.key_handover_time || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}


        {activeTab === 'Documentos' && (
          <section className="card">
            <h2>Documentos escaneados</h2>

            {documentsLoading && (
              <p className="empty">Cargando documentos...</p>
            )}

            {documentsError && (
              <p className="msg error" role="alert">
                {documentsError}
              </p>
            )}

            {!documentsLoading &&
              !documentsError &&
              documents.length === 0 && (
                <p className="empty">
                  No hay documentos escaneados asociados a este vehículo.
                </p>
              )}

            {!documentsLoading &&
              !documentsError &&
              documents.length > 0 && (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Documento</th>
                        <th>Descripción</th>
                        <th>Fecha de carga</th>
                        <th>Archivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((document) => (
                        <tr key={document.id}>
                          <td>
                            {document.document_templates?.name || 'Documento escaneado'}
                          </td>
                          <td>
                            {document.document_templates?.description || '—'}
                          </td>
                          <td>
                            {document.created_at
                              ? new Date(document.created_at).toLocaleDateString('es-PR')
                              : '—'}
                          </td>
                          <td>
                                {document.file_path ? (
                                    <button
                                    type="button"
                                    onClick={async () => {
                                        const { data, error } = await supabase.storage
                                        .from('scans')
                                        .createSignedUrl(document.file_path, 60)

                                        if (error) {
                                        console.error('Could not open document:', error)
                                        alert('No se pudo abrir el documento.')
                                        return
                                        }

                                        window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
                                    }}
                                    >
                                    Abrir documento
                                    </button>
                                ) : (
                                    'Archivo no disponible'
                                )}
                            </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </section>
        )}
        </>
      )}
    </div>
  )
}
