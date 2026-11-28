import { useState,useEffect } from "react";
import QRCode  from 'qrcode'
import {Printer} from 'lucide-react'
import { supabase } from "../supabaseClient";
import './addVehicle.css'
import './keyKiosk.css'

export default function KeyLabels({onDone}) {
    const [labels,setLabels] = useState([])

    useEffect(()=>{
        supabase.from('vehicles').select('id,license_plate,manufacturer,model').order('license_plate',{ascending:true}).then(async({data})=>{
            const list = await Promise.all((data || []).filter(v=>v.license_plate).map(async vehicle=>({
                ...vehicle, qr: await QRCode.toDataURL(vehicle.license_plate, {margin: 2, width:300})
            })))
            setLabels(list)
        })
    },[])

    return (
        <div className="kl">
        <div className="kl-head no-print">
            <h1>Etiquetas de llaves QR</h1>
            <div style={{display:'flex',gap:8}}>
            <button type="button" className="av-btn av-btn-primary" onClick={()=> window.print()}><Printer size={18}/>Imprimir</button>
            {onDone && <button type="button" className="av-btn av-btn-secondary" onClick={onDone}>Cerrar</button>}
            </div>
        </div>
        <div className="kl-grid">
            {labels.map(vehicle=>(
                <div className="kl-label" key={vehicle.id}>
                    <img src={vehicle.qr} alt={`Código QR para ${vehicle.license_plate}`} />
                    <strong>{vehicle.license_plate}</strong>
                    <span>{vehicle.manufacturer} {vehicle.model}</span>
                </div>
            ))}
        </div>
        </div>
    )}