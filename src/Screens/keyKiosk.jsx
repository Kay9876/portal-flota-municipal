import {useState, useEffect,useRef} from 'react'
import {Html5Qrcode} from 'html5-qrcode'
import {KeyRound,ScanLine,CheckCircle2,AlertCircle,Loader2,ArrowLeft,Undo2} from 'lucide-react'
import { supabase } from '../supabaseClient'
import './keyKiosk.css'
import './addVehicle.css'

const normPlate = (p)=> (p || '').toUpperCase().replace(/[^A-Z0-9]/g,'')
const todayPR=()=> new Date().toLocaleDateString('en-CA',{timeZone:'America/Puerto_Rico'})
const timePR= (iso)=> new Date(iso).toLocaleTimeString('en-US',{timeZone:'America/Puerto_Rico',weekday:'short',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})
const emptyForm={driver_name:'',driver_license_num:'',user_department_id:'',passenger_name:'',destination:'',confirmed:false}
export default function KeyKiosk({onDone}) {
    const [vehicle, setVehicle] = useState(null)
    const [departments, setDepartments] = useState([])
    const [step, setStep] = useState('scan')
    const [vehicles, setVehicles] = useState([])
    const [loan, setLoan] = useState(null)
    const [form,setForm]=useState(emptyForm)
    const [plateInput, setPlateInput] = useState('')
    const [message, setMessage] = useState({type:'idle',text:''})
    const [busy, setBusy] = useState(false)
    const [signed, setSigned] = useState(false)
    const padRef=useRef(null)

    useEffect(()=>{
        Promise.all([
            supabase.from('vehicles').select('id,license_plate,manufacturer,model,department_id,departments(name)'),
            supabase.from('departments').select('id,name').order('name')])
            .then(([vehicle,department])=>{
                setVehicles(vehicle.data || []);
                setDepartments(department.data || []);
            })
    },[])

    useEffect(()=>{
        if(step!=='done') return
        const timer = setTimeout(reset,4000)
        return ()=>clearTimeout(timer)
    },[step])

    function reset() {
        setStep('scan');
        setVehicle(null);
        setLoan(null);
        setForm(emptyForm);
        setPlateInput('');
        setMessage({type:'idle',text:''});
        setSigned(false);
    }

    async function handleCode(code) {
        const plate = normPlate(code)
        const v=vehicles.find(v=>normPlate(v.license_plate)===plate)
        if(!v) {
            setMessage({type:'error',text:`Vehículo con matrícula ${plate} no encontrado.`})
            return
        }
        setBusy(true)
        const {data,error}=await supabase.from('key_register').select('id,driver_name,key_pickup').eq('vehicle_id',v.id).is('key_handover',null).maybeSingle()
        setBusy(false)
        if(error) {setMessage({type:'error',text:`Error al consultar el registro de llaves: ${error.message}`}); return}
        setVehicle(v)
        setLoan(data)
        setMessage({type:'idle',text:''})
        setStep(data?'return':'checkout')
    }

    async function checkout(e) {
        e.preventDefault()
        if(!form.driver_name.trim()||!form.destination.trim()||!signed){
            setMessage({type:'error',text:'Por favor complete todos los campos y firme en el recuadro.'})
            return
        }

        setBusy(true)
        const blob=await padRef.current.toBlob()
        const path=`signatures/${vehicle.id}_${Date.now()}.png`
        const {error:uploadError}=await supabase.storage.from('key-signatures').upload(path,blob,{contentType:'image/png'}) 
        if(uploadError) {
            setBusy(false)
            setMessage({type:'error',text:`Error al subir la firma: ${uploadError.message}`})
            return
        }
        const dept=departments.find(d=>String(d.id)===form.user_department_id)
        const{error}=await supabase.from('key_register').insert([{
            vehicle_id: vehicle.id,
            kr_date: todayPR(),
            driver_name: form.driver_name.trim().toUpperCase(),
            driver_license_num: form.driver_license_num.trim() || null,
            user_department_id: dept? dept.id : null,
            user_department: dept? dept.name : null,
            destination: form.destination,
            passenger_name: form.passenger_name.trim() || null,
            key_pickup: new Date().toISOString(),
            key_handover:null,
            has_signature:true,
            signature_path:path,
            source:'manual'
        }])
        setBusy(false)
        if(error) {
            const text=error.code==='23P01'?'Ya existe un registro activo de llaves para este vehículo.':'Error al registrar la entrega de llaves: '+error.message
            setMessage({type:'error',text})
            return
        }
        setMessage({type:'success',text:`Entrega de llaves registrada para ${vehicle.license_plate}.`})
        setStep('done')
    }

    async function giveBack() {
        setBusy(true)
        const {data,error}=await supabase.from('key_register').update({key_handover:new Date().toISOString()}).eq('id',loan.id).is('key_handover',null).select('id')
        setBusy(false)

        if(error) {
            setMessage({type:'error',text:`Error al registrar la devolución de llaves: ${error.message}`})
            return
        }

        if(!data?.length) {
            setMessage({type:'error',text:`No se pudo registrar la devolución de llaves. Es posible que ya se haya registrado previamente.`})
            return
        }

        setMessage({type:'success',text:`Devolución de llaves registrada para ${vehicle.license_plate}.`})
        setStep('done')
    }

    const set=(k)=>(e)=>setForm(f=>({...f,[k]:e.target.type==='checkbox'?e.target.checked:e.target.value}))

    return(

        <div className="kk">
            <div className="kk-head"><KeyRound size={32} /> <h1>Registro de llaves</h1>
            {onDone && <button type="button" className="av-btn av-btn-secondary" onClick={onDone}><ArrowLeft size={16} /> Salir</button>}
            </div>
            {message.type==='error' && <div className="av-alert av-alert-error kk-msg"><AlertCircle size={16} /> {message.text}</div>}

            {step ==='scan' &&(
                <section className="av-card kk-card">
                    <h2>Escanear código QR de matrícula</h2>
                    <Scanner onCode={handleCode} paused={busy} />
                    <form className="kk-manual" onSubmit={(e)=>{e.preventDefault(); if (plateInput.trim()) handleCode(plateInput.trim())}}>
                        <label htmlFor="kk-plate">O ingrese la matrícula manualmente:</label>
                        <div className="kk-manual-row">
                            <input id="kk-plate" type="text" autoCapitalize="characters" autoComplete="off"
                            value={plateInput} onChange={(e)=>setPlateInput(e.target.value)} />
                            <button type="submit" className="av-btn av-btn-primary" disabled={busy}>
                                {busy? <Loader2 size={16} className="av-spin" /> : <ScanLine size={16} />
                                } Escanear
                            </button>
                        </div>
                    </form>
                </section>
            )}
        {step==='checkout' && vehicle && (
            <form className="av-card kk-card" onSubmit={checkout} noValidate>
                <p className="kk-badge kk-out">ENTREGA DE LLAVE </p>
                <h2>Vehículo: {vehicle.license_plate} ({vehicle.manufacturer} {vehicle.model})</h2>
                <p className = "kk-sub">{vehicle.departments?.name}</p>
            
            <div className ="kk-grid">
                <div className="av-field"><label htmlFor="kk-driver">Nombre del conductor</label><input id="kk-driver" type="text" value={form.driver_name} onChange={set('driver_name')} autoFocus required /></div>
                <div className="av-field"><label htmlFor="kk-lic">Número de licencia de conducir</label><input id="kk-lic" type="text" value={form.driver_license_num} onChange={set('driver_license_num')} /></div>
                <div className="av-field"><label htmlFor="kk-dept">Departamento del usuario</label><select id="kk-dept" value={form.user_department_id} onChange={set('user_department_id')} required>
                    <option value="">Seleccione un departamento</option>
                    {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                            {dept.name}
                        </option>
                    ))}
                </select></div>
                <div className="av-field"><label htmlFor="kk-pass">Acompañante (si hay)</label><input id="kk-pass" type="text" value={form.passenger_name} onChange={set('passenger_name')} /></div>
                <div className="av-field"><label htmlFor="kk-dest">Destino del viaje</label><input id="kk-dest" type="text" value={form.destination} onChange={set('destination')} required /></div>
                <div className ="kk-sign"><label> Firma del conductor *</label><SignaturePad padRef={padRef} onChange={setSigned} /></div>
            </div>
            <div className="kk-actions">
                <button type="button" className="av-btn av-btn-secondary" onClick={reset} disabled={busy}><Undo2 size={16} /> Cancelar</button>
                <button type="submit" className="av-btn av-btn-primary" disabled={busy}>{busy? <Loader2 size={16} className="av-spin" /> : <CheckCircle2 size={16} />} Registrar entrega</button>
            </div>
        </form>
    

                )}
        {step==='return' && vehicle && loan && (
            <section className="av-card kk-card">
                <p className="kk-badge kk-in">DEVOLUCIÓN DE LLAVE</p>
                <h2>Vehículo: {vehicle.license_plate} ({vehicle.manufacturer} {vehicle.model})</h2>
                <p className="kk-loan">La tiene <strong>{loan.driver_name}</strong> desde <strong>{timePR(loan.key_pickup)}</strong></p>
                <div className="kk-actions">
                    <button type="button" className="av-btn av-btn-secondary" onClick={reset} disabled={busy}><Undo2 size={16} /> Cancelar</button>
                    <button type="button" className="av-btn av-btn-primary" onClick={giveBack} disabled={busy}>{busy? <Loader2 size={16} className="av-spin" /> : <CheckCircle2 size={16} />} Registrar devolución</button>
                </div>
            </section>
        )}
        {step==='done' && (
            <section className="av-card kk-card kk-done">
                <h2>{message.type==='success'? '¡Listo!': 'Error'}</h2>
                <p>{message.text}</p>
                <button type="button" className="av-btn av-btn-primary" onClick={reset}><ScanLine size={16} /> Siguiente</button>
            </section>
        )}
        </div>
    )
}

    function Scanner({onCode,paused}) {
        const ref=useRef(null)
        const [camError,setCamError]=useState('')
        const lastRef=useRef({code: '', at: 0})

    useEffect(()=>{
        if(paused) return
        const qr=new Html5Qrcode('kk-reader')
        ref.current=qr
        let stopped=false
        qr.start(
            {facingMode: 'user'},
            {fps:10, qrbox: {width: 240, height: 240}},
            (text)=>{
                const now=Date.now()
                if(text===lastRef.current.code && now-lastRef.current.at<3000) return
                lastRef.current={code:text, at:now}
                onCode(text)
            },
            ()=>{}
        ).catch(err=>{
            if(!stopped) setCamError('No se pudo acceder a la cámara. Asegúrese de que el navegador tenga permisos para usarla y que no esté siendo utilizada por otra aplicación.')
        })
    return ()=>{
    if(stopped) return
            stopped=true
            qr.isScanning ? qr.stop().then(()=>qr.clear()).catch(()=>{}):qr.clear()  
        }
    },[paused])
    return (
        <div className="kk-scanner">
            <div id="kk-reader" />
            {camError && <p className="kk-cam-error">{camError}</p>}
        </div>
    )
        
    }

    function SignaturePad({padRef,onChange}){
        const canvasRef=useRef(null)
        const drawing=useRef(false)

        useEffect(()=>{
            const canvas=canvasRef.current
            const ratio=window.devicePixelRatio||1
            canvas.width=canvas.offsetWidth*ratio
            canvas.height=canvas.offsetHeight*ratio
            const ctx=canvas.getContext('2d')
            ctx.scale(ratio,ratio)
            ctx.lineWidth=2
            ctx.lineCap='round'
            ctx.lineJoin='round'
            ctx.strokeStyle='#0f3a5c'
            padRef.current={clear:()=>{ctx.clearRect(0,0,canvas.width,canvas.height); onChange(false)},
            toBlob:()=>new Promise(resolve=>canvas.toBlob(resolve,'image/png'))}
        
        },[])
    
        const point=(e)=>{
            const rect=canvasRef.current.getBoundingClientRect()
            return [e.clientX-rect.left,e.clientY-rect.top]
        }

        function down(e){
            e.preventDefault()
            canvasRef.current.setPointerCapture(e.pointerId)
            drawing.current=true
            const ctx=canvasRef.current.getContext('2d')
            const [pX,pY]=point(e)
            ctx.beginPath()
            ctx.moveTo(pX,pY)
        }

        function move(e){
            if(!drawing.current) return
            const ctx=canvasRef.current.getContext('2d')
            const [pX,pY]=point(e)
            ctx.lineTo(pX,pY)
            ctx.stroke()
            onChange(true)
        }
        function up(e){
            drawing.current=false
            canvasRef.current.releasePointerCapture(e.pointerId)
        }

        return(
            <div className="kk-sign">
                <canvas ref={canvasRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} />
                <button type="button" className="av-btn av-btn-secondary" onClick={()=>padRef.current.clear()}>Borrar</button>
            </div>
        )
    }
