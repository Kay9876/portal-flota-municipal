
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Building2, Plus, RefreshCw } from 'lucide-react'

export default function Departments() {
  const [departments, setDepartments] = useState([])
  const [departmentName, setDepartmentName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  async function loadDepartments() {
    setLoading(true)
    setMessage(null)

    const { data, error } = await supabase
      .from('departments')
      .select('id, name, created_at')
      .order('name', { ascending: true })

    if (error) {
      setMessage({
        type: 'error',
        text: 'Error cargando departamentos: ' + error.message,
      })
    } else {
      setDepartments(data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadDepartments()
  }, [])

  async function createDepartment(e) {
    e.preventDefault()

    const name = departmentName.trim()

    if (!name) {
      setMessage({
        type: 'error',
        text: 'Escribe el nombre del departamento.',
      })
      return
    }

    const alreadyExists = departments.some(
      department => department.name?.trim().toLowerCase() === name.toLowerCase()
    )

    if (alreadyExists) {
      setMessage({
        type: 'error',
        text: 'Ese departamento ya existe.',
      })
      return
    }

    setSaving(true)
    setMessage(null)

    const { error } = await supabase
      .from('departments')
      .insert({ name })
    
    if (error) {
      setMessage({
        type: 'error',
        text: 'No se pudo crear el departamento: ' + error.message,
      })
    } else {
      setDepartmentName('')
      setMessage({
        type: 'success',
        text: 'Departamento creado correctamente.',
      })
      await loadDepartments()
    }

    setSaving(false)
  }

  return (
    <div>
      <div className="section-heading">
        <div>
          <h1>Departamentos</h1>
          <p>Administra los departamentos del Municipio de Vega Alta.</p>
        </div>

        <button
          type="button"
          className="admin-button"
          onClick={loadDepartments}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      <div className="admin-panel">
        <h2>
          <Building2 size={20} />
          Crear departamento
        </h2>

        <form onSubmit={createDepartment}>
          <div className="admin-field">
            <label htmlFor="department-name">
              Nombre del departamento
            </label>

            <input
              id="department-name"
              type="text"
              placeholder="Ej. Obras Públicas"
              value={departmentName}
              onChange={e => setDepartmentName(e.target.value)}
              maxLength={100}
              required
            />
          </div>

          <button
            className="admin-button primary"
            type="submit"
            disabled={saving}
          >
            <Plus size={17} />
            {saving ? 'Guardando...' : 'Crear departamento'}
          </button>
        </form>

        {message && (
          <div className={`admin-alert ${message.type === 'error' ? 'error' : 'success'}`}>
            {message.text}
          </div>
        )}
      </div>

      <div className="admin-panel">
        <div className="section-heading">
          <h2>Departamentos registrados</h2>
          <span>{departments.length} departamentos</span>
        </div>

        {loading ? (
          <p>Cargando departamentos...</p>
        ) : departments.length === 0 ? (
          <p>No hay departamentos registrados todavía.</p>
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Fecha de creación</th>
                </tr>
              </thead>

              <tbody>
                {departments.map(department => (
                  <tr key={department.id}>
                    <td>{department.id}</td>
                    <td>{department.name}</td>
                    <td>
                      {department.created_at
                        ? new Date(department.created_at).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
