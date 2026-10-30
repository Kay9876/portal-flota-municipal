// Login page: users sign in with email and password 
// If the credentials are correct the homepage is shown. 

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { supabase } from '../supabaseClient'


import escudoLogo from 'url:../assets/escudoVA.png'


function friendlyError(error) {
  const code = error?.code || ''
  const text = (error?.message || '').toLowerCase()

  if (code === 'invalid_credentials' || text.includes('invalid login credentials')) {
    return 'Correo electrónico o contraseña incorrectos.'
  }
  if (code === 'email_not_confirmed' || text.includes('email not confirmed')) {
    return 'Debes confirmar tu correo electrónico antes de entrar.'
  }
  if (code === 'user_already_exists' || text.includes('already registered')) {
    return 'Ya existe una cuenta con ese correo electrónico.'
  }
  if (error?.status === 429 || code.includes('rate_limit') || text.includes('rate limit')) {
    return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
  }
  if (error?.name === 'AuthRetryableFetchError' || text.includes('fetch')) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión a internet.'
  }
  return error?.message || 'No se pudo completar la solicitud. Inténtalo de nuevo.'
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [isSignup, setIsSignup] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null) // { type: 'error' | 'ok', text }

  async function handleSubmit(e) {
    e.preventDefault()
    if (loading) return

    setMsg(null)
    setLoading(true)
    try {
      const cleanEmail = email.trim()
      const { data, error } = isSignup
        ? await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: { data: { first_name: firstName.trim(), last_name: lastName.trim() } },
          })
        : await supabase.auth.signInWithPassword({ email: cleanEmail, password })

      if (error) {
        setMsg({ type: 'error', text: friendlyError(error) })
      } else if (isSignup && !data?.session) {
        // Si el proyecto exige confirmar el correo, no hay sesión todavía.
        setMsg({ type: 'ok', text: 'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.' })
      }
      // Si hay sesión, App.jsx la detecta (onAuthStateChange) y muestra Homepage.
    } catch (err) {
      setMsg({ type: 'error', text: friendlyError(err) })
    } finally {
      setLoading(false)
    }
  }

  function toggleMode() {
    setIsSignup(!isSignup)
    setMsg(null)
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand">
          <div className="login-logo">
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
          <h1>Portal de Flota Municipal</h1>
          <p>Municipio Autónomo de Vega Alta</p>
        </div>

        {isSignup && (
          <div className="row-2">
            <div className="field">
              <label htmlFor="login-first-name">Nombre</label>
              <input
                id="login-first-name"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="login-last-name">Apellido</label>
              <input
                id="login-last-name"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>
        )}

        <div className="field">
          <label htmlFor="login-email">Correo electrónico</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="login-password">Contraseña{isSignup ? ' (mínimo 6 caracteres)' : ''}</label>
          <div className="password-wrap">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isSignup ? 6 : undefined}
            />
            <button
              className="password-toggle"
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
            </button>
          </div>
        </div>

        <button className="btn" type="submit" disabled={loading}>
          {loading ? (isSignup ? 'Creando cuenta…' : 'Entrando…') : (isSignup ? 'Crear cuenta' : 'Iniciar sesión')}
        </button>

        <button className="btn-link" type="button" onClick={toggleMode}>
          {isSignup ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Crea una'}
        </button>

        {msg && <div className={`msg ${msg.type}`} role={msg.type === 'error' ? 'alert' : 'status'}>{msg.text}</div>}

        
      </form>
    </main>
  )
}