import {useState,useEffect,useMemo,useRef } from "react";
import {CheckCircle2, AlertCircle,AlertTriangle,ScanLine,FileText,CarFront,UserCheck,Fuel,Loader2} from 'lucide-react'
import { supabase } from "../supabaseClient";
import './addVehicle.css'
import './addFuel.css'

const emptyForm = {
vehicle_id: '',
fuel_type: '',
control_number: '',
dispatch_date: '',
requesting_department: '',
amount_requested: '',
requester_name: '',
requester_license: '',
mileage:'',
container_gallons:'',
container_equipment:'',
authorized_by:'',
authorized_signature:false,
amount_dispatched:'',
liters:'',
employee_name:'',
employee_license:'',
employee_signature:false,
supplier_name:'',
supplier_signature:false
}

const NO_VEHICLE='none'
const TEMPLATE_SLUG='despacho_combustible'
const SCAN_BUCKET='scans'
const SCAN_TYPES=['image/jpeg','image/png','image/webp','application/pdf']
const SCAN_MAX_MB=10

function toNumber(value){
    return value==='' ? null:Number(value)
}

function toText(value){
    return value.trim()||null
}

function normalizePlate(plate){
    return (plate||'').toUpperCase().replace(/[^A-Z0-9]/g,'')
}

function toIsoDate(text){
    const match=String(text||'').replace(/\s/g,'').match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
    if(!match) return ''
    let [,month,day,year]=match
    if(year.length===2) year='20'+year
    if(Number(month)<1 || Number(month)>12 || Number(day)<1 || Number(day)>31) return ''
    return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`
}

function aiValueToForm(value,dataType,field){
    if(value==null||value===''||value===undefined) return null
    if(dataType==='date') return toIsoDate(value)||null
    if(dataType==='boolean') return value===true
    if(field==='fuel_type'){
        const fuel=String(value||'').toLowerCase()
        if(fuel.includes('gasolina')) return 'gasolina'
        if(fuel.includes('diesel')) return 'diesel'
        return null
    }
    return String(value||'').trim()
}

function isEmpty(value){
    return value==='' || value===false || value===null
}


// function photoUrl(path){
//     if (!path) return null;
//     return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;   
// }

export default function AddFuel({onDone}){
    const [departments,setDepartments]=useState([])
    const [vehicles,setVehicles]=useState([])
    const [templateId,setTemplateId]=useState(null);
   // const [recent,setRecent]=useState([])
    const [form,setForm]=useState(emptyForm)
    const [touched,setTouched]=useState({})
    const [status,setStatus]=useState({type:'idle',text:''})
    const [scanning,setScanning]=useState(false)
    const [scanId,setScanId]=useState(null)
    const [scanPlate,setScanPlate]=useState('')
    const [aiFields,setAiFields]=useState([])
    const [doubtfulFields,setDoubtfulFields]=useState([])
    const [scanNotice,setScanNotice]=useState({type:'idle',text:''})
    const fileInputRef=useRef(null)
    

    async function load(){
        const [v,d,t]=await Promise.all([
            supabase.from('vehicles').select('id,license_plate,manufacturer,model,departments(name)').order('license_plate'),
            supabase.from('departments').select('id,name').order('name'),
            supabase.from('document_templates').select('id').eq('slug',TEMPLATE_SLUG).single()
            
        ])
        if(v.error) console.error('Error loading vehicles:',v.error)
        setVehicles(v.data||[])
        setDepartments(d.data||[])
        setTemplateId(t.data?.id??null)
        
    }

    useEffect(()=>{
        load()
    },[])
    
    const selectedVehicle=vehicles.find(v=>String(v.id)===form.vehicle_id)
    const isContainer=form.vehicle_id===NO_VEHICLE
    
        const errors=useMemo(()=>{
            const errs={}
            if(!form.vehicle_id) errs.vehicle_id= "Seleccione un vehículo o contenedor"
           if(!form.fuel_type) errs.fuel_type= "Seleccione un tipo de combustible"
              if(!form.control_number) errs.control_number= "Ingrese un número de control"
              if(!form.dispatch_date) errs.dispatch_date= "Ingrese una fecha de despacho"
              if(!form.requester_name.trim()) errs.requester_name= "Ingrese el nombre del solicitante"
            if(isContainer&&!form.container_gallons) errs.container_gallons= "Ingrese la cantidad de galones"
            return errs
        },[form,isContainer])
        const isValid=Object.keys(errors).length===0

        const set=(key)=>(errs)=>{
            const value=errs.target.type==='checkbox' ? errs.target.checked : errs.target.value
            setForm(f=>({...f,[key]:value}))
            setAiFields(list=>list.filter(k=>k!==key))
            setDoubtfulFields(list=>list.filter(k=>k!==key))
            if(status.type!=='idle') setStatus({type:'idle',text:''})
        }
        const blur=(key)=>()=>{setTouched(t=>({...t,[key]:true}))}
        function chooseVehicle(e){
            const vehicleId=e.target.value
            const vehicle=vehicles.find(v=>String(v.id)===vehicleId)
            setForm(f=>({...f,vehicle_id:vehicleId,
                requesting_department:f.requesting_department||vehicle?.departments?.name||''}))
            
            setAiFields(list=>list.filter(k=>k!=='vehicle_id'))
        }

        async function scanTicket(file){
            if(!file) return
            if(!SCAN_TYPES.includes(file.type)){
                setScanNotice({type:'error',text:`Tipo de archivo no soportado. Solo se permiten: ${SCAN_TYPES.join(', ')}`})
                return
            }
            if(file.size>SCAN_MAX_MB*1024*1024){
                setScanNotice({type:'error',text:`El archivo excede el tamaño máximo de ${SCAN_MAX_MB} MB`})
                return
            }

            setScanning(true)
            setStatus({type:'idle',text:''})

            try{
                const ext=file.name.split('.').pop().toLowerCase()
                const filePath=`combustible/${Date.now()}.${ext}`

                const {error:uploadError}=await supabase.storage.from(SCAN_BUCKET).upload(filePath,file)
                if(uploadError) throw uploadError

                const {data:scanData,error:scanError}=await supabase.from('document_scans').insert({
                    file_path:filePath,
                    template_id:templateId,
                    vehicle_id:selectedVehicle ? selectedVehicle.id : null
                }).select('id').single()
                if(scanError) throw scanError

                const {data,error:fnError}=await supabase.functions.invoke('procesar-documento',{body:{scan_id:scanData.id}})
                if(fnError) throw new Error(fnError.message)
                if(data?.error) throw new Error(data.error)
                
                const record=data?.records?.[0]
                if(!record) throw new Error('No se pudo procesar el documento.')
                const columns=data.columns??data.template?.columns??[]
            applyAiRecord(record,columns)
            setScanId(scanData.id)}catch(err){
                setScanNotice({type:'error',text:`Error al procesar el documento: ${err.message}`}) 
            }finally{
                setScanning(false)
                if(fileInputRef.current) fileInputRef.current.value=''
            }
            }
        
            function applyAiRecord(record,columns){
            const filled=[]
            const doubtful=[]
            const updates={}
            for(const col of columns){
                const field=col.db_column
                if(!(field in emptyForm)) continue
                const value=aiValueToForm(record[col.key],col.data_type,field)
                if(value===null) continue
                if(!isEmpty(form[field])) continue
                updates[field]=value
                filled.push(field)
                if((record.campos_dudosos||[]).includes(col.key)) doubtful.push(field)
            }

            const plateCol=columns.find(c=>c.db_column==='plate_on_form')
            const plateRead=plateCol ? String(record[plateCol.key]||'').trim() : ''
            setScanPlate(plateRead)

            const match=plateRead ? vehicles.find(v=>normalizePlate(v.license_plate)===normalizePlate(plateRead)) : null
            let notice={type:'ok',text:'Boleto leido con AI'}

            if(!form.vehicle_id){
                if(match){
                    updates.vehicle_id=String(match.id)
                    filled.push('vehicle_id')
                    if(!form.requesting_department && match.departments?.name){
                        updates.requesting_department=match.departments.name
                        filled.push('requesting_department')
                    }
    
                }else if(plateRead){
                    notice={type:'warning',text:`No se encontró un vehículo con la tablilla ${plateRead}`}
                }
                else if(selectedVehicle && selectedVehicle.license_plate){
                    notice={type:'warning',text:`No se detectó tablilla en el boleto. Se esperaba ${selectedVehicle.license_plate}`}
                }
            }
            
            setForm(f=>({...f,...updates}))
            setAiFields(filled)
            setDoubtfulFields(doubtful)
            setScanNotice(notice)

            }
            
        function removePhoto(){
            setPhoto(null)
            setPhotoError('')
            if (fileInputRef.current) fileInputRef.current.value=''
        }

        function onDrop(e){
            e.preventDefault()
            setDragging(false)
            const file=e.dataTransfer.files[0]
            pickPhoto(file)
        }

        async function handleSubmit(e){
            e.preventDefault()
            setTouched({vehicle_id:true,fuel_type:true,control_number:true,dispatch_date:true,requester_name:true,container_gallons:true})
           if(!isValid) return
           setStatus({type:'saving',text:''})
           const vehicleId=isContainer ? null : Number(form.vehicle_id)

           const{error}=await supabase.from('fuel_register').insert({
            scan_id:scanId,
            vehicle_id:vehicleId,
            plate_on_form:scanPlate||selectedVehicle?.license_plate||null,
            control_number:form.control_number.trim(),
            fuel_type:form.fuel_type,
            dispatch_date:form.dispatch_date,
            requesting_department:form.requesting_department.trim()||null,
            amount_requested:toNumber(form.amount_requested),
            requester_name:form.requester_name.trim()||null,
            requester_license:form.requester_license.trim()||null,
            mileage:isContainer?null:toNumber(form.mileage),
            container_gallons:toNumber(form.container_gallons),
            container_equipment:form.container_equipment.trim()||null,
            authorized_by:form.authorized_by.trim()||null,
            authorized_signature:form.authorized_signature,
            amount_dispatched:toNumber(form.amount_dispatched),
            liters:toNumber(form.liters),
            employee_name:form.employee_name.trim()||null,
            employee_license:form.employee_license.trim()||null,
            employee_signature:form.employee_signature,
            supplier_name:form.supplier_name.trim()||null,
            supplier_signature:form.supplier_signature
           })
           if(error) setStatus({type:'error',text:`Error al guardar el registro: ${error.message}`})
           else setStatus({type:'success',text:'Registro guardado correctamente'
           })
           resetForm()
        }

        function resetForm(){
            setForm(emptyForm)
            setTouched({})
            setScanId(null)
            setScanPlate('')
            setAiFields([])
            setDoubtfulFields([])
            setScanNotice({type:'idle',text:''})
        }

        function handleClear(){
            resetForm()
            setStatus({type:'idle',text:''})
        }


       // const deptName=departments.find(d=>d.id===form.department_id)?.name||''
        //const hasPreview=form.manufacturer||form.model||form.year||form.license_plate||form.vin||photo  
        const saving=status.type==='saving'
        const busy=scanning||saving

        const fp=(key)=>({
            id:key,
            error:errors[key],
            touched:touched[key],
            ai:aiFields.includes(key),
            doubtful:doubtfulFields.includes(key),
        })
        return(
            <div className="av">
                <div className="av-heading">
                    <div>
                    <h1>Registrar Combustible</h1>
                    <p>Autoruzacion para Despacho de Combustible</p>
                </div>
                {onDone &&(
                    <button type="button" className="av-btn av-btn-secondary" onClick={onDone}>
                        Volver al inicio
                    </button>
                )}
            </div>
                <form className="af-form" onSubmit={handleSubmit} noValidate>
                    <div className="av-card af-scan">
                        <span className="af-scan-icon"><ScanLine size={26} /></span>
                    <div className="af-scan-text">
                    <strong>¿Tiene el boleto en papel</strong>
                    <p>Escanealo y el asistente llenara los campos vacios</p>
                    </div>
                    <button type="button" className="av-btn av-btn-primary" onClick={()=>fileInputRef.current?.click()} disabled={busy}>
                        {scanning ? 
                         <><Loader2 size={16} className="av-spin" /> Escaneando...</> : <><ScanLine size={16} /> Escanear Boleto</>
                        }
                    </button>
                    <input
                        type="file"
                        accept={SCAN_TYPES.join(',')}
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={(e) => scanTicket(e.target.files[0])}
                    />
                </div>
                {scanNotice.type==='ok' && <div className="av-alert av-alert-ok"><CheckCircle2 size={16} /> {scanNotice.text}</div>
                }
                {scanNotice.type==='warning' && <div className="av-alert af-alert-warning"><AlertCircle size={16} /> {scanNotice.text}</div>
                }
                {scanNotice.type==='error' && <div className="av-alert av-alert-error"><AlertCircle size={16} /> {scanNotice.text}</div>
                }
                {aiFields.length>0&&(
                    <p className="af-legend">
                        <span><i className="af-swatch af-swatch-ai"/>Campos llenados con AI</span>
                        {doubtfulFields.length>0 && <span><i className="af-swatch af-swatch-doubt"/><AlertCircle size={16} /> Campos con lectura dudosa</span>}
                    </p>
                )}
            <section className="av-card">
                <h2 className="av-card-title"><FileText size={20} /> Solicitud</h2>
                <div className="av-row">
                    <Field {...fp('control_number')} label="Número de Control">
                        <input
                            type="text"
                            id="control_number"
                            value={form.control_number}
                            onChange={set('control_number')}
                            onBlur={blur('control_number')}
                            aria-invalid={!!errors.control_number}
                            aria-describedby="control_number-error"
                        />
                    </Field>
                    <Field {...fp('dispatch_date')} label="Fecha de Despacho">
                        <input
                            type="date"
                            id="dispatch_date"
                            value={form.dispatch_date}
                            onChange={set('dispatch_date')}
                            onBlur={blur('dispatch_date')}
                            aria-invalid={!!errors.dispatch_date}
                            aria-describedby="dispatch_date-error"
                        />
                    </Field>
                </div>
                <div className="av-row">
                    <Field {...fp('fuel_type')} label="Tipo de Combustible">
                        <select
                            id="fuel_type"
                            value={form.fuel_type}
                            onChange={set('fuel_type')}
                            onBlur={blur('fuel_type')}
                            aria-invalid={!!errors.fuel_type}
                            aria-describedby="fuel_type-error"
                        >
                            <option value="">Seleccione un tipo</option>
                            <option value="gasolina">Gasolina</option>
                            <option value="diesel">Diesel</option>
                        </select>
                    </Field>
                    <Field {...fp('amount_requested')} label="Cantidad Solicitada ($)">
                        <input
                            type="number"
                            id="amount_requested"
                            value={form.amount_requested}
                            min="0"
                            step="0.01"
                            onChange={set('amount_requested')}
                            onBlur={blur('amount_requested')}
                            aria-invalid={!!errors.amount_requested}
                            aria-describedby="amount_requested-error"
                        />
                    </Field>
                </div>
                <div className="av-row">
                    <Field {...fp('requester_name')} label="Nombre del Solicitante">
                        <input
                            type="text"
                            id="requester_name"
                            value={form.requester_name}
                            onChange={set('requester_name')}
                            onBlur={blur('requester_name')}
                            aria-invalid={!!errors.requester_name}
                            aria-describedby="requester_name-error"
                        />
                    </Field>
                    <Field {...fp('requester_license')} label="Licencia del Solicitante">
                        <input
                            type="text"
                            id="requester_license"
                            value={form.requester_license}
                            onChange={set('requester_license')}
                            onBlur={blur('requester_license')}
                            aria-invalid={!!errors.requester_license}
                            aria-describedby="requester_license-error"
                        />
                    </Field>
                    </div>
                    <Field {...fp('requesting_department')} label="Departamento Solicitante">
                        <input
                            type="text"
                            id="requesting_department"
                            value={form.requesting_department}
                            onChange={set('requesting_department')}
                            onBlur={blur('requesting_department')}
                            aria-invalid={!!errors.requesting_department}
                            aria-describedby="requesting_department-error"
                        />
                    </Field>
                    </section>
                <section className="av-card">
                    <h2 className="av-card-title"><CarFront size={20} /> Vehículo</h2>

                    <Field {...fp('vehicle_id')} label="Vehículo">
                        <select
                            id="vehicle_id"
                            value={form.vehicle_id}
                            onChange={chooseVehicle}
                            onBlur={blur('vehicle_id')}
                            aria-invalid={!!errors.vehicle_id}
                            aria-describedby="vehicle_id-error"
                        >
                            <option value="">Seleccione un vehículo</option>
                            {vehicles.map(v=>(
                                <option key={v.id} value={v.id}>{v.license_plate} - {v.manufacturer} {v.model}</option>
                            ))}
                            <option value={NO_VEHICLE}>Contenedor</option>
                        </select>
                    </Field>

                    {selectedVehicle && (
                        <p>Tablilla:<strong>{selectedVehicle.license_plate}</strong> Fabricante:<strong>{selectedVehicle.manufacturer}</strong> Modelo:<strong>{selectedVehicle.model}</strong> Departamento:<strong>{selectedVehicle.departments?.name||'N/A'}</strong></p>
                    )}
                    {!isContainer&&(
                        <Field {...fp('mileage')} label="Millaje del Vehículo">
                            <input
                                type="number"
                                id="mileage"
                                value={form.mileage}
                                onChange={set('mileage')}
                                onBlur={blur('mileage')}
                                aria-invalid={!!errors.mileage}
                                aria-describedby="mileage-error"
                            />
                        </Field>
                    )}
                    {isContainer && (
                        <p>Se ha seleccionado un contenedor. Por favor ingrese la cantidad de galones.</p>
                    )}
                    {isContainer && (
                        <Field {...fp('container_gallons')} label="Cantidad de Galones">
                            <input
                                type="number"
                                id="container_gallons"
                                value={form.container_gallons}
                                onChange={set('container_gallons')}
                                onBlur={blur('container_gallons')}
                                aria-invalid={!!errors.container_gallons}
                                aria-describedby="container_gallons-error"
                            />
                        </Field>
                    )}
                    {isContainer && (
                        <Field {...fp('container_equipment')} label="Equipo del Contenedor">
                            <input
                                type="text"
                                id="container_equipment"
                                value={form.container_equipment}
                                onChange={set('container_equipment')}
                                onBlur={blur('container_equipment')}
                                aria-invalid={!!errors.container_equipment}
                                aria-describedby="container_equipment-error"
                            />
                        </Field>
                    )}
                    </section>
                    <section className="av-card">

                    <h2 className="av-card-title">Persona que otorga el boleto</h2>

                    <Field {...fp('authorized_by')} label="Nombre de la persona que autoriza">
                        <input
                            type="text"
                            id="authorized_by"
                            value={form.authorized_by}
                            onChange={set('authorized_by')}
                            onBlur={blur('authorized_by')}
                            aria-invalid={!!errors.authorized_by}
                            aria-describedby="authorized_by-error"
                        />
                    </Field>
                   <div className="af-checks">
                    <Check {...fp('authorized_signature')} label="Firma de la persona que autoriza" checked={form.authorized_signature} onChange={set('authorized_signature')} />
                    </div>
                </section>
                    <section className="av-card">
                    <h2 className="av-card-title">Despacho de Combustible</h2>
                    <div className="av-row">
                    <Field {...fp('amount_dispatched')} label="Cantidad Despachada (gal)">
                        <input
                            type="number"
                            id="amount_dispatched"
                            value={form.amount_dispatched}
                            onChange={set('amount_dispatched')}
                            onBlur={blur('amount_dispatched')}
                            aria-invalid={!!errors.amount_dispatched}
                            aria-describedby="amount_dispatched-error"
                        />
                    </Field>
                    <Field {...fp('liters')} label="Cantidad Despachada (Lts)">
                        <input
                            type="number"
                            id="liters"
                            value={form.liters}
                            onChange={set('liters')}
                            onBlur={blur('liters')}
                            aria-invalid={!!errors.liters}
                            aria-describedby="liters-error"
                        />
                    </Field>
                    </div>
                    <div className="av-row">
                    <Field {...fp('employee_name')} label="Nombre del Empleado que despacha">
                        <input
                            type="text"
                            id="employee_name"  
                            value={form.employee_name}
                            onChange={set('employee_name')}
                            onBlur={blur('employee_name')}
                            aria-invalid={!!errors.employee_name}
                            aria-describedby="employee_name-error"
                        />
                    </Field>
                    <Field {...fp('employee_license')} label="Licencia del Empleado que despacha">
                        <input
                            type="text" 
                            id="employee_license"
                            value={form.employee_license}
                            onChange={set('employee_license')}
                            onBlur={blur('employee_license')}
                            aria-invalid={!!errors.employee_license}
                            aria-describedby="employee_license-error"
                        />
                    </Field>
                    </div>
                    <Field {...fp('supplier_name')} label="Nombre del Proveedor">
                        <input
                            type="text"
                            id="supplier_name"
                            value={form.supplier_name}
                            onChange={set('supplier_name')}
                            onBlur={blur('supplier_name')}
                            aria-invalid={!!errors.supplier_name}
                            aria-describedby="supplier_name-error"
                        />
                    </Field>
                    <div className="af-checks">
                    <Check {...fp('employee_signature')} label="Firma del Empleado que despacha" checked={form.employee_signature} onChange={set('employee_signature')} />
                    <Check {...fp('supplier_signature')} label="Firma del Proveedor" checked={form.supplier_signature} onChange={set('supplier_signature')} />
                    </div>
                    {status.type==='error' && <div className="av-alert av-alert-info"><Loader2 size={16} className="av-spin" /> Guardando...</div>
                    }
                    {status.type==='success' && <div className="av-alert av-alert-ok"><CheckCircle2 size={16} /> Registro guardado correctamente</div>
                    }
                    <div className="av-actions">
                        <button type="submit" className="av-btn av-btn-primary" disabled={saving}>
                            {saving ? 'Guardando...' : 'Guardar Registro'}
                        </button>
                        <button type="button" className="av-btn av-btn-secondary" onClick={handleClear} disabled={saving}>
                            Limpiar
                        </button>   
                    </div>
                    </section>
                </form>
                </div>
        )}
    



        function Field({id,label,error,touched,ai,doubtful,children}){
            const visibleError=touched && error
            const classes=['av-field']
            if(visibleError) classes.push('has-error')
            if(doubtful) classes.push('af-doubtful')
            else if(ai) classes.push('af-ai')
            return(
                <div className={classes.join(' ')}>
                    <label htmlFor={id}>{label}</label>
                    {children}
                    {visibleError && <div className="av-error" id={`${id}-error`}>{error}</div>}
                </div>
            )
        }
        function Check({id,label,checked,onChange,ai,doubtful}){
            const classes=['af-check']
            if(doubtful) classes.push('af-doubtful')
            else if(ai) classes.push('af-ai')
            return(
                <label className={classes.join(' ')} htmlFor={id}>
                        <input
                            type="checkbox"
                            id={id}
                            checked={checked}
                            onChange={onChange}
                        />
                        {label}
                    </label>
            )
        }
            
