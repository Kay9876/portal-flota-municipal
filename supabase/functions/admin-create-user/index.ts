import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function respond(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return respond({ error: 'Método no permitido.' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return respond({ error: 'Se requiere iniciar sesión.' }, 401)

  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: authData, error: authError } = await callerClient.auth.getUser()
  if (authError || !authData.user) return respond({ error: 'Sesión no válida.' }, 401)

  const adminClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles').select('is_admin,is_active').eq('id', authData.user.id).maybeSingle()
  if (profileError || !callerProfile?.is_admin || callerProfile.is_active === false) {
    return respond({ error: 'Solo un administrador activo puede crear usuarios.' }, 403)
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return respond({ error: 'Solicitud inválida.' }, 400) }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const first_name = typeof body.first_name === 'string' ? body.first_name.trim() : ''
  if (!email || !email.includes('@') || password.length < 8 || !first_name) {
    return respond({ error: 'Incluye un correo válido, nombre y contraseña de al menos 8 caracteres.' }, 400)
  }

  const departmentId = body.department_id === null || body.department_id === '' || body.department_id === undefined
    ? null : Number(body.department_id)
  if (departmentId !== null && (!Number.isSafeInteger(departmentId) || departmentId < 1)) {
    return respond({ error: 'Departamento inválido.' }, 400)
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { must_change_password: true },
  })
  if (createError || !created.user) return respond({ error: createError?.message || 'No se pudo crear la cuenta.' }, 400)

  const { data: updatedProfile, error: insertError } = await adminClient.from('profiles').update({
    id: created.user.id,
    first_name,
    last_name: typeof body.last_name === 'string' ? body.last_name.trim() || null : null,
    second_last_name: typeof body.second_last_name === 'string' ? body.second_last_name.trim() || null : null,
    department_id: departmentId,
    is_admin: body.is_admin === true,
    is_global_viewer: body.is_global_viewer === true,
    is_active: body.is_active !== false,
  })
    .eq('id', created.user.id)
    .select('id')
    .maybeSingle()
  if (insertError || !updatedProfile) {
    // Roll back the Auth account if the profile could not be created.
    await adminClient.auth.admin.deleteUser(created.user.id)
    return respond(
      {
        error: `No se pudo guardar el perfil: ${
          insertError?.message ?? 'No se encontró el perfil creado.'
        }`,
      }, 400)
  }
  const canView = body.can_view_vehicle === true
  const canCreate = body.can_create_vehicle === true
  const canUpdate = body.can_update_vehicle === true
  if (departmentId !== null && (canView || canCreate || canUpdate)) {
    const { error: permissionError } = await adminClient.from('user_permissions').insert({
      user_id: created.user.id,
      department_id: departmentId,
      can_view_vehicle: canView,
      can_create_vehicle: canCreate,
      can_update_vehicle: canUpdate,
      granted_by: authData.user.id,
    })
    if (permissionError) {
      await adminClient.from('profiles').delete().eq('id', created.user.id)
      await adminClient.auth.admin.deleteUser(created.user.id)
      return respond({ error: `No se pudieron guardar los permisos: ${permissionError.message}` }, 400)
    }
  }
  return respond({ user_id: created.user.id, message: 'Usuario creado.' }, 200)

})
