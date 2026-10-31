// Login page: users sign in with email and password 
// If the credentials are correct the homepage is shown. 
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../supabaseClient'
import escudoLogo from 'url:../assets/escudoVA.png'
import { createClient } from '@supabase/supabase-js'


const MIN_PASSWORD = 8


function friendlyError(error) {
  const code = error?.code || ''
  const text = (error?.message || '').toLowerCase()

  if (code === 'invalid_credentials' || text.includes('invalid login credentials')) {
    return 'Correo electrónico o contraseña incorrecta.'
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

function validateNewPassword(newPassword, confirmPassword) {
  if (newPassword.length < MIN_PASSWORD) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`
  }
  if (newPassword != confirmPassword) {
    return 'Las contraseñas no coinciden.'
  }
}

function PasswordField({ id, label, value, onChange, autoComplete, show, onToggle, hint, minLength, autoFocus }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-wrap">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={minLength}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        <button
          className="password-toggle"
          type="button"
          onClick={onToggle}
          aria-label={`${show ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`}
          aria-pressed={show}
        >
          {show ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
        </button>
      </div>
      {hint && <p className="login-help" id={`${id}-hint`}>{hint}</p>}
    </div>
  )
}

export default function LoginPage({forceChange = false, recovery = false}) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null) // { type: 'error' | 'ok', text }


  function switchMode(next) {
    setMode(next)
    setMsg(null)
    setPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setShowPassword(false)
  }



  async function handleSubmit(e) {
    e.preventDefault()
    if (loading) return

    setMsg(null)

    if (forceChange) {
      const problem = validateNewPassword(newPassword, confirmPassword)
      if (problem) {
        setMsg({ type: 'error', text: problem })
        return
      }
    }

    setLoading(true)
    try {
      if (forceChange) {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
          data: { must_change_password: false },
        })
        if (error) setMsg({ type: 'error', text: friendlyError(error) })
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        })
        if (error) {
          setMsg({ type: 'error', text: friendlyError(error) })
        } else {
          setMsg({ type: 'ok', text: 'Si el correo está registrado, recibirás un enlace para crear una contraseña nueva.' })
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) setMsg({ type: 'error', text: friendlyError(error) })
      }
    } catch (err) {
      setMsg({ type: 'error', text: friendlyError(err) })
    } finally {
      setLoading(false)
    }
  }

  const toggleShow = () => setShowPassword((v) => !v)

  let submitLabel
  if (loading) submitLabel = forceChange ? 'Guardando...' : 'Entrando...'
  else if (forceChange) submitLabel = 'Guardar nueva contraseña'
  else if (mode === 'forgot') submitLabel = 'Restablecer contraseña'
  else submitLabel = 'Iniciar sesión'

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

        {forceChange && (
          <div className="msg ok" role="status">
            {recovery
              ? 'Elige una contraseña nueva para tu cuenta.'
              : 'Esta es tu primera vez entrando al portal. Debes cambiar tu contraseña a una diferente a la que se te ha proveído.'}
            </div>
            )}

        {!forceChange && mode === 'forgot' && (
          <p className="login-help">Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.</p>
        )}    

        {!forceChange && (
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
        )}

        {!forceChange && mode === 'signin' && (
          <PasswordField
            id="login-password"
            label="Contraseña"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            show={showPassword}
            onToggle={toggleShow}
          />
        )}

        {forceChange && (
          <>
            <PasswordField
              id="login-new-password"
              label="Contraseña nueva"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
              show={showPassword}
              onToggle={toggleShow}
              hint={`Mínimo ${MIN_PASSWORD} caracteres.`}
              autoFocus
            />
            <PasswordField
              id="login-confirm-password"
              label="Confirmar contraseña nueva"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              show={showPassword}
              onToggle={toggleShow}
            />
          </>
        )}

        <button className="btn" type="submit" disabled={loading}>
          {submitLabel}
        </button>

        {forceChange ? (
          <button className="btn-link" type="button" onClick={() => supabase.auth.signOut()}>
            Salir
          </button>
        ) : mode === 'forgot' ? (
          <button className="btn-link" type="button" onClick={() => switchMode('signin')}>
            Volver a iniciar sesión
          </button>
        ) : (
          <button className="btn-link" type="button" onClick={() => switchMode('forgot')}>
            Cambiar contraseña
          </button>
        )}

        {msg && <div className={`msg ${msg.type}`} role={msg.type === 'error' ? 'alert' : 'status'}>{msg.text}</div>}
      </form>
    </main>
  )
}