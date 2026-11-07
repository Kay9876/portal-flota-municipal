export const MIN_PASSWORD = 8

export function friendlyError(error) {
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

export function validateNewPassword(newPassword, confirmPassword) {
  if (newPassword.length < MIN_PASSWORD) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`
  }
  if (newPassword != confirmPassword) {
    return 'Las contraseñas no coinciden.'
  }
}

export function needsPasswordChange(session) {
  return session?.user?.user_metadata?.must_change_password === true
}

export function getAuthScreen(session, recovering) {
  if (!session) return 'login'
  if (recovering) return 'recovery'
  if (needsPasswordChange(session)) return 'force-change'
  return 'home'
}

export function getSubmitLabel(loading, forceChange, mode) {
  if (loading) return forceChange ? 'Guardando...' : 'Entrando...'
  if (forceChange) return 'Guardar nueva contraseña'
  if (mode === 'forgot') return 'Restablecer contraseña'
  return 'Iniciar sesión'
}

export function getForceChangeMessage(recovery) {
  return recovery
    ? 'Elige una contraseña nueva para tu cuenta.'
    : 'Esta es tu primera vez entrando al portal. Debes cambiar tu contraseña a una diferente a la que se te ha proveído.'
}

export const RESET_SENT_MESSAGE = 'Si el correo está registrado, recibirás un enlace para crear una contraseña nueva.'

export async function requestPasswordReset(supabase, email, redirectTo) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
  if (error) return { type: 'error', text: friendlyError(error) }
  return { type: 'ok', text: RESET_SENT_MESSAGE }
}