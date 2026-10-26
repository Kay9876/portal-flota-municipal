import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, UserPlus, Pencil, ArrowLeft, RefreshCw, ShieldCheck, Users as UsersIcon } from 'lucide-react'
import { supabase } from '../../supabaseClient'

const blankForm = {
  first_name: '', last_name: '', second_last_name: '', email: '', password: '',
  department_id: '', is_admin: false, is_global_viewer: false, is_active: true,
  can_view_vehicle: false, can_create_vehicle: false, can_update_vehicle: false,
}

function errorText(error) {
  const message = error?.message || 'Ocurrió un error inesperado.'
  if (/permission denied|row-level security|not allowed|unauthorized|forbidden/i.test(message)) {
    return 'Acceso denegado por los permisos de Supabase. Verifica las políticas RLS y las funciones administrativas.'
  }
  return message
}

async function invokeAdminFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) throw new Error(error.message || `No se pudo ejecutar ${name}.`)
  if (data?.error) throw new Error(data.error)
  return data
}

export default function AdminUsers({ onBack }) {
  const [page, setPage] = useState('list')
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const userData = await invokeAdminFunction('admin-list-users', {})
      setUsers(userData.users || [])
      setDepartments(userData.departments || [])
    } catch (error) {
      setMessage({ type: 'error', text: errorText(error) })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const departmentName = useMemo(() => Object.fromEntries(departments.map(d => [String(d.id), d.name])), [departments])
  const filteredUsers = useMemo(() => users.filter(user => {
    const fullName = `${user.first_name || ''} ${user.last_name || ''} ${user.second_last_name || ''} ${user.email || ''}`.toLowerCase()
    const matchesSearch = fullName.includes(search.trim().toLowerCase())
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? user.is_active !== false : user.is_active === false)
    return matchesSearch && matchesStatus
  }), [users, search, statusFilter])

  function startCreate() {
    setEditing(null)
    setForm(blankForm)
    setMessage(null)
    setPage('form')
  }

  function startEdit(user) {
    setEditing(user)
    setForm({
      ...blankForm,
      first_name: user.first_name || '', last_name: user.last_name || '',
      second_last_name: user.second_last_name || '', email: user.email || '',
      department_id: user.department_id == null ? '' : String(user.department_id),
      is_admin: user.is_admin === true, is_global_viewer: user.is_global_viewer === true,
      is_active: user.is_active !== false,
      can_view_vehicle: user.permission?.can_view_vehicle === true,
      can_create_vehicle: user.permission?.can_create_vehicle === true,
      can_update_vehicle: user.permission?.can_update_vehicle === true,
    })
    setMessage(null)
    setPage('form')
  }

  function updateField(event) {
    const { name, value, type, checked } = event.target
    setForm(current => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      if (!form.first_name.trim()) throw new Error('El nombre es obligatorio.')
      if (!form.email.trim() || !/^\S+@\S+\.\S+$/.test(form.email.trim())) throw new Error('Escribe un correo electrónico válido.')
      if (!editing && form.password.length < 8) throw new Error('La contraseña inicial debe tener al menos 8 caracteres.')
      if (editing && form.password && form.password.length < 8) throw new Error('La nueva contraseña debe tener al menos 8 caracteres.')
      const payload = {
        first_name: form.first_name.trim(), last_name: form.last_name.trim(),
        second_last_name: form.second_last_name.trim(), email: form.email.trim().toLowerCase(),
        department_id: form.department_id || null, is_admin: form.is_admin,
        is_global_viewer: form.is_global_viewer, is_active: form.is_active,
        can_view_vehicle: form.can_view_vehicle, can_create_vehicle: form.can_create_vehicle,
        can_update_vehicle: form.can_update_vehicle,
      }
      const successText = editing ? 'Los cambios del usuario se guardaron correctamente.' : 'El usuario se creó correctamente.'
      if (editing) {
        await invokeAdminFunction('admin-update-user', { user_id: editing.id, ...payload, password: form.password || undefined })
      } else {
        await invokeAdminFunction('admin-create-user', { ...payload, password: form.password })
      }
      await load()
      setPage('list')
      setMessage({ type: 'success', text: successText })
    } catch (error) {
      setMessage({ type: 'error', text: errorText(error) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="admin-users">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow"><ShieldCheck size={15} /> ADMINISTRACIÓN DEL SISTEMA</p>
          <h1>{page === 'form' ? (editing ? 'Editar usuario' : 'Crear usuario') : 'Gestión de usuarios'}</h1>
          <p className="admin-subtitle">Administra cuentas, departamentos y permisos de acceso.</p>
        </div>
        <button className="admin-button secondary" type="button" onClick={page === 'form' ? () => setPage('list') : onBack}>
          <ArrowLeft size={17} /> {page === 'form' ? 'Volver a usuarios' : 'Volver al dashboard'}
        </button>
      </div>

      {message && <div className={`admin-alert ${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</div>}

      {page === 'list' ? (
        <>
          <div className="admin-metrics">
            <article className="admin-metric"><UsersIcon size={21} /><div><span>Usuarios registrados</span><strong>{users.length}</strong></div></article>
            <article className="admin-metric"><ShieldCheck size={21} /><div><span>Administradores</span><strong>{users.filter(u => u.is_admin).length}</strong></div></article>
            <article className="admin-metric"><div className="admin-status-dot" /><div><span>Usuarios activos</span><strong>{users.filter(u => u.is_active !== false).length}</strong></div></article>
          </div>

          <div className="admin-panel">
            <div className="admin-toolbar">
              <div className="admin-search"><Search size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o correo" aria-label="Buscar usuarios" /></div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filtrar por estado">
                <option value="all">Todos los estados</option><option value="active">Activos</option><option value="inactive">Inactivos</option>
              </select>
              <button className="admin-button secondary" type="button" onClick={load} disabled={loading}><RefreshCw size={16} /> Actualizar</button>
              <button className="admin-button primary" type="button" onClick={startCreate}><UserPlus size={17} /> Nuevo usuario</button>
            </div>
            {loading ? <div className="admin-empty">Cargando usuarios…</div> : filteredUsers.length === 0 ? (
              <div className="admin-empty">{users.length ? 'No hay usuarios que coincidan con la búsqueda.' : 'No se encontraron usuarios o no se pudo cargar la lista. Revisa el mensaje de error.'}</div>
            ) : (
              <div className="admin-table-wrap"><table className="admin-table">
                <thead><tr><th>Usuario</th><th>Correo electrónico</th><th>Departamento</th><th>Rol</th><th>Estado</th><th>Acción</th></tr></thead>
                <tbody>{filteredUsers.map(user => {
                  const name = [user.first_name, user.last_name, user.second_last_name].filter(Boolean).join(' ') || 'Sin nombre'
                  return <tr key={user.id}>
                    <td><div className="admin-user-cell"><span className="admin-user-avatar">{name.slice(0, 2).toUpperCase()}</span><div><strong>{name}</strong><small>{user.id.slice(0, 8)}…</small></div></div></td>
                    <td>{user.email || '—'}</td><td>{departmentName[String(user.department_id)] || 'Sin departamento'}</td>
                    <td><span className={`admin-role ${user.is_admin ? 'administrator' : ''}`}>{user.is_admin ? 'Administrador' : user.is_global_viewer ? 'Visor global' : 'Usuario'}</span></td>
                    <td><span className={`admin-state ${user.is_active === false ? 'inactive' : 'active'}`}>{user.is_active === false ? 'Inactivo' : 'Activo'}</span></td>
                    <td><button className="admin-icon-button" type="button" onClick={() => startEdit(user)} aria-label={`Editar ${name}`} title="Editar usuario"><Pencil size={17} /></button></td>
                  </tr>
                })}</tbody>
              </table></div>
            )}
            <div className="admin-table-footer">Mostrando {filteredUsers.length} de {users.length} usuarios</div>
          </div>
        </>
      ) : (
        <form className="admin-panel admin-user-form" onSubmit={handleSubmit}>
          <h2>Información de la cuenta</h2>
          <div className="admin-form-grid">
            <label className="admin-field">Nombre *<input name="first_name" value={form.first_name} onChange={updateField} required autoComplete="given-name" /></label>
            <label className="admin-field">Apellido<input name="last_name" value={form.last_name} onChange={updateField} autoComplete="family-name" /></label>
            <label className="admin-field">Segundo apellido<input name="second_last_name" value={form.second_last_name} onChange={updateField} /></label>
            <label className="admin-field">Correo electrónico *<input name="email" type="email" value={form.email} onChange={updateField} required autoComplete="email" /></label>
            <label className="admin-field">{editing ? 'Nueva contraseña (opcional)' : 'Contraseña inicial *'}<input name="password" type="password" value={form.password} onChange={updateField} minLength={8} required={!editing} autoComplete="new-password" placeholder={editing ? 'Dejar en blanco para conservarla' : 'Mínimo 8 caracteres'} /></label>
            <label className="admin-field">Departamento<select name="department_id" value={form.department_id} onChange={updateField}><option value="">Sin departamento</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          </div>

          <h2 className="admin-form-section-title">Rol y estado de la cuenta</h2>
          <div className="admin-checkbox-grid">
            <label className="admin-check"><input type="checkbox" name="is_admin" checked={form.is_admin} onChange={updateField} /><span><strong>Administrador del sistema</strong><small>Puede administrar usuarios y permisos.</small></span></label>
            <label className="admin-check"><input type="checkbox" name="is_global_viewer" checked={form.is_global_viewer} onChange={updateField} /><span><strong>Visor global</strong><small>Puede ver información de todos los departamentos según las políticas de la base de datos.</small></span></label>
            <label className="admin-check"><input type="checkbox" name="is_active" checked={form.is_active} onChange={updateField} /><span><strong>Cuenta activa</strong><small>Las cuentas inactivas deben bloquearse también en las políticas de acceso.</small></span></label>
          </div>

          <h2 className="admin-form-section-title">Permisos de vehículos para el departamento seleccionado</h2>
          <div className="admin-checkbox-grid permissions">
            <label className="admin-check"><input type="checkbox" name="can_view_vehicle" checked={form.can_view_vehicle} onChange={updateField} /><span><strong>Ver vehículos</strong><small>Consultar vehículos del departamento.</small></span></label>
            <label className="admin-check"><input type="checkbox" name="can_create_vehicle" checked={form.can_create_vehicle} onChange={updateField} /><span><strong>Crear vehículos</strong><small>Registrar vehículos nuevos.</small></span></label>
            <label className="admin-check"><input type="checkbox" name="can_update_vehicle" checked={form.can_update_vehicle} onChange={updateField} /><span><strong>Editar vehículos</strong><small>Actualizar datos de vehículos.</small></span></label>
          </div>
          <p className="admin-help">Los permisos por departamento se reemplazan por la selección actual al guardar. Si no seleccionas un departamento, no se asignará una fila de permisos.</p>
          <div className="admin-form-actions"><button className="admin-button secondary" type="button" onClick={() => { setPage('list'); setMessage(null) }}>Cancelar</button><button className="admin-button primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear usuario'}</button></div>
        </form>
      )}
    </section>
  )
}
