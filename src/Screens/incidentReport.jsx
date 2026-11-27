import {useState,useEffect} from 'react'
import { AlertTriangle,CheckCircle2,AlertCircle,Loader2 } from 'lucide-react'
import {supabase} from '../supabaseClient'
import './addVehicle.css'
import './reportIssue.css'

const empty={reporter_name:'',plate:'',description:'',website:''}

export default function IndicentReport({onDone}){
    const [form,setForm]=useState(empty)
    const [status,setStatus]=useState({type:'idle',text:''})
    const [sent,setSent]=useState(false)
    const [departments,setDepartments]=useState([])

    useEffect(()=>{
        supabase.from('departments').select('id,name').order('name').then(({data})=>setDepartments(data||[]))
    },[])

    const set=(key)=>e=>{
        setForm(f=>({...f,[key]:e.target.value}))
        if(status.type==='error') setStatus({type:'idle',text:''})
    }

    async function handleSubmit(e){
        e.preventDefault()
        if(form.website) {setSent(true); return}
        if(!form.reporter_name.trim() || !form.plate.trim() || !form.description.trim()){
            setStatus({type:'error',text:'Por favor completa todos los campos.'})
            return
        }
        setStatus({type: 'saving', text:''})
        const{error}=await supabase.from('incident_reports').insert({
            reporter_name: form.reporter_name.trim(),
            plate: form.plate.trim(),
            description: form.description.trim(),
            reporter_department_id: form.reporter_department_id ? Number(form.reporter_department_id) : null
        })
        if(error) {
            setStatus({type:'error',text:'Error al enviar el reporte: '+error.message});
        return}
        setStatus({type: 'idle', text:''})
        setSent(true)
    }

    if(sent){
        return(
            <div className="av ri">
                <div className="av-card ri-done" role="status">
                    <CheckCircle2 size={48} className="ri-done-icon"/>
                    <h1>Reporte enviado</h1>
                    <p>Gracias por enviar el reporte. Nuestro equipo de mantenimiento lo revisará y tomará las acciones necesarias.</p>
                    {onDone && <button type="button" className="av-btn av-btn-primary" onClick={onDone}>Cerrar</button>}
                </div>
            </div>
        )
    }

    return(
            <div className="av ri">
                <div className="av-heading">
                    <div>
                        <h1>Reporte de Incidente</h1>
                        <p>Choque, daño, pérdida de llave o cualquier situación con un vehículo</p>
                    </div>
                    {onDone && <button type="button" className="av-btn av-btn-secondary" onClick={onDone}>Cerrar</button>}
                </div>

                <form className="ri-form" onSubmit={handleSubmit} noValidate>
                    <section className="av-card">
                        <h2 className="av-card-title"><AlertTriangle size={20}/> Reporte de Incidente</h2>

                        <div className="av-row">
                            <div className="av-field">
                                <label htmlFor="inc-name">Nombre del reportante</label>
                                <input type="text" id="inc-name" value={form.reporter_name} onChange={set('reporter_name')} />
                            </div>
                            <div className="av-field">
                                <label htmlFor="inc-plate">Tablilla del vehículo</label>
                                <input type="text" id="inc-plate" value={form.plate} onChange={set('plate')} />
                            </div>
                        </div>
                        {departments.length>0 && (
                            <div className="av-field">
                                <label htmlFor="inc-department">Departamento del reportante</label>
                                <select id="inc-department" value={form.reporter_department_id||''} onChange={set('reporter_department_id')}>
                                    <option value="">-- Ninguno --</option>
                                    {departments.map(d=>(
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="av-field">
                            <label htmlFor="inc-description">Descripción del incidente</label>
                            <textarea id="inc-description" value={form.description} onChange={set('description')} />
                        </div>

                        <input type="text" value={form.website} onChange={set('website')} className="ri-trap" tabIndex="-1" autoComplete="off" aria-hidden="true"/>

                        {status.type==='error' && <div className=" av-alert av-alert-error"><AlertCircle size={16}/>{status.text}</div>}

                        <div className="av-actions">
                            <button type="submit" className="av-btn av-btn-primary" disabled={status.type==='saving'}>
                                {status.type==='saving' ? 'Enviando...' : 'Enviar Reporte'}
                            </button>
                        </div>
                    </section>
                </form>
            </div>
        )
    }

 