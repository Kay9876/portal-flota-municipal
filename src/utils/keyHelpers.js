export const emptyRow=()=>({
    key: crypto.randomUUID(),
    driver_name: '',
    driver_license_num: '',
    user_department_id: '',
    user_department: '',
    passenger_name: '',
    destination: '',
    pickup_date: '',
    pickup_time: '',
    return_date: '',
    return_time: '',
    has_signature: false,
    ai: [],
    doubtful: []
})

export const isBlankRow=row=>!row.driver_name.trim() && !row.driver_license_num.trim() && !row.destination.trim() && !row.pickup_date.trim() && !row.pickup_time.trim() && !row.return_date.trim() && !row.return_time.trim()

export const normText=(s)=>
(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export const toInt=(v)=>(v==='' || v===null || v===undefined) ? null : Number(v)

export function toTimestamp(date,time){
    if(!date) return null
    const t=time||'00:00'
    return `${date}T${t.length===5?t+':00':t}-04:00`
}
export function aiToRow(value,type){
    if(value===null || value===undefined || value==='') return null
    if(type==='boolean') return value===true||String(value).toLowerCase()==='true'
    if(type==='integer'){
        const n=parseInt(String(value).replace(/\D/g,''),10)
        return isNaN(n) ? null : String(n)
    }

    if(type==='time'){
        const match=String(value||'').match(/(\d{1,2}):(\d{2})/)
        return match ? `${match[1].padStart(2,'0')}:${match[2]}` : null
    }

    if(type==='date'){
        const s=String(value).trim()
        if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
        const m=s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
        if(!m) return null
        const y=m[3].length===2 ? '20'+m[3] : m[3]
        return `${y}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`
        }
    return String(value).trim()
    }

    export function recordsToRows(records,columns,departments){
        return (records||[]).map(r=>{
            const row=emptyRow()
            for(const col of columns||[]){
                const field=col.db_column
                if(!field||!(field in row)||field==='key'||field==='ai'||field==='doubtful') continue
                const value=aiToRow(r[col.key],col.data_type)
                if(value===null) continue
                row[field]=value
                row.ai.push(field)
                if((r.campos_dudosos||[]).includes(col.key)) row.doubtful.push(field)}

            if(row.user_department){
                const dept=(departments||[]).find(d=>normText(d.name)===normText(row.user_department))
                if(dept) { row.user_department_id=String(dept.id); row.ai.push('user_department_id') }
                else row.doubtful.push('user_department_id')
            }
            return row
        })
    }
    export function rowsToPayload(rows,vehicleId,scanId){
        return rows.filter(r=>!isBlankRow(r)).map(r=>{
            const pickup=toTimestamp(r.pickup_date,r.pickup_time)
            const hasReturn=!!(r.return_date||r.return_time)
            const handover=hasReturn ? toTimestamp(r.return_date||r.pickup_date,r.return_time) : pickup
            return ({
            vehicle_id: Number(vehicleId),
            scan_id: scanId??null,
            kr_date: r.pickup_date,
            driver_name: r.driver_name.trim().toUpperCase(),
            driver_license_num: r.driver_license_num.trim()||null,
            user_department: r.user_department.trim()||null,
            user_department_id: r.user_department_id ? Number(r.user_department_id) : null,
            passenger_name: r.passenger_name.trim()||null,
            destination: r.destination.trim()||null,
            key_pickup:pickup,
            key_handover:handover,
            return_unknown: !hasReturn,
            has_signature: r.has_signature===true,
        source: scanId ? 'papel' : 'manual'})
    })
    }

    export function nextRow(prevRow){
        return {
            ...emptyRow(),
            pickup_date: prevRow.pickup_date||'',
            user_department_id: prevRow.user_department_id||'',
            user_department: prevRow.user_department||''
        }}

    const minutesBetween=(a,b)=>(new Date(b)-new Date(a))/60000
    const fmtTime=(iso)=>new Date(iso).toLocaleString('en-PR',{timeZone:'America/Puerto_Rico',hour12:false,hour:'2-digit',minute:'2-digit'})

    export function validateRows(rows,vehicle){
        const errors={}
        const warnings=[]
        const loans=[]

        rows.forEach((r,i)=>{
            if(isBlankRow(r)) return
            const n=i+1
            const e={}
            if(!r.driver_name) e.driver_name='Ingrese el nombre del conductor'
            if(!r.pickup_date) e.pickup_date='Ingrese la fecha de salida'
            if(!r.pickup_time) e.pickup_time='Ingrese la hora de salida'

            const pickup=toTimestamp(r.pickup_date,r.pickup_time)
            const hasReturn=!!(r.return_date||r.return_time)
            const handover=hasReturn ? toTimestamp(r.return_date||r.pickup_date,r.return_time) : null
            
            if(pickup && handover && new Date(handover)<new Date(pickup)) e.return_time='La hora de devolución no puede ser antes que la hora de salida'
           if(Object.keys(e).length){errors[i]=e; return}

           if(!hasReturn) warnings.push(`Fila ${n}: no se ha registrado la devolución del préstamo`)
           else if(r.return_date && !r.return_time) warnings.push(`Fila ${n}: no se ha registrado la hora de devolución del préstamo`)
            if(handover &&minutesBetween(pickup,handover)>12*60) warnings.push(`Fila ${n}: el préstamo se ha registrado con más de 12 horas de duración (${fmtTime(pickup)} - ${fmtTime(handover)})`)
            if(vehicle?.department_id && r.user_department_id && Number(r.user_department_id)!==Number(vehicle.department_id)) warnings.push(`Fila ${n}: el departamento del usuario no coincide con el departamento del vehículo`)
            
                loans.push({n,start:new Date(pickup),end:handover ? new Date(handover) : new Date(pickup),who:r.driver_name })
        })
        loans.sort((a,b)=>a.start-b.start)
        for(let i=1;i<loans.length;i++){
            const prev=loans[i-1]
            const curr=loans[i]
            if(curr.start<prev.end) warnings.push(`Fila ${curr.n}: el préstamo se ha registrado con un solapamiento con la fila ${prev.n} (${fmtTime(prev.start)} - ${fmtTime(prev.end)})`)
        }
        return {errors,warnings}
    }



