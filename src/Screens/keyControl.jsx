import {useState, useEffect,useMemo,useRef} from 'react';
import { CheckCircle2,AlertCircle,AlertTriangle,ScanLine,CarFront,ClipboardList, Plus,Trash2,Loader2} from 'lucide-react';
import { supabase } from '../supabaseClient';
import './addVehicle.css'
import './addFuel.css'
import './addDailyLog.css'
import {emptyRow,isBlankRow,nextRow,recordsToRows,rowsToPayload,validateRows} from '../utils/keyHelpers';

const TEMPLATE_SLUG='control_llaves'
const SCAN_BUCKET='scans'
const SCAN_TYPES=['image/png','image/jpeg','image/jpg','image/webp','application/pdf']
const SCAN_MAX_MB=10

export default function KeyControl({onDone, initialVehicleId=''}){
    const [vehicles, setVehicles] = useState([])
    const [departments, setDepartments] = useState([])
    const [templateId, setTemplateId] = useState(null)
    const [vehicleId, setVehicleId] = useState(String(initialVehicleId))
    const [rows, setRows] = useState([emptyRow()])
    const [submitted, setSubmitted] = useState(false)
    const [confirmWarning, setConfirmWarning] = useState(false)
    const [status,setStatus] = useState({type:'idle',text:''})
    const [scanning, setScanning] = useState(false)
    const [scanId, setScanId] = useState(null)
    const [preview, setPreview] = useState(null)
    const [scanNotice, setScanNotice] = useState({type:'idle',text:''})
    const fileInputRef = useRef(null)

    async function load(){
        const [v,d,t]= await Promise.all([
            supabase.from('vehicles').select('id,license_plate,manufacturer,model,total_mileage,department_id,departments(id,name)').order('license_plate'),
            supabase.from('departments').select('id,name').order('name'),
            supabase.from('document_templates').select('id').eq('slug',TEMPLATE_SLUG).single()
        ])
        if (v.error) console.error('Error loading vehicles',v.error)
            setVehicles(v.data||[])
        setDepartments(d.data||[])
        setTemplateId(t.data?.id||null)
}
    useEffect(()=>{load()},[])

    const vehicle=vehicles.find(v=>String(v.id)===vehicleId)
    const {errors,warnings}=useMemo(()=>validateRows(rows,vehicle),[rows,vehicle])
    const tripCount=rows.filter(r=>!isBlankRow(r)).length

    function resetFeedback(){
        setConfirmWarning(false)
        if(status.type!=='idle') setStatus({type:'idle',text:''})
    }

    function updateRow(i,key,value){
        setRows(rs=>rs.map((r,j)=>j!==i ? r: {...r,[key]:value,
            ai: r.ai.filter(k=>k!==key),
            doubtful: r.doubtful.filter(k=>k!==key)
        }))
        resetFeedback()
    }

    function chooseDepartment(i,id){
        const dept=departments.find(d=>String(d.id)===id)
        setRows(rs=>rs.map((r,j)=>j!==i ? r: {
            ...r,
            user_department_id:id,
            user_department: dept?.name||'',
            ai: r.ai.filter(k=> k !== 'user_department_id'),
            doubtful: r.doubtful.filter(k=> k !== 'user_department_id')
        }))
        resetFeedback()
}

function addRow(){
    setRows(rs=>[...rs,nextRow(rs[rs.length-1])])
    resetFeedback()
}

function removeRow(i){
    setRows(rs=>rs.length===1?[emptyRow()]:rs.filter((_,j)=>j!==i))
    resetFeedback()
}

async function scanSheet(file){
    if(!file) return
    if(!SCAN_TYPES.includes(file.type)){
        setScanNotice({type:'error',text:`Formato de archivo no soportado. Solo se permiten: ${SCAN_TYPES.join(', ')}`})
        return
    }
    if(file.size>SCAN_MAX_MB*1024*1024){
        setScanNotice({type:'error',text:`Archivo demasiado grande. Tamaño máximo permitido: ${SCAN_MAX_MB} MB`})
        return
    }
    setScanning(true)
    setStatus({type: 'idle', text: ''})
    if(file.type.startsWith('image/')) setPreview(URL.createObjectURL(file))
    
        try{
            const ext=file.name.split('.').pop().toLowerCase()
            const filePath=`control_llaves/${Date.now()}.${ext}`

            const {error:uploadError}=await supabase.storage.from(SCAN_BUCKET).upload(filePath,file)
            if(uploadError) throw uploadError

            const {data:scanData,error:scanError}=await supabase.from('document_scans').insert({file_path:filePath
                ,template_id:templateId,vehicle_id:vehicle?vehicle.id:null
            }).select('id').single()
            if(scanError) throw scanError

            const {data, error:fnError}=await supabase.functions.invoke('procesar-documento', {body:{
                scan_id:scanData.id} })
                if(fnError) throw new Error(fnError.message)
                if(data?.error) throw new Error(data.error)
                
                const records=data?.records||[]
                if(!records.length) throw new Error('No se encontraron registros en el documento escaneado' )
                const columns=data.columns ?? data.template?.columns ?? []
                applyAiRecords(records,columns)
                setScanId(scanData.id)
            } catch(err){
                setScanNotice({type:'error',text:`Error al procesar el documento: ${err.message}`})
            } finally{
                setScanning(false)
                if(fileInputRef.current) fileInputRef.current.value=''
            }
        }

        function applyAiRecords(records,columns){
            const newRows=recordsToRows(records,columns,departments)
            setRows(rs=>rs.every(isBlankRow) ? newRows : [...rs.filter(r=>!isBlankRow(r)),...newRows])
            setConfirmWarning(false)
            setScanNotice({
                type:'ok',
                text:`Se han agregado ${records.length} registros desde el documento escaneado.`})
            }

        async function handleSubmit(e){
            e.preventDefault()
            setSubmitted(true)
            
            if(!vehicle){
                setStatus({type:'error',text:'Debe seleccionar un vehículo antes de enviar el registro diario.'});
                return
            }
            const toSave=rows.filter(r=>!isBlankRow(r))
            if(!toSave.length){
                setStatus({type:'error',text:'No hay registros para guardar.'})
                return
            }
            if(Object.keys(errors).length){
                setStatus({type:'error',text:'Existen errores en los registros. Corríjalos antes de enviar.'})
                return
            }
            if(warnings.length && !confirmWarning){
                setConfirmWarning(true)
                setStatus({type:'warning',text:'Existen advertencias en los registros. Confirme para continuar.'})
                return
            }

            setStatus({type:'saving',text:''})
            const payload=rowsToPayload(toSave,vehicle.id,scanId)

            const{error}=await supabase.from('key_register').insert(payload)
            if(error){
               let text=`Error al guardar el registro diario: ${error.message}`
               if(error.code==='23505') text='Uno de los préstamos ya existe en la base de datos. Verifique que no haya duplicados.'
               if(error.code==='23P01') text='Uno de los préstamos tiene un valor inválido. Verifique que las fechas y horas sean correctas.'
               setStatus({type:'error',text})
               return
            } 
            if(scanId){
                await supabase.from('document_scans').update({vehicle_id:vehicle.id}).eq('id',scanId)
            }
            setStatus({type:'success',text:'Registro diario guardado correctamente.'})
            resetForm()
            load()
        }

        function resetForm(){
        setRows([emptyRow()])
        setSubmitted(false)
        setConfirmWarning(false)
        setScanId(null)
        setPreview(null)
        setScanNotice({type:'idle',text:''})
    }
        function handleClear(){
            resetForm()
            setVehicleId(String(initialVehicleId))
            setStatus({type:'idle',text:''})
        }

        function scanNext(){
            setStatus({type:'idle',text:''})
            setVehicleId(String(initialVehicleId))
            fileInputRef.current?.click()
        }
        const saving=status.type==='saving'
        const busy=scanning || saving

        const cellClass=(rowIndex,key)=>{
            const row=rows[rowIndex]
            const c=['dl-cell']
            if(submitted && errors[rowIndex]?.[key]) c.push('has-error')
            else if(row.doubtful.includes(key)) c.push('af-doubtful')
            else if(row.ai.includes(key)) c.push('af-ai')
            return c.join(' ')
        }

        return(
            <div className="av">
                <div className="av-heading">
                    <div>
                        <h1>Control de llaves</h1>
                        <p>Control de Llave del Uso de Vehículo Oficial</p>
                    </div>
                    {onDone && (
                        <button type="button" className="av-btn av-btn-secondary" onClick={onDone}>Volver al inicio</button>
                    )}
                </div>

                <form className="af-form" onSubmit={handleSubmit} noValidate>
                    <div className="av-card af-scan">
                        <span className="af-scan-icon"><ScanLine size={26}/></span>
                        <div className="af-scan-text">
                            <strong>¿Tiene la hoja de control de llaves</strong>
                            <p>Escáneala y el asistente llenará los préstamos.</p>
                            </div>
                            <button type="button" className="av-btn av-btn-primary" onClick={()=>fileInputRef.current?.click()} disabled={busy}>
                                {scanning ? <><Loader2 size={16} className="av-spin"/> Escaneando...</> : <><ScanLine size={16}/>
                                Escanear hoja</>}
                            </button>
                            <input type="file" accept={SCAN_TYPES.join(',')} capture="environment" ref={fileInputRef} style={{display:'none'}} onChange={e=>scanSheet(e.target.files[0])}/>
                            </div>
                            {scanNotice.type==='error' && <div className="av-alert av-alert-error"><AlertCircle size={16}/> {scanNotice.text}</div>}
                            {scanNotice.type==='ok' && <div className="av-alert av-alert-ok"><CheckCircle2 size={16}/> {scanNotice.text}</div>}

                            <section className="av-card">
                                <h2 className="av-card-title"><CarFront size={20}/> Información del vehículo</h2>
                                <div className="av-field">
                                    <label htmlFor="vehicle_id">Tablilla de la hoja</label>
                                    <select id="vehicle_id" value={vehicleId} onChange={e=>{setVehicleId(e.target.value); resetFeedback()}} disabled={busy}>
                                        <option value="">Seleccione un vehículo</option>
                                        {vehicles.map(v=>(
                                            <option key={v.id} value={v.id}>{v.license_plate} - {v.manufacturer} {v.model}</option>
                                        ))}
                                    </select>
                                </div>
                                {vehicle && (
                                    <p>
                                        Fabricante: {vehicle.manufacturer} | Modelo: {vehicle.model} | Ultimo millaje: {vehicle.total_mileage != null ? Number(vehicle.total_mileage).toLocaleString('en-US') : 'Sin registro'} millas | Departamento: {vehicle.departments?.name || 'N/A'}

                                    </p>
                                )}
                                {preview && (
                                    <details className="dl-preview" open>
                                        <summary> Foto de la hoja: verifica que la tablilla coincida</summary>
                                        <img src={preview} alt="Hoja de control de llaves escaneada" />
                                        </details>
                                )}
                            </section>

                            <section className="av-card">
                                <h2 className="av-card-title"><ClipboardList size={20}/> Préstamos ({tripCount})</h2>
                                {rows.some(r=>r.ai.length) && (
                                    <p className="af-legend">
                                        <span><i className="af-swatch af-swatch-ai" />Llenado con AI</span>
                                        {rows.some(r=>r.doubtful.length) && <span><i className="af-swatch af-swatch-doubt" /><AlertCircle size={16}/> Duda de AI</span>}
                                    </p>
                                )}

                                <div className="dl-table-wrap">
                                    <table className="dl-table">
                                        <thead>
                                            <tr>
                                                <th>#</th><th>Nombre</th><th>Licencia</th><th>Oficina</th><th>Acompañante</th>
                                                <th>Lugar/Proposito</th><th>Entrega</th><th>Hora</th><th>Devolución</th><th>Hora</th><th>Firma</th><th></th>
                                                </tr>
                                            </thead>
                                        <tbody>
                                            {rows.map((r,i)=>(
                                                <tr key={r.key}>
                                                    <td className="dl-n" data-label="Préstamo">{i+1}</td>
                                                    <td className={cellClass(i,'driver_name')} data-label="Nombre">
                                                        <input type="text" aria-label={`Nombre, fila ${i+1}`} value={r.driver_name} onChange={e=>updateRow(i,'driver_name',e.target.value)}/>
                                                        </td>
                                                <td  className={cellClass(i,'driver_license_num')} data-label="Licencia">
                                                    <input type="text" aria-label={`Número de licencia, fila ${i+1}`} value={r.driver_license_num} onChange={e=>updateRow(i,'driver_license_num',e.target.value)}/>
                                                </td>

                                                <td className={cellClass(i,'user_department_id')} data-label="Depto. que usa">
                                                    <select aria-label={`Departamento que usa, fila ${i+1}`} value={r.user_department_id} onChange={e=>chooseDepartment(i,e.target.value)}>
                                                        <option value="">Seleccione un departamento</option>
                                                        {departments.map(d=>(
                                                            <option key={d.id} value={d.id}>{d.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className={cellClass(i,'passenger_name')} data-label="Acompañante">
                                                    <input type="text" aria-label={`Nombre del acompañante, fila ${i+1}`} value={r.passenger_name} onChange={e=>updateRow(i,'passenger_name',e.target.value)}/>
                                                </td>
                                                <td className={cellClass(i,'destination')} data-label="Lugar/Proposito">
                                                    <input type="text" aria-label={`Lugar o propósito del viaje, fila ${i+1}`} value={r.destination} onChange={e=>updateRow(i,'destination',e.target.value)}/>
                                                </td>
                                                <td className={cellClass(i,'pickup_date')} data-label="Entrega">
                                                    <input type="date" aria-label={`Fecha de entrega, fila ${i+1}`} value={r.pickup_date} onChange={e=>updateRow(i,'pickup_date',e.target.value)}/>
                                                </td>
                                                <td className={cellClass(i,'pickup_time')} data-label="Hora entrega">
                                                    <input type="time" aria-label={`Hora de entrega, fila ${i+1}`} value={r.pickup_time} onChange={e=>updateRow(i,'pickup_time',e.target.value)}/>
                                                </td>
                                                <td className={cellClass(i,'return_date')} data-label="Devolución">
                                                    <input type="date" aria-label={`Fecha de regreso, fila ${i+1}`} value={r.return_date} onChange={e=>updateRow(i,'return_date',e.target.value)}/>
                                                </td>
                                                <td className={cellClass(i,'return_time')} data-label="Hora devolución">
                                                    <input type="time" aria-label={`Hora de devolución, fila ${i+1}`} value={r.return_time} onChange={e=>updateRow(i,'return_time',e.target.value)}/>
                                                </td>
                                                <td className={cellClass(i,'has_signature')} data-label="Firma">
                                                    <input type="checkbox" aria-label={`Firma, fila ${i+1}`} checked={r.has_signature} onChange={e=>updateRow(i,'has_signature',e.target.checked)}/>
                                                </td>
                                                <td className="dl-actions-cell">
                                                    <button type="button" className="dl-remove" onClick={()=>removeRow(i)} aria-label={`Eliminar préstamo ${i+1}`} disabled={busy}><Trash2 size={16}/></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <button type="button" className="av-btn av-btn-secondary dl-add" onClick={addRow} disabled={busy}
                            ><Plus size={16}/> Agregar préstamo
                            </button>
                        
                        {warnings.length>0 && tripCount > 0 && (
                            <div className="av-alert af-alert-warning dl-warnings" role="status">
                                <AlertTriangle size={16}/>
                                <ul>
                                    {warnings.map((w,k)=>(
                                        <li key={k}>{w}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {status.type==='error' && (
                            <div className="av-alert av-alert-error"><AlertCircle size={16}/>{status.text}</div>
                        )}

                        {status.type==='warning' && (
                            <div className="av-alert af-alert-warning"><AlertTriangle size={16}/>{status.text}</div>
                        )}

                        {status.type==='success' && (
                            <div className="av-alert av-alert-ok dl-success"><CheckCircle2 size={16}/>{status.text}
                            <button type="button" className="av-btn av-btn-primary" onClick={scanNext}><ScanLine size={16}/> Escanear siguiente hoja </button>
                            </div>
                        )}

                        <div className="av-actions">
                            <button type="submit" className="av-btn av-btn-primary" disabled={busy}>
                                {saving ? 'Guardando...' : confirmWarning ? 'Guardar de todas formas' : `Guardar (${tripCount} préstamos)`}</button>
                            <button type="button" className="av-btn av-btn-secondary" onClick={handleClear} disabled={saving}>Limpiar formulario</button>
                        </div>
                    </section>
                </form>
            </div>
        )
    }



                            

