import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function respond(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
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
  if (callerError || callerProfile?.is_admin !== true || callerProfile.is_active === false) return respond({ error: 'Solo un administrador activo puede consultar usuarios.' }, 403)

  const { data: profiles, error: profilesError } = await admin.from('profiles')
    .select('id,first_name,last_name,second_last_name,department_id,is_admin,is_global_viewer,is_active,created_at')
    .order('created_at', { ascending: false })
  if (profilesError) return respond({ error: `No se pudieron cargar los perfiles: ${profilesError.message}` }, 500)
  const { data: departments, error: departmentsError } = await admin.from('departments').select('id,name').order('name')
  if (departmentsError) return respond({ error: `No se pudieron cargar los departamentos: ${departmentsError.message}` }, 500)
  const { data: permissionRows, error: permissionError } = await admin.from('user_permissions')
    .select('user_id,department_id,can_view_vehicle,can_create_vehicle,can_update_vehicle')
  if (permissionError) return respond({ error: `No se pudieron cargar los permisos: ${permissionError.message}` }, 500)

  const authUsers: Array<{ id: string; email?: string }> = []
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) return respond({ error: `No se pudieron cargar las cuentas: ${error.message}` }, 500)
    authUsers.push(...data.users.map(u => ({ id: u.id, email: u.email || '' })))
    if (data.users.length < 1000) break
  }
  const emails = new Map(authUsers.map(u => [u.id, u.email]))
  const permissions = new Map<string, any>()
  for (const permission of permissionRows || []) permissions.set(`${permission.user_id}:${permission.department_id}`, permission)
  const users = (profiles || []).map(profile => ({
    ...profile,
    email: emails.get(profile.id) || '',
    permission: profile.department_id == null ? null : permissions.get(`${profile.id}:${profile.department_id}`) || null,
  }))
  return respond({ users, departments: departments || [] })
})
