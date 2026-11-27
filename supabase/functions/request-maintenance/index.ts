import {createClient} from 'npm:@supabase/supabase-js@2'

const cors={
    'Access-Control-Allow-Origin' : '*',
    'Access-Control-Allow-Headers' : 'authorization, x-client-info,apikey,content-type',
    'Access-Control-Allow-Methods' : 'POST,OPTIONS'
}

const CATEGORIES=['gomas', 'frenos', 'motor', 'electrico' , 'ac','golpe','otro']
const PHOTO_TYPES=['image/jpeg', 'image/png','image/webp']
const PHOTO_MAX=5*1024*1024
const PUBLIC_LIMIT_PER_HOUR=5
const BUCKET='maintenance'

const json=(body:unknown,status=200)=>
    new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}})

const normPlate=(p:string)=>(p||'').toUpperCase().replace(/[^A-Z0-9]/g,'')
const text =(fd: FormData, k: string)=>String(fd.get(k)??'').trim()

Deno.serve(async (req)=>{
    if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors})
    if(req.method!=='POST') return json({error:'Method not allowed'},405)

    const url= Deno.env.get('SUPABASE_URL')!
    const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    try {
        const fd=await req.formData()
        if(text(fd,'website')) return json({folio: '0', status:'nueva'})

        let user: {id:string}|null=null
        let profile:Record<string,unknown>|null=null
        const auth=req.headers.get('Authorization')?? ''

        if(auth){
            const asUser=createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}})
            const{data}= await asUser.auth.getUser()
            if(data?.user) {
                user={id:data.user.id}
                const {data:profileData}= await admin.from('profiles').select(
                    'first_name,last_name,department_id,is_admin,is_global_viewer,is_mechanic,is_active').eq('id',user.id).maybeSingle()
                profile=profileData
                if(profile?.is_active===false) return json({error:'Usuario inactivo'},403)
                }
        }
        const isMechanic=!!(profile?.is_mechanic||profile?.is_admin)
        const mode=!user?'publico':isMechanic?'mecanico':'secretaria'
    

    const category=text(fd,'category')
    const description=text(fd,'description')
    const usable=text(fd,'vehicle_usable')
    const reporterName=text(fd,'reporter_name')
    const reporterPhone=text(fd,'reporter_phone')
    if(!CATEGORIES.includes(category)) return json({error:'Categoría inválida'},400)
    if(!description) return json({error:'Descripción requerida'},400)
    if(!['true','false'].includes(usable)) return json({error:'Campo "usable" inválido'},400)
    if(mode==='publico' && !reporterName) return json({error:'Nombre del reportante requerido'},400)

    const{data: vehicles}= await admin.from('vehicles').select('id,license_plate,department_id,status')
    let vehicle=null
    if(mode==='publico'){
        const plate=normPlate(text(fd,'plate'))
        vehicle=(vehicles||[]).find(v=>normPlate(v.license_plate)===plate)??null
        if(!vehicle) return json({error:'Vehículo no encontrado'},404)}
        else{
            vehicle=(vehicles||[]).find(v=>String(v.id)===text(fd,'vehicle_id'))??null
            if(!vehicle) return json({error:'Vehículo no encontrado'},404)
            }
        if(vehicle.status==='decomisado') return json({error:'Vehículo decomisado'},400)
            if(mode==='secretaria' && !profile?.is_global_viewer){
                const {data: perm} = await admin.from('user_permissions').select('department_id')
                .eq('user_id', user!.id).eq('department_id', vehicle.department_id).eq('can_view_vehicle', true).maybeSingle()
                if(!perm) return json({error:'No tiene permiso para reportar mantenimiento de este vehículo'},403)
            }

        const {data: open}= await admin.from('maintenance').select('id,folio,status,description')
        .eq('vehicle_id', vehicle.id).eq('category',category)
        .not('status','in','(completada,cancelada)').maybeSingle()
        if(open){
            const who=reporterName||[profile?.first_name,profile?.last_name].filter(Boolean).join(' ')||'Anonimo'
            const stamp=new Date().toLocaleString('es-PR',{timeZone:'America/Puerto_Rico'})
            await admin.from('maintenance').update({
                description: `${open.description ??''}\n\n[${stamp}] ${who}: ${description}`.slice(0,5000)}).eq('id',open.id)
            return json({folio: open.folio, status: open.status,duplicate: true})

        }

        let photoPath: string|null=null
        const photo=fd.get('photo')
        if(photo instanceof File){
            if(!PHOTO_TYPES.includes(photo.type)) return json({error:'Tipo de foto inválido'},400)
            if(photo.size>PHOTO_MAX) return json({error:'Foto demasiado grande'},400)
            const ext=photo.name.split('.').pop()||'jpg'
            const name=`${crypto.randomUUID()}.${ext}`
            const {data: uploadData, error: uploadError}= await admin.storage.from(BUCKET).upload(name, photo,{contentType: photo.type})
            if(uploadError) return json({error:'Error al subir la foto: '+uploadError.message},500)
            photoPath=uploadData.path
        }

        const vehicleUsable=usable==='true'
        const departmentId=Number(text(fd,'department_id'))||profile?.department_id|| vehicle.department_id
        const {data:created,error}= await admin.from('maintenance').insert({
            vehicle_id: vehicle.id,
            category,
            description,
            vehicle_usable: vehicleUsable,
            priority: vehicleUsable?'normal':'urgente',
            status:mode ==='mecanico' && text(fd,'receive_now')==='true'?'en_taller':'nueva',
            reporter_name: reporterName||[profile?.first_name,profile?.last_name].filter(Boolean).join(' ')||null,
            reporter_phone: reporterPhone||null,
            department_id: departmentId,
            photo_path: photoPath,
            source: mode==='publico'?'publico':'interno',
            created_by: user?.id||null,
        }).select('id,folio,status').single()

        if(error){
            if(error.code==='23505') return json({error:'Ya existe un reporte de mantenimiento abierto para este vehículo y categoría'},409)
            return json({error:'Error al crear el reporte: '+error.message},500)
        }

        notify(created.folio, vehicle.license_plate, category, description, vehicleUsable).catch(console.error)

        return json({folio: created.folio, status: created.status})
    } catch(err){
        return json({error:'Error interno del servidor: '+(err instanceof Error?err.message:String(err))},500)
    }
        
    })

    async function notify(folio:string, plate:string, category:string, description:string){
        const key=Deno.env.get('RESEND_API_KEY')
        const to=(Deno.env.get('MAINTENANCE_NOTIFY_EMAILS')??'').split(',').map(s=>s.trim()).filter(Boolean)
        if(!key || !to.length) return
        await fetch('https://api.resend.com/emails',{
            method:'POST',
            headers:{
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: Deno.env.get('MAINTENANCE_FROM_EMAIL') ?? 'Flota <onboarding@resend.dev>',
                to,
                subject: `Nuevo reporte de mantenimiento: ${folio}`,
                text: `Se ha creado un nuevo reporte de mantenimiento para el vehículo ${plate}.\n\nCategoría: ${category}\nDescripción: ${description}\nFolio: ${folio}`
            })
        })
    }