// import { useEffect, useState } from 'react'
// import { supabase } from './supabaseClient'
// import './App.css'

// function Login() {
//   const [email, setEmail] = useState('')
//   const [password, setPassword] = useState('')
//   const [firstName, setFirstName] = useState('')
//   const [lastName, setLastName] = useState('')
//   const [isSignup, setIsSignup] = useState(false)
//   const [msg, setMsg] = useState('')

//   async function handleSubmit(e) {
//     e.preventDefault()
//     setMsg('')
//     const { error } = isSignup
//       ? await supabase.auth.signUp({
//           email,
//           password,
//           options: { data: { first_name: firstName, last_name: lastName } },
//         })
//       : await supabase.auth.signInWithPassword({ email, password })
//     if (error) setMsg(error.message)
//   }

//   return (
//     <div className="login-page">
//       <form className="login-card" onSubmit={handleSubmit}>
//         <div className="brand">
//           <div className="brand-icon">🚓</div>
//           <h1>Portal de Flota Municipal</h1>
//           <p>Municipio Autónomo de Vega Alta</p>
//         </div>

//         {isSignup && (
//           <div className="row-2">
//             <label className="field">Nombre
//               <input value={firstName} onChange={e => setFirstName(e.target.value)} required />
//             </label>
//             <label className="field">Apellido
//               <input value={lastName} onChange={e => setLastName(e.target.value)} required />
//             </label>
//           </div>
//         )}
//         <label className="field">Email
//           <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
//         </label>
//         <label className="field">Contraseña
//           <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
//         </label>

//         <button className="btn" type="submit">{isSignup ? 'Crear cuenta' : 'Iniciar sesión'}</button>
//         <button className="btn-link" type="button" onClick={() => setIsSignup(!isSignup)}>
//           {isSignup ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Crea una'}
//         </button>
//         {msg && <div className="msg error">{msg}</div>}
//       </form>
//     </div>
//   )
// }

// const emptyForm = { department_id: '', manufacturer: '', model: '', year: '', license_plate: '' }

// function Home({ session }) {
//   const [profile, setProfile] = useState(null)
//   const [departments, setDepartments] = useState([])
//   const [vehicles, setVehicles] = useState([])
//   const [form, setForm] = useState(emptyForm)
//   const [msg, setMsg] = useState(null)

//   async function load() {
//     const p = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
//     const d = await supabase.from('departments').select('*').order('name')
//     const v = await supabase.from('vehicles').select('*, departments(name)').order('id', { ascending: false })
//     setProfile(p.data)
//     setDepartments(d.data || [])
//     setVehicles(v.data || [])
//     if (v.error) setMsg({ type: 'error', text: 'Error cargando vehículos: ' + v.error.message })
//   }

//   useEffect(() => { load() }, [])

//   async function saveVehicle(e) {
//     e.preventDefault()
//     setMsg(null)
//     const { error } = await supabase.from('vehicles').insert({
//       department_id: Number(form.department_id),
//       manufacturer: form.manufacturer,
//       model: form.model,
//       year: form.year ? Number(form.year) : null,
//       license_plate: form.license_plate.toUpperCase(),
//     })
//     if (error) { setMsg({ type: 'error', text: 'Error: ' + error.message }); return }
//     setMsg({ type: 'ok', text: 'Vehículo registrado ✔' })
//     setForm(emptyForm)
//     load()
//   }

//   const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

//   const active = vehicles.filter(v => v.is_active !== false).length
//   const inactive = vehicles.length - active

//   return (
//     <>
//       <header className="topbar">
//         <h1>🚓 Flota Municipal · Vega Alta</h1>
//         <div className="user">
//           <span>{profile?.first_name} {profile?.last_name}</span>
//           {profile?.is_admin && <span className="badge">ADMIN</span>}
//           <button className="btn-ghost" onClick={() => supabase.auth.signOut()}>Salir</button>
//         </div>
//       </header>

//       <main className="container">
//         <section className="stats">
//           <div className="stat"><div className="label">Total de vehículos</div><div className="value">{vehicles.length}</div></div>
//           <div className="stat green"><div className="label">Activos</div><div className="value">{active}</div></div>
//           <div className="stat red"><div className="label">Fuera de servicio</div><div className="value">{inactive}</div></div>
//           <div className="stat navy"><div className="label">Departamentos</div><div className="value">{departments.length}</div></div>
//         </section>

//         <div className="grid">
//           <form className="card" onSubmit={saveVehicle}>
//             <h2>Registrar vehículo</h2>
//             <label className="field">Departamento
//               <select value={form.department_id} onChange={set('department_id')} required>
//                 <option value="">— Selecciona —</option>
//                 {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
//               </select>
//             </label>
//             <div className="row-2">
//               <label className="field">Marca
//                 <input value={form.manufacturer} onChange={set('manufacturer')} placeholder="Ford" required />
//               </label>
//               <label className="field">Modelo
//                 <input value={form.model} onChange={set('model')} placeholder="F-150" required />
//               </label>
//             </div>
//             <div className="row-2">
//               <label className="field">Año
//                 <input type="number" value={form.year} onChange={set('year')} placeholder="2022" />
//               </label>
//               <label className="field">Tablilla
//                 <input value={form.license_plate} onChange={set('license_plate')} placeholder="ABC123" required />
//               </label>
//             </div>
//             <button className="btn" type="submit">Guardar vehículo</button>
//             {msg && <div className={'msg ' + msg.type}>{msg.text}</div>}
//           </form>

//           <section className="card">
//             <h2>Vehículos registrados</h2>
//             {vehicles.length === 0 ? (
//               <div className="empty">Todavía no hay vehículos. ¡Registra el primero! 🚗</div>
//             ) : (
//               <div className="table-wrap">
//                 <table>
//                   <thead>
//                     <tr><th>Tablilla</th><th>Vehículo</th><th>Año</th><th>Departamento</th><th>Estado</th></tr>
//                   </thead>
//                   <tbody>
//                     {vehicles.map(v => (
//                       <tr key={v.id}>
//                         <td><span className="plate">{v.license_plate}</span></td>
//                         <td>{v.manufacturer} {v.model}</td>
//                         <td>{v.year ?? '—'}</td>
//                         <td>{v.departments?.name}</td>
//                         <td>
//                           <span className={'pill ' + (v.is_active !== false ? 'on' : 'off')}>
//                             {v.is_active !== false ? 'Activo' : 'Fuera de servicio'}
//                           </span>
//                         </td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             )}
//           </section>
//         </div>
//       </main>
//     </>
//   )
// }

// export default function App() {
//   const [session, setSession] = useState(null)

//   useEffect(() => {
//     supabase.auth.getSession().then(({ data }) => setSession(data.session))
//     const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
//     return () => data.subscription.unsubscribe()
//   }, [])

//   return session ? <Home session={session} /> : <Login />
// }

import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import './App.css'
import Homepage from './Screens/homepage'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [isSignup, setIsSignup] = useState(false)
  const [msg, setMsg] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setMsg('')
    const { error } = isSignup
      ? await supabase.auth.signUp({
          email,
          password,
          options: { data: { first_name: firstName, last_name: lastName } },
        })
      : await supabase.auth.signInWithPassword({ email, password })
    if (error) setMsg(error.message)
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>{isSignup ? 'Crear cuenta' : 'Iniciar sesión'}</h2>

      {isSignup && (
        <>
          <input placeholder="Nombre" value={firstName} onChange={e => setFirstName(e.target.value)} required />
          <input placeholder="Apellido" value={lastName} onChange={e => setLastName(e.target.value)} required />
        </>
      )}
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
      <input type="password" placeholder="Contraseña (mín. 6)" value={password} onChange={e => setPassword(e.target.value)} required />

      <button type="submit">{isSignup ? 'Crear cuenta' : 'Entrar'}</button>
      <button type="button" onClick={() => setIsSignup(!isSignup)}>
        {isSignup ? 'Ya tengo cuenta' : 'Crear cuenta nueva'}
      </button>
      <p>{msg}</p>
    </form>
  )
}

const emptyForm = { department_id: '', manufacturer: '', model: '', year: '', license_plate: '' }

function Home({ session }) {
  const [profile, setProfile] = useState(null)
  const [departments, setDepartments] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [msg, setMsg] = useState('')

  async function load() {
    const p = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    const d = await supabase.from('departments').select('*').order('name')
    const v = await supabase.from('vehicles').select('*, departments(name)')
    setProfile(p.data)
    setDepartments(d.data || [])
    setVehicles(v.data || [])
    if (v.error) setMsg('Error cargando vehículos: ' + v.error.message)
  }

  useEffect(() => { load() }, [])

  async function saveVehicle(e) {
    e.preventDefault()
    setMsg('')
    const { error } = await supabase.from('vehicles').insert({
      department_id: Number(form.department_id),
      manufacturer: form.manufacturer,
      model: form.model,
      year: form.year ? Number(form.year) : null,
      license_plate: form.license_plate.toUpperCase(),
    })
    if (error) { setMsg('Error: ' + error.message); return }
    setMsg('Vehículo guardado ✔')
    setForm(emptyForm)
    load()
  }

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  return (
    <div>
      <p>
        Hola, {profile?.first_name} {profile?.last_name} — Admin: {profile?.is_admin ? 'Sí' : 'No'}
      </p>
      <button onClick={() => supabase.auth.signOut()}>Salir</button>

      <h2>Registrar vehículo</h2>
      <form onSubmit={saveVehicle}>
        <select value={form.department_id} onChange={set('department_id')} required>
          <option value="">Departamento</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input placeholder="Marca" value={form.manufacturer} onChange={set('manufacturer')} required />
        <input placeholder="Modelo" value={form.model} onChange={set('model')} required />
        <input placeholder="Año" type="number" value={form.year} onChange={set('year')} />
        <input placeholder="Tablilla" value={form.license_plate} onChange={set('license_plate')} required />
        <button type="submit">Guardar</button>
      </form>
      <p>{msg}</p>

      <h2>Vehículos ({vehicles.length})</h2>
      <ul>
        {vehicles.map(v => (
          <li key={v.id}>
            {v.license_plate} — {v.manufacturer} {v.model} {v.year} ({v.departments?.name})
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  // return session ? (
  //   <Homepage
  //     user={session.user}
  //     onSignOut={() => supabase.auth.signOut()}
  //   />
  // ) : (
  //   <Login />
  // )

  return <Homepage user={{ email: 'tester@gm.com', user_metadata: { first_name: 'Test User', is_admin: true } }} onSignOut={() => {}} />
}