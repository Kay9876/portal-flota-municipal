import {useState,useEffect,useMemo,useRef } from "react";
import {CheckCircle2, AlertCircle,ImagePlus,X,Camera,Loader2} from 'lucide-react'
import { supabase } from "../supabaseClient";
import './addVehicle.css'
import './reportIssue.css'
import {CATEGORIES,PHOTO_TYPES,reportMode,emptyIssue,validateIssue,buildIssueFormData} from '../utils/maintenanceHelpers'
export default function ReportIssue({user=null,profile=null,onDone}){
    const mode=reportMode(user,profile)
    const [vehicles,setVehicles]=useState([])
    const [form,setForm]=useState(()=>({
        ...emptyIssue(), reporter_name: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')

    }))
    const [photo,setPhoto]=useState(null)
    const [submitted,setSubmitted]=useState(false)
    const [status,setStatus]=useState({type:'idle',text:''})
    const [result,setResult]=useState(null)
    const photoRef=useRef(null)

    useEffect(()=>{
        if(mode==='publico') return
        supabase.from('vehicles').select('id,license_plate,manufacturer,model,departments(name)').order('license_plate',{ascending:true}).then(({data,error})=>{
            if(error) console.error('Error loading vehicles:',error)
             setVehicles(data||[])
        })
    },[mode])

    const errors=useMemo(()=>validateIssue(form,mode,photo),[form,mode,photo])
    const vehicle=vehicles.find(v=>String(v.id)===form.vehicle_id)
    const show=(k)=>submitted&&errors[k]

    const set=(key)=>(e)=>{
        const value=e.target.type==='checkbox' ? e.target.checked : e.target.value
        setForm(f=>({...f,[key]:value}))
        if(status.type==='error') setStatus({type:'idle',text:''}) 
    }

    function choosePhoto(e){
        setPhoto(e.target.files[0]||null)
    }

    async function handleSubmit(e){
        e.preventDefault()
        setSubmitted(true)
        if(Object.keys(errors).length){
            setStatus({type:'error',text:'Por favor corrija los errores antes de enviar.'})
            return
        }
        setStatus({type:'saving',text:'Enviando reporte...'})

        const {data,error}=await supabase.functions.invoke('request_mainteance',{
            body: buildIssueFormData(form,mode,photo)
        })

        let message=data?.error
        if(!message&&error){
            try{message=(await error.context?.json())?.error}catch{}
            message=message||error.message
        }

        if(message){
            setStatus({type:'error',text:`Error al enviar el reporte: ${message}`})
            return
        }
        setResult(data)
        setStatus({type:'idle',text:''})

    }

    function reset(){
        setForm({...emptyIssue(),reporter_name: form.reporter_name, reporter_phone: form.reporter_phone})
        setPhoto(null)
        setSubmitted(false)
        setResult(null)
        if(photoRef.current) photoRef.current.value=''
    }

    const saving=status.type==='saving'

    if(result){
        return (
        <div className="av ri">
            <div className="av-card ri-done" role="status">
                <CheckCircle2 size={32} className="ri-done-icon"/>
                <h1>{result.duplicate ? 'Reporte duplicado' : 'Reporte enviado correctamente'}</h1>
                <p>{result.duplicate ? 'Ya existe un reporte similar para este vehículo.' : 'Tu numero de solicitud es'}</p>
                <p className="ri-folio">{result.folio}</p>
                <p>
                    {result.duplicate ? 'Si crees que esto es un error, por favor contacta al administrador del sistema.' : 'Recibirás un correo de confirmación con los detalles del reporte.'}
                </p>
                <div className="av-actions">
                    <button type="button" className="av-btn av-btn-primary" onClick={reset}>Enviar otro reporte</button>
                    {onDone && <button type="button" className="av-btn av-btn-secondary" onClick={onDone}>Volver al inicio</button>}
                </div>
            </div>
        </div>
    )}

    return(
        <div className="av ri">
            <div className="av-heading">
                <div>
                    <h1>Reportar un problema</h1>
                    <p>{mode==='publico' ? 'Reporta un problema con uno de nuestros vehículos.' : 'Reporta un problema con uno de nuestros vehículos.'}</p>
                </div>
                {onDone && <button type="button" className="av-btn av-btn-secondary" onClick={onDone}><X size={16}/> Cerrar</button>}
            </div>
        
            <form className="ri-form" onSubmit={handleSubmit} noValidate>
                <section className="av-card">
                    <h2 className="av-card-title"><ImagePlus size={20}/> Información del reporte</h2>
                    
                    {mode==='publico' ? (
                        <div className={`av-field ${show('plate') ? 'has-error' : ''}`}>
                            <label htmlFor="plate">Tablilla del vehículo</label>
                            <input id="plate" type="text" autoCapitalize="characters" autoComplete="off"
                                value={form.plate} onChange={set('plate')} aria-invalid={!!show('plate')} />
                            {show('plate') && <div className="av-field-error">{errors.plate}</div>}
                        </div>
                    ) : (
                        <div className={`av-field ${show('vehicle_id') ? 'has-error' : ''}`}>
                            <label htmlFor="vehicle_id">Vehículo</label>
                            <select id="vehicle_id" value={form.vehicle_id} onChange={set('vehicle_id')} aria-invalid={!!show('vehicle_id')}>
                                <option value="">Seleccione un vehículo</option>
                                {vehicles.map(v=>(
                                    <option key={v.id} value={v.id}>{v.license_plate} - {v.manufacturer} {v.model}</option>
                                ))}
                            </select>
                            {show('vehicle_id') && <div className="av-error">{errors.vehicle_id}</div>}
                            {vehicle && <p className="ri-hint">Departamento: <strong>{vehicle.departments?.name || 'N/A'}</strong></p>}
                        </div>
                    )}
                    
                    <div className="av-row">
                        <div className={`av-field ${show('reporter_name') ? 'has-error' : ''}`}>
                            <label htmlFor="reporter_name">Su nombre{mode==='mecanico' ? ' (quien trae el vehículo)' : ''}</label>
                            <input id="reporter_name" type="text" value={form.reporter_name} onChange={set('reporter_name')} />
                            {show('reporter_name') && <div className="av-error">{errors.reporter_name}</div>}
                            </div>
                        <div className={`av-field ${show('reporter_phone') ? 'has-error' : ''}`}>
                            <label htmlFor="reporter_phone">Su teléfono</label>
                            <input id="reporter_phone" type="tel" value={form.reporter_phone} onChange={set('reporter_phone')} />
                            {show('reporter_phone') && <div className="av-error">{errors.reporter_phone}</div>}
                        </div>
                    </div>
                    </section>

                    <section className="av-card">
                    <h2 className="av-card-title"><ImagePlus size={20}/> Descripción del problema</h2>
                    
                    <fieldset className={`ri-fieldset ${show('category') ? 'has-error' : ''}`}>
                        <legend>Categoría del problema</legend>
                        <div className="ri-options">
                            {CATEGORIES.map(cat=>(
                                <label key={cat.value} className={`ri-option ${form.category===cat.value ? 'selected' : ''}`}>
                                    <input type="radio" name="category" value={cat.value} checked={form.category===cat.value} onChange={set('category')} />
                                    {cat.label}
                                </label>
                            ))}
                        </div>
                        {show('category') && <div className="av-error">{errors.category}</div>}
                    </fieldset>

                    <div className={`av-field ${show('description') ? 'has-error' : ''}`}>
                        <label htmlFor="description">Descripción del problema</label>
                        <textarea id="description" rows={4} value={form.description} onChange={set('description')} aria-invalid={!!show('description')}></textarea>
                        {show('description') && <div className="av-error">{errors.description}</div>}
                    </div>

                    <fieldset className={`ri-fieldset ${show('vehicle_usable') ? 'has-error' : ''}`}>
                        <legend>¿El vehículo es utilizable?</legend>
                        <div className="ri-options ri-options-2">
                            <label className={`ri-option ${form.vehicle_usable==='si' ? 'selected' : ''}`}>
                                <input type="radio" name="vehicle_usable" value="si" checked={form.vehicle_usable==='si'} onChange={set('vehicle_usable')} />
                                Sí
                            </label>
                            <label className={`ri-option ${form.vehicle_usable==='no' ? 'selected' : ''}`}>
                                <input type="radio" name="vehicle_usable" value="no" checked={form.vehicle_usable==='no'} onChange={set('vehicle_usable')} />
                                No, es urgente que se repare
                            </label>
                        </div>
                        {show('vehicle_usable') && <div className="av-error">{errors.vehicle_usable}</div>}
                    </fieldset>

                    <div className={`av-field ${show('photo') ? 'has-error' : ''}`}>
                        <label htmlFor="photo">Foto del problema (opcional)</label>
                        <div className="ri-photo">
                            <button type="button" className="av-btn av-btn-secondary" onClick={()=>photoRef.current?.click()}>
                                <Camera size={16}/> {photo ? 'Cambiar foto' : 'Seleccionar foto'}
                                </button>
                                {photo && <span className="ri-hint">{photo.name}</span>
                                }
                                </div>
                                <input id="photo" ref={photoRef} type="file" accept={PHOTO_TYPES.join(',')} capture="environment" style={{display:'none'}} onChange={choosePhoto} />
                                {show('photo') && <div className="av-error">{errors.photo}</div>}
                            </div>

                            {mode==='mecanico' && (
                                <label className="ri-check">
                                    <input type="checkbox" checked={form.receive_now} onChange={set('receive_now')} />
                                    El vehiculo ya está en el taller (marcar como "En taller")
                                    </label>
                            )}

                            <input type="text" name="website" value={form.website} onChange={set('website')} className="ri-trap" autoComplete="off" tabIndex="-1" aria-hidden="true" /> 
                            {status.type==='error' && <div className="av-alert av-alert-error"><AlertCircle size={16}/> {status.text}</div>}
                            <div className="av-actions">
                                <button type="submit" className="av-btn av-btn-primary" disabled={saving}>
                                    {saving ? <><Loader2 size={16} className="av-spin" /> Enviando...</>: 'Enviar reporte'}
                                </button>
                                </div>
                            </section>
                        </form>
                    </div>
                )}
      
    

    

// .ri { max-width: 760px; }
// .ri-form { display: flex; flex-direction: column; gap: 16px; }
// .ri-hint { font-size: 13px; color: #5b6573; margin: 6px 0 0; }

// .ri-fieldset { border: 0; padding: 0; margin: 0 0 16px; min-width: 0; }
// .ri-fieldset legend { font-weight: 600; font-size: 14px; margin-bottom: 8px; color: #1f2933; }
// .ri-options { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
// .ri-options-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
// .ri-option { display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 14px; border: 1px solid #d1d5db; border-radius: 10px; cursor: pointer; font-size: 15px; background: #fff; }
// .ri-option input { width: 18px; height: 18px; margin: 0; }
// .ri-option.selected { border-color: #0f3a5c; background: #eef4fa; font-weight: 600; }
// .ri-option-urgent.selected { border-color: #dc2626; background: #fef2f2; color: #991b1b; }
// .ri-fieldset.has-error .ri-option { border-color: #fca5a5; }

// .ri-form textarea { width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 8px; padding: 10px 12px; font: inherit; resize: vertical; }
// .ri-photo { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
// .ri-check { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 15px; margin-bottom: 8px; }
// .ri-check input { width: 20px; height: 20px; }

// .ri-trap { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }

// .ri-done { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px 20px; }
// .ri-done-icon { color: #16a34a; }
// .ri-done h1 { margin: 0; color: #0f3a5c; }
// .ri-folio { font-size: 44px; font-weight: 700; color: #0f3a5c; margin: 0; }
// .ri-done .av-actions { justify-content: center; flex-wrap: wrap; }

// @media (max-width: 768px) {
//   .ri-option { min-height: 52px; font-size: 16px; }
//   .ri-form input, .ri-form select, .ri-form textarea { font-size: 16px; }
//   .ri .av-actions .av-btn { width: 100%; justify-content: center; }
// }
