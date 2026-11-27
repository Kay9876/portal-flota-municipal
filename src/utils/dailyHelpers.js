export const emptyRow=()=>({
    key: crypto.randomUUID(),
    departure_date: '',
    driver_name: '',
    user_department_id: '',
    user_department: '',
    destination: '',
    departure_time: '',
    departure_mileage: '',
    arrival_time: '',
    arrival_mileage: '',
    has_signature: false,
    ai: [],
    doubtful: []
})

export const isBlankRow=row=>!row.departure_date && !row.driver_name && !row.user_department_id && !row.destination && !row.departure_time && !row.departure_mileage && !row.arrival_time && !row.arrival_mileage

export const normText=(s)=>
(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export const toInt=(v)=>(v==='' || v===null || v===undefined) ? null : Number(v)

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
        return rows.filter(r=>!isBlankRow(r)).map(r=>({
            vehicle_id: Number(vehicleId),
            scan_id: scanId??null,
            departure_date: r.departure_date,
            driver_name: r.driver_name.trim().toUpperCase(),
            user_department: r.user_department.trim()||null,
            user_department_id: r.user_department_id ? Number(r.user_department_id) : null,
            destination: r.destination.trim()||null,
            departure_time: r.departure_time||null,
            departure_mileage: toInt(r.departure_mileage),
            arrival_time: r.arrival_time||null,
            arrival_mileage: toInt(r.arrival_mileage),
            has_signature: r.has_signature===true}))
    }

    export function nextRow(prevRow){
        return {
            ...emptyRow(),
            departure_date: prevRow.departure_date||'',
            user_department_id: prevRow.user_department_id||'',
            user_department: prevRow.user_department||''
        }}

    const fmt=(n)=>n.toLocaleString('en-US')

    export function validateRows(rows,vehicle){
        const errors={}
        const warnings=[]
        let prev=null

        rows.forEach((r,i)=>{
            if(isBlankRow(r)) return
            const n=i+1
            const e={}
            const dep=toInt(r.departure_mileage)
            const arr=toInt(r.arrival_mileage)

            if(!r.departure_date) e.departure_date='Ingrese la fecha de salida'
            if(!r.driver_name.trim()) e.driver_name='Ingrese el nombre del conductor'
            if(dep!==null && arr!==null && arr<dep) e.arrival_mileage='El millaje de llegada no puede ser menor que el de salida'
            if(Object.keys(e).length) errors[i]=e

            if(r.departure_time && r.arrival_time && r.departure_time>r.arrival_time) warnings.push(`Fila ${n}: La hora de salida es mayor que la hora de llegada`)
            
            if(dep!==null && arr!==null && arr-dep>300) warnings.push(`Fila ${n}: La diferencia de millaje entre salida y llegada es mayor a 300 millas (${fmt(dep)} → ${fmt(arr)})`)
                
            if(prev===null){
                const last=vehicle?.total_mileage!=null ? Number(vehicle.total_mileage) : null
                if(last!==null && dep!==null && dep<last) warnings.push(`Fila ${n}: El millaje de salida (${fmt(dep)}) es menor que el millaje total registrado del vehículo (${fmt(last)})`)
             else if(last!==null && dep!==null && dep>last) warnings.push(`Fila ${n}: El millaje de salida (${fmt(dep)}) es mayor que el millaje de llegada de la fila anterior (${fmt(last)})`)}
            else{

                const prevArrival=toInt(prev.arrival_mileage)
                if (prevArrival!==null && dep!==null && dep!==prevArrival){warnings.push(dep>prevArrival ? `Fila ${n}: El millaje de salida (${fmt(dep)}) es mayor que el millaje de llegada de la fila anterior(${fmt(prevArrival)})` : `Fila ${n}: El millaje de salida (${fmt(dep)}) es menor que el millaje de llegada de la fila anterior (${fmt(prevArrival)})`)}
            }
            prev=r
        })
        return {errors,warnings}
    }





// import {useState, useEffect,useMemo,useRef} from 'react';
// import { CheckCircle2,AlertCircle,AlertTriangle,ScanLine,CarFront,ClipboardList, Plus,Trash2,Loader2} from 'lucide-react';
// import { supabase } from '../supabaseClient';
// import './addVehicle.css'
// import './addFuel.css'
// import './addDailyLog.css'
// import {emptyRow,isBlankRow,nextRow,recordsToRows,rowsToPayload,validateRows} from '../utils/dailyHelpers';

// const TEMPLATE_SLUG='registro_diario'
// const SCAN_BUCKET='scans'
// const SCAN_TYPES=['image/png','image/jpeg','image/jpg','image/webp','application/pdf']
// const SCAN_MAX_MB=10

// export default function AddDailyLog({onDone, initialVehicleId=''}){
//     const [vehicles, setVehicles] = useState([])
//     const [departments, setDepartments] = useState([])
//     const [templateId, setTemplateId] = useState(null)
//     const [vehicleId, setVehicleId] = useState(String(initialVehicleId))
//     const [rows, setRows] = useState([emptyRow()])
//     const [submitted, setSubmitted] = useState(false)
//     const [confirmWarning, setConfirmWarning] = useState(false)
//     const [status,setStatus] = useState({type:'idle',text:''})
//     const [scanning, setScanning] = useState(false)
//     const [scanId, setScanId] = useState(null)
//     const [preview, setPreview] = useState(null)
//     const [scanNotice, setScanNotice] = useState({type:'idle',text:''})
//     const fileInputRef = useRef(null)

//     async function load(){
//         const [v,d,t]= await Promise.all([
//             supabase.from('vehicles').select('id,license_plate,manufacturer,model,total_mileage,departments(name)').order('license_plate'),
//             supabase.from('departments').select('id,name').order('name'),
//             supabase.from('document_templates').select('id').eq('slug',TEMPLATE_SLUG).single()
//         ])
//         if (v.error) console.error('Error loading vehicles',v.error)
//             setVehicles(v.data||[])
//         setDepartments(d.data||[])
//         setTemplateId(t.data?.id||null)
// }
//     useEffect(()=>{load()},[])

//     const vehicle=vehicles.find(v=>String(v.id)===vehicleId)
//     const {errors,warnings}=useMemo(()=>validateRows(rows,vehicle),[rows,vehicle])
//     const tripCount=rows.filter(r=>!isBlankRow(r)).length

//     function resetFeedback(){
//         setConfirmWarning(false)
//         if(status.type!=='idle') setStatus({type:'idle',text:''})
//     }

//     function updateRow(i,key,value){
//         setRows(rs=>rs.map((r,j)=>j!==i ? r: {...r,[key]:value,
//             ai: r.ai.filter(k=>k!==key),
//             doubtful: r.doubtful.filter(k=>k!==key)
//         }))
//         resetFeedback()
//     }

//     function chooseDepartment(i,id){
//         const dept=departments.find(d=>String(d.id)===id)
//         setRows(rs=>rs.map((r,j)=>j!==i ? r: {
//             ...r,
//             user_department_id:id,
//             user_department: dept?.name||'',
//             ai: r.ai.filter(k=> k !== 'user_department_id'),
//             doubtful: r.doubtful.filter(k=> k !== 'user_department_id')
//         }))
//         resetFeedback()
// }

// function addRow(){
//     setRows(rs=>[...rs,nextRow(rs[rs.length-1])])
//     resetFeedback()
// }

// function removeRow(i){
//     setRows(rs=>rs.length===1?[emptyRow()]:rs.filter((_,j)=>j!==i))
//     resetFeedback()
// }

// async function scanSheet(file){
//     if(!file) return
//     if(!SCAN_TYPES.includes(file.type)){
//         setScanNotice({type:'error',text:`Formato de archivo no soportado. Solo se permiten: ${SCAN_TYPES.join(', ')}`})
//         return
//     }
//     if(file.size>SCAN_MAX_MB*1024*1024){
//         setScanNotice({type:'error',text:`Archivo demasiado grande. Tamaño máximo permitido: ${SCAN_MAX_MB} MB`})
//         return
//     }
//     setScanning(true)
//     setStatus({type: 'idle', text: ''})
//     if(file.type.startsWith('image/')) setPreview(URL.createObjectURL(file))
    
//         try{
//             const ext=file.name.split('.').pop().toLowerCase()
//             const filePath=`registro_diario/${Date.now()}.${ext}`

//             const {error:uploadError}=await supabase.storage.from(SCAN_BUCKET).upload(filePath,file)
//             if(uploadError) throw uploadError

//             const {data:scanData,error:scanError}=await supabase.from('document_scans').insert({file_path:filePath
//                 ,template_id:templateId,vehicle_id:vehicle?vehicle.id:null
//             }).select('id').single()
//             if(scanError) throw scanError

//             const {data, error:fnError}=await supabase.functions.invoke('procesar-documento', {body:{
//                 scan_id:scanData.id} })
//                 if(fnError) throw new Error(fnError.message)
//                 if(data?.error) throw new Error(data.error)
                
//                 const records=data?.records||[]
//                 if(!records.length) throw new Error('No se encontraron registros en el documento escaneado' )
//                 const columns=data.columns ?? data.template?.columns ?? []
//                 applyAiRecords(records,columns)
//                 setScanId(scanData.id)
//             } catch(err){
//                 setScanNotice({type:'error',text:`Error al procesar el documento: ${err.message}`})
//             } finally{
//                 setScanning(false)
//                 if(fileInputRef.current) fileInputRef.current.value=''
//             }
//         }

//         function applyAiRecords(records,columns){
//             const newRows=recordsToRows(records,columns,departments)
//             setRows(rs=>rs.every(isBlankRow) ? newRows : [...rs.filter(r=>!isBlankRow(r)),...newRows])
//             setConfirmWarning(false)
//             setScanNotice({
//                 type:'ok',
//                 text:`Se han agregado ${records.length} registros desde el documento escaneado.`})
//             }

//         async function handleSubmit(e){
//             e.preventDefault()
//             setSubmitted(true)
            
//             if(!vehicle){
//                 setStatus({type:'error',text:'Debe seleccionar un vehículo antes de enviar el registro diario.'});
//                 return
//             }
//             const toSave=rows.filter(r=>!isBlankRow(r))
//             if(!toSave.length){
//                 setStatus({type:'error',text:'No hay registros para guardar.'})
//                 return
//             }
//             if(Object.keys(errors).length){
//                 setStatus({type:'error',text:'Existen errores en los registros. Corríjalos antes de enviar.'})
//                 return
//             }
//             if(warnings.length && !confirmWarning){
//                 setConfirmWarning(true)
//                 setStatus({type:'warning',text:'Existen advertencias en los registros. Confirme para continuar.'})
//                 return
//             }

//             setStatus({type:'saving',text:''})
//             const payload=rowsToPayload(toSave,vehicle.id,scanId)

//             const{error}=await supabase.from('daily_register').insert(payload)
//             if(error){
//                let text=`Error al guardar el registro diario: ${error.message}`
//                if(error.code==='23505') text='Ya existe un registro diario para este vehículo en la fecha indicada.'
//                setStatus({type:'error',text})
//                return
//             } 
//             if(scanId){
//                 await supabase.from('document_scans').update({vehicle_id:vehicle.id}).eq('id',scanId)
//             }
//             setStatus({type:'success',text:'Registro diario guardado correctamente.'})
//             resetForm()
//             load()
//         }

//         function resetForm(){
//         setRows([emptyRow()])
//         setSubmitted(false)
//         setConfirmWarning(false)
//         setScanId(null)
//         setPreview(null)
//         setScanNotice({type:'idle',text:''})
//     }
//         function handleClear(){
//             resetForm()
//             setVehicleId(String(initialVehicleId))
//             setStatus({type:'idle',text:''})
//         }

//         function scanNext(){
//             setStatus({type:'idle',text:''})
//             setVehicleId(String(initialVehicleId))
//             fileInputRef.current?.click()
//         }
//         const saving=status.type==='saving'
//         const busy=scanning || saving

//         const cellClass=(rowIndex,key)=>{
//             const row=rows[rowIndex]
//             const c=['dl-cell']
//             if(submitted && errors[rowIndex]?.[key]) c.push('has-error')
//             else if(row.doubtful.includes(key)) c.push('af-doubtful')
//             else if(row.ai.includes(key)) c.push('af-ai')
//             return c.join(' ')
//         }

//         return(
//             <div className="av">
//                 <div className="av-heading">
//                     <div>
//                         <h1>Registro Diario</h1>
//                         <p>Registro Diario de Movimiento de Vehículos</p>
//                     </div>
//                     {onDone && (
//                         <button type="button" className="av-btn av-btn-secondary" onClick={onDone}>Volver al inicio</button>
//                     )}
//                 </div>

//                 <form className="af-form" onSubmit={handleSubmit} noValidate>
//                     <div className="av-card af-scan">
//                         <span className="af-scan-icon"><ScanLine size={26}/></span>
//                         <div className="af-scan-text">
//                             <strong>¿Tiene la hoja en el papel?</strong>
//                             <p>Escáneala y el asistente llenará los viajes.</p>
//                             </div>
//                             <button type="button" className="av-btn av-btn-primary" onClick={()=>fileInputRef.current?.click()} disabled={busy}>
//                                 {scanning ? <><Loader2 size={16} className="av-spin"/> Escaneando...</> : <><ScanLine size={16}/>
//                                 Escanear hoja</>}
//                             </button>
//                             <input type="file" accept={SCAN_TYPES.join(',')} capture="environment"ref={fileInputRef} style={{display:'none'}} onChange={e=>scanSheet(e.target.files[0])}/>
//                             </div>
//                             {scanNotice.type==='error' && <div className="av-alert av-alert-error"><AlertCircle size={16}/> {scanNotice.text}</div>}
//                             {scanNotice.type==='ok' && <div className="av-alert av-alert-ok"><CheckCircle2 size={16}/> {scanNotice.text}</div>}

//                             <section className="av-card">
//                                 <h2 className="av-card-title"><CarFront size={20}/> Información del vehículo</h2>
//                                 <div className="av-field">
//                                     <label htmlFor="vehicle_id">Tablilla de la hoja</label>
//                                     <select id="vehicle_id" value={vehicleId} onChange={e=>{setVehicleId(e.target.value); resetFeedback()}} disabled={busy}>
//                                         <option value="">Seleccione un vehículo</option>
//                                         {vehicles.map(v=>(
//                                             <option key={v.id} value={v.id}>{v.license_plate} - {v.manufacturer} {v.model}</option>
//                                         ))}
//                                     </select>
//                                 </div>
//                                 {vehicle && (
//                                     <p>
//                                         Fabricante: {vehicle.manufacturer} | Modelo: {vehicle.model} | Ultimo millaje: {vehicle.total_mileage != null ? Number(vehicle.total_mileage).toLocaleString('en-US') : 'Sin registro'} millas | Departamento: {vehicle.departments?.name || 'N/A'}

//                                     </p>
//                                 )}
//                                 {preview && (
//                                     <details className="dl-preview" open>
//                                         <summary> Foto de la hoja: verifica que la tablilla coincida</summary>
//                                         <img src={preview} alt="Hoja de registro diario escaneada" />
//                                         </details>
//                                 )}
//                             </section>

//                             <section className="av-card">
//                                 <h2 className="av-card-title"><ClipboardList size={20}/> Viajes ({tripCount})</h2>
//                                 {rows.some(r=>r.ai.length) && (
//                                     <p className="af-legend">
//                                         <span><i className="af-swatch af-swatch-ai" />Llenado con AI</span>
//                                         {rows.some(r=>r.doubtful.length) && <span><i className="af-swatch af-swatch-doubt" /><AlertCircle size={16}/> Duda de AI</span>}
//                                     </p>
//                                 )}

//                                 <div className="dl-table-wrap">
//                                     <table className="dl-table">
//                                         <thead>
//                                             <tr>
//                                                 <th>#</th><th>Fecha</th><th>Nombre</th><th>Depto. que usa</th><th>Lugar/Proposito</th>
//                                                 <th>Salida</th><th>Millaje salida</th><th>Regreso</th><th>Millaje regreso</th><th>Firma</th><th></th>
//                                                 </tr>
//                                             </thead>
//                                         <tbody>
//                                             {rows.map((r,i)=>(
//                                                 <tr key={r.key}>
//                                                     <td className="dl-n" data-label="Viaje">{i+1}</td>
//                                                     <td className={cellClass(i,'departure_date')} data-label="Fecha">
//                                                         <input type="date" aria-label={`Fecha, fila ${i+1}`} value={r.departure_date} onChange={e=>updateRow(i,'departure_date',e.target.value)}/>
//                                                         </td>
//                                                 <td  className={cellClass(i,'driver_name')} data-label="Nombre">
//                                                     <input type="text" aria-label={`Nombre del conductor, fila ${i+1}`} value={r.driver_name} onChange={e=>updateRow(i,'driver_name',e.target.value)}/>
//                                                 </td>

//                                                 <td className={cellClass(i,'user_department_id')} data-label="Depto. que usa">
//                                                     <select aria-label={`Departamento que usa, fila ${i+1}`} value={r.user_department_id} onChange={e=>chooseDepartment(i,e.target.value)}>
//                                                         <option value="">Seleccione un departamento</option>
//                                                         {departments.map(d=>(
//                                                             <option key={d.id} value={d.id}>{d.name}</option>
//                                                         ))}
//                                                     </select>
//                                                 </td>
//                                                 <td className={cellClass(i,'destination')} data-label="Lugar/Proposito">
//                                                     <input type="text" aria-label={`Lugar o propósito del viaje, fila ${i+1}`} value={r.destination} onChange={e=>updateRow(i,'destination',e.target.value)}/>
//                                                 </td>
//                                                 <td className={cellClass(i,'departure_time')} data-label="Salida">
//                                                     <input type="time" aria-label={`Hora de salida, fila ${i+1}`} value={r.departure_time} onChange={e=>updateRow(i,'departure_time',e.target.value)}/>
//                                                 </td>
//                                                 <td className={cellClass(i,'departure_mileage')} data-label="Millaje salida">
//                                                     <input type="number" inputMode="numeric" min="0" aria-label={`Millaje de salida, fila ${i+1}`} value={r.departure_mileage} onChange={e=>updateRow(i,'departure_mileage',e.target.value)}/>
//                                                 </td>
//                                                 <td className={cellClass(i,'arrival_time')} data-label="Regreso">
//                                                     <input type="time" aria-label={`Hora de regreso, fila ${i+1}`} value={r.arrival_time} onChange={e=>updateRow(i,'arrival_time',e.target.value)}/>
//                                                 </td>
//                                                 <td className={cellClass(i,'arrival_mileage')} data-label="Millaje regreso">
//                                                     <input type="number" inputMode="numeric" min="0" aria-label={`Millaje de regreso, fila ${i+1}`} value={r.arrival_mileage} onChange={e=>updateRow(i,'arrival_mileage',e.target.value)}/>
//                                                 </td>
//                                                 <td className={cellClass(i,'has_signature')} data-label="Firma">
//                                                     <input type="checkbox" aria-label={`Firma, fila ${i+1}`} checked={r.has_signature} onChange={e=>updateRow(i,'has_signature',e.target.checked)}/>
//                                                 </td>
//                                                 <td className="dl-actions-cell">
//                                                     <button type="button" className="dl-remove" onClick={()=>removeRow(i)} aria-label={`Eliminar viaje ${i+1}`} disabled={busy}><Trash2 size={16}/></button>
//                                                 </td>
//                                             </tr>
//                                         ))}
//                                     </tbody>
//                                 </table>
//                             </div>
//                             <button type="button" className="av-btn av-btn-secondary dl-add" onClick={addRow} disabled={busy}
//                             ><Plus size={16}/> Agregar viaje
//                             </button>
                        
//                         {warnings.length>0 && tripCount > 0 && (
//                             <div className="av-alert af-alert-warning dl-warnings" role="status">
//                                 <AlertTriangle size={16}/>
//                                 <ul>
//                                     {warnings.map((w,k)=>(
//                                         <li key={k}>{w}</li>
//                                     ))}
//                                 </ul>
//                             </div>
//                         )}

//                         {status.type==='error' && (
//                             <div className="av-alert av-alert-error"><AlertCircle size={16}/>{status.text}</div>
//                         )}

//                         {status.type==='warning' && (
//                             <div className="av-alert af-alert-warning"><AlertTriangle size={16}/>{status.text}</div>
//                         )}

//                         {status.type==='success' && (
//                             <div className="av-alert av-alert-ok dl-success"><CheckCircle2 size={16}/>{status.text}
//                             <button type="button" className="av-btn av-btn-primary" onClick={scanNext}><ScanLine size={16}/> Escanear siguiente hoja </button>
//                             </button>
//                             </div>
//                         )}

//                         <div className="av-actions">
//                             <button type="submit" className="av-btn av-btn-primary" disabled={busy}>
//                                 {saving ? 'Guardando...' : confirmWarning ? 'Guardar de todas formas' : `Guardar registro diario (${tripCount} viajes)`}</button>
//                             <button type="button" className="av-btn av-btn-secondary" onClick={handleClear} disabled={saving}>Limpiar formulario</button>
//                         </div>
//                     </section>
//                 </form>
//             </div>
//         )
//     }



                            

