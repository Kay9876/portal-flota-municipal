export function validateCreateUser(form) {
  const errors = {}
  const firstName = String(form.first_name ?? '').trim()
  const email = String(form.email ?? '').trim()
  const password = String(form.password ?? '')

  if (!firstName) errors.first_name = 'El nombre es obligatorio.'
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    errors.email = 'Escribe un correo electrónico válido.'
  }
  if (password.length < 8) {
    errors.password = 'La contraseña inicial debe tener al menos 8 caracteres.'
  }
  if (form.department_id && (!Number.isSafeInteger(Number(form.department_id)) || Number(form.department_id) < 1)) {
    errors.department_id = 'Departamento inválido.'
  }
  return errors
}

export function validateEditUser(form) {
  const errors = {}
  const firstName = String(form.first_name ?? '').trim()
  const email = String(form.email ?? '').trim()

  if (!firstName) errors.first_name = 'El nombre es obligatorio.'
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    errors.email = 'Escribe un correo electrónico válido.'
  }
  if (form.department_id && (!Number.isSafeInteger(Number(form.department_id)) || Number(form.department_id) < 1)) {
    errors.department_id = 'Departamento inválido.'
  }
  return errors
}

function commonUserPayload(form) {
  return {
    first_name: String(form.first_name ?? '').trim(),
    last_name: String(form.last_name ?? '').trim(),
    second_last_name: String(form.second_last_name ?? '').trim(),
    email: String(form.email ?? '').trim().toLowerCase(),
    department_id: form.department_id || null,
    is_admin: form.is_admin === true,
    is_global_viewer: form.is_global_viewer === true,
    is_active: form.is_active !== false,
    can_view_vehicle: form.can_view_vehicle === true,
    can_create_vehicle: form.can_create_vehicle === true,
    can_update_vehicle: form.can_update_vehicle === true,
  }
}

export function buildCreateUserPayload(form) {
  return { ...commonUserPayload(form), password: String(form.password ?? '') }
}

export function buildEditUserPayload(userId, form) {
  // Password is deliberately excluded: administrators cannot change another user's password.
  return { user_id: userId, ...commonUserPayload(form) }
}
