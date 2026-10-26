import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function respond(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return respond({ error: 'Método no permitido.' }, 405)
  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return respond({ error: 'Se requiere iniciar sesión.' }, 401)
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: authData, error: authError } = await caller.auth.getUser()
  if (authError || !authData.user) return respond({ error: 'Sesión no válida.' }, 401)
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: callerProfile, error: callerError } = await admin.from('profiles').select('is_admin,is_active').eq('id', authData.user.id).maybeSingle()
  if (callerError || callerProfile?.is_admin !== true || callerProfile.is_active === false) return respond({ error: 'Solo un administrador activo puede editar usuarios.' }, 403)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return respond({ error: 'Solicitud inválida.' }, 400) }
  const userId = text(body.user_id)
  if (!userId) return respond({ error: 'Falta el identificador del usuario.' }, 400)
  const email = text(body.email).toLowerCase()
  const firstName = text(body.first_name)
  const password = typeof body.password === 'string' ? body.password : ''
  if (!firstName || !/^\S+@\S+\.\S+$/.test(email)) return respond({ error: 'Incluye un nombre y un correo válido.' }, 400)
  if (password && password.length < 8) return respond({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400)
  const departmentId = body.department_id === null || body.department_id === '' || body.department_id === undefined ? null : Number(body.department_id)
  if (departmentId !== null && (!Number.isSafeInteger(departmentId) || departmentId < 1)) return respond({ error: 'Departamento inválido.' }, 400)

  if (userId === authData.user.id && (body.is_admin !== true || body.is_active === false)) {
    return respond({ error: 'No puedes quitarte tu propio rol de administrador ni desactivar tu propia cuenta.' }, 400)
  }
  const { data: target, error: targetError } = await admin.from('profiles').select('id,is_admin,is_active').eq('id', userId).maybeSingle()
  if (targetError || !target) return respond({ error: 'No se encontró el perfil que deseas editar.' }, 404)
  if (target.is_admin === true && (body.is_admin !== true || body.is_active === false)) {
    const { count, error: countError } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('is_admin', true).eq('is_active', true)
    if (countError) return respond({ error: `No se pudo verificar los administradores activos: ${countError.message}` }, 500)
    if ((count || 0) <= 1) return respond({ error: 'No puedes desactivar o degradar al último administrador activo.' }, 400)
  }

  const authUpdate: { email?: string; password?: string } = { email }
  if (password) authUpdate.password = password
  const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, authUpdate)
  if (authUpdateError) return respond({ error: `No se pudo actualizar la cuenta de autenticación: ${authUpdateError.message}` }, 400)

  const profileUpdate = {
    first_name: firstName,
    last_name: text(body.last_name) || null,
    second_last_name: text(body.second_last_name) || null,
    department_id: departmentId,
    is_admin: body.is_admin === true,
    is_global_viewer: body.is_global_viewer === true,
    is_active: body.is_active !== false,
  }
  const { error: profileUpdateError } = await admin.from('profiles').update(profileUpdate).eq('id', userId)
  if (profileUpdateError) return respond({ error: `La cuenta se actualizó, pero no se pudo guardar el perfil: ${profileUpdateError.message}` }, 500)

  const { error: deletePermissionError } = await admin.from('user_permissions').delete().eq('user_id', userId)
  if (deletePermissionError) return respond({ error: `El perfil se guardó, pero no se pudieron actualizar los permisos: ${deletePermissionError.message}` }, 500)
  const canView = body.can_view_vehicle === true
  const canCreate = body.can_create_vehicle === true
  const canUpdate = body.can_update_vehicle === true
  if (departmentId !== null && (canView || canCreate || canUpdate)) {
    const { error: permissionInsertError } = await admin.from('user_permissions').insert({
      user_id: userId, department_id: departmentId,
      can_view_vehicle: canView, can_create_vehicle: canCreate, can_update_vehicle: canUpdate,
      granted_by: authData.user.id,
    })
    if (permissionInsertError) return respond({ error: `El perfil se guardó, pero no se pudieron guardar los permisos: ${permissionInsertError.message}` }, 500)
  }
  return respond({ message: 'Usuario actualizado.' })
})
