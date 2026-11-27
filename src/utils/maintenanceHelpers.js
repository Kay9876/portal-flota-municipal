export const CATEGORIES=[
    {value: 'gomas', label: 'Gomas'},
    {value: 'frenos', label: 'Frenos'},
    {value: 'motor', label: 'Motor'},
    {value: 'electrico', label: 'Eléctrico'},
    {value: 'ac', label: 'Aire acondicionado'},
    {value: 'golpe', label: 'Golpe'},
    {value: 'otro', label: 'Otro'},
]

export const PHOTO_TYPES=['image/png','image/jpeg','image/jpg','image/webp']
export const PHOTO_MAX_MB=5

export function reportMode(user,profile){
    if(!user) return 'publico'
    if(profile?.is_mechanic) return 'mecanico'
    return 'secretaria'
}

export const emptyIssue=()=>({
    plate: '',
    vehicle_id: '',
    reporter_name: '',
    reporter_phone: '',
    department_id: '',
    category: '',
    description: '',
    vehicle_usable: '',
    receive_now: false,
    website: ''
})

export function validateIssue(form,mode,photo){
    const errs={}
    if(mode==='publico'){
        if(!form.plate.trim()) errs.plate='Ingrese la tablilla del vehículo'
        if(!form.reporter_name.trim()) errs.reporter_name='Ingrese su nombre'
        if(!form.reporter_phone.trim()) errs.reporter_phone='Ingrese su teléfono'
    }else if(!form.vehicle_id){
        errs.vehicle_id='Seleccione un vehículo'
    }

    if(!form.category) errs.category='Seleccione una categoría'
    const desc=form.description.trim()
    if(desc.length<5) errs.description='Ingrese una descripción más detallada (mínimo 5 caracteres)'
    else if(desc.length>500) errs.description='La descripción no puede exceder 500 caracteres'

    if(!form.vehicle_usable) errs.vehicle_usable='Indique si el vehículo es utilizable'
    if(photo && !PHOTO_TYPES.includes(photo.type)) errs.photo='El archivo debe ser una imagen PNG, JPG o WEBP'
    else if(photo && photo.size>PHOTO_MAX_MB*1024*1024) errs.photo=`El archivo no puede exceder ${PHOTO_MAX_MB} MB`
    return errs


}

export function buildIssueFormData(form,mode,photo){
    const fd=new FormData()
    fd.append('plate',form.plate)
    fd.append('vehicle_id',form.vehicle_id)
    fd.append('reporter_name',form.reporter_name)
    fd.append('reporter_phone',form.reporter_phone)
    fd.append('department_id',form.department_id)
    fd.append('category',form.category)
    fd.append('description',form.description)
    fd.append('vehicle_usable',form.vehicle_usable==='si' ? 'true' : 'false')
    fd.append('receive_now',mode==='mecanico' && form.receive_now ? 'true' : 'false')
    fd.append('website',form.website)
    if(photo) fd.append('photo',photo)

    return fd
}
export const categoryLabel=(value)=>CATEGORIES.find(c=>c.value===value)?.label||value

export const STATUSES=[
    {value:'nueva',label:'Nueva',one:'Nueva',tone:'blue'},
    {value:'agendada',label:'Agendada',one:'Agendada',tone:'purple'},
    {value:'en_taller',label:'En taller',one:'En taller',tone:'amber'},
    {value:'esperando_piezas',label:'Esperando piezas',one:'Esperando piezas',tone:'red'},
    {value:'completada',label:'Completada',one:'Completada',tone:'green'},
    {value:'cancelada',label:'Cancelada',one:'Cancelada',tone:'gray'},
]

export const OPEN_STATUSES=['nueva','agendada','en_taller','esperando_piezas']
export const statusInfo=(value)=>STATUSES.find(s=>s.value===value)||{label:value,one:value,tone:'gray'}

export function nextActions(status){
    switch(status){
        case 'nueva': return ['agendar','recibir','cancelar']
        case 'agendada': return ['recibir','reagendar','cancelar']
        case 'en_taller': return ['completar','piezas']
        case 'esperando_piezas': return ['continuar', 'completar']
        default: return []
    }
}

export function sortRequests(list){
    return [...list].sort((a,b)=>{
        if((a.priority==='urgente')!==(b.priority==='urgente')) return a.priority==='urgente' ? -1 : 1
        if(a.scheduled_at && b.scheduled_at) return new Date(a.scheduled_at)-new Date(b.scheduled_at)
        if(a.scheduled_at!==b.scheduled_at) return a.scheduled_at ? -1:1
        return new Date(a.created_at) - new Date(b.created_at)
})
}

export function countByStatus(list){
    const c=Object.fromEntries(STATUSES.map(s=>[s.value,0]))
    for(const item of list){
        c[item.status]= (c[item.status] || 0) + 1
    }
    return c
}

export const isSameDay=(iso,now=new Date())=>{
    if(!iso) return false
    const d=new Date(iso)
    return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth() && d.getDate()===now.getDate()  
}

export function timeAgo(iso,now=new Date()){
    const min=Math.max(0,Math.floor((now.getTime()-new Date(iso).getTime())/60000))
    if(min<1) return 'hace unos segundos'
    if(min<60) return `hace ${min} minutos`
    if(min<1440) return `hace ${Math.floor(min/60)} horas`
    return `hace ${Math.floor(min/1440)} días`
}

export const formatSchedule=(iso)=>iso ? new Date(iso).toLocaleString('es-PR',{dateStyle:'short',timeStyle:'short'}) : ''   

export function scheduleToIso(value){
    if (!value) return null
    const d=new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function validateCompletion(form){
    const errs={}
    if(!form.work_done?.trim()) errs.work_done='Ingrese notas de finalización'    
    if (form.cost==='' || form.cost===null || form.cost===undefined) errs.cost='Ingrese un costo'
    if(form.mileage!=='' && (!Number.isInteger(Number(form.mileage)) || Number(form.mileage)<0)) errs.mileage='Ingrese un kilometraje válido'
    return errs
}

export function monthStats(list,now=new Date()){
    const done=list.filter(r=>r.status==='completada' && r.end_date &&
        new Date(r.end_date + 'T12:00:00').getMonth()===now.getMonth() && new Date(r.end_date + 'T12:00:00').getFullYear()===now.getFullYear()) 
    return{completed: done.length, total: list.filter(r=>r.status!=='cancelada').length, cost: done.reduce((sum,r)=>sum+(Number(r.cost)||0),0)  
    }
}

