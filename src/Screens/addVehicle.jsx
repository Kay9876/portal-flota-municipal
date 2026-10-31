import {useState,useEffect,useMemo,useRef } from "react";
import {CheckCircle2, AlertCircle,Loader2,Clock,ImagePlus,X} from 'lucide-react'
import { supabase } from "../supabaseClient";
import './addVehicle.css'

const emptyForm = {
    department_id: '',
    manufacturer: '',
    model: '',
    year: '',
    license_plate: '',
    vin: ''}

const VIN_LENGTH = 17;
const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/; // VIN regex pattern

const PHOTO_BUCKET='vehicle-photos'
const PHOTO_TYPES=['image/jpeg','image/png']
const PHOTO_MAX_MB=5

const thisYear = new Date().getFullYear();
const years = Array.from({ length: thisYear - 1989 }, (_, i) => thisYear - i);

const commonMakes=[
    'Toyota',
    'Honda',
    'Ford',
    'Chevrolet',
    'Nissan',
    'Volkswagen',
    'Hyundai',
    'Kia',
    'JEEP',
    'Mazda'
]

function formatSize(bytes) {
    return bytes < 1024 ? `${bytes} bytes` : `${(bytes / 1024).toFixed(2)} KB`;

}

// function photoUrl(path){
//     if (!path) return null;
//     return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;   
// }

export default function AddVehicle({onDone}){
    const [departments,setDepartments]=useState([])
   // const [recent,setRecent]=useState([])
    const [form,setForm]=useState(emptyForm)
    const [touched,setTouched]=useState({})
    const [status,setStatus]=useState({type:'idle',text:''})
    const [photo,setPhoto]=useState(null)
    const [photoError,setPhotoError]=useState('')
    const [dragging,setDragging]=useState(false)
    const fileInputRef=useRef(null)

    async function load(){
        const {data,error}=await
            supabase.from('departments').select('id,name').order('name')
            if(error) setStatus({type:'error',text:'Error loading departments: '+error.message})
            setDepartments(data||[])
        
        
    }

    useEffect(()=>{
        load()
    },[])
    useEffect(()=>()=>{if(photo?.url) URL.revokeObjectURL(photo.url)},[photo])
    
        const errors=useMemo(()=>{
            const errs={}
            if(!form.department_id) errs.department_id='Seleccione un departamento'
            if( !form.manufacturer) errs.manufacturer='Ingrese el fabricante'
            if(!form.model) errs.model='Ingrese el modelo'
            if(!form.year) errs.year='Seleccione el año'
            if(!form.license_plate) errs.license_plate='Ingrese la matrícula'
                if(!form.vin) errs.vin='Ingrese el VIN'
                else if(form.vin.length!==VIN_LENGTH) errs.vin=`El VIN debe tener ${VIN_LENGTH} caracteres`
                else if(!VIN_REGEX.test(form.vin)) errs.vin='El VIN contiene caracteres inválidos'
            
            return errs
        },[form])
        const isValid=Object.keys(errors).length===0
        const showErrors=Object.keys(touched).length>0 && !isValid

        const set=(key)=>(errs)=>{
            let value=errs.target.value
            if(key=='license_plate') value=value.toUpperCase().replace(/[^A-Z0-9]/g,'')
            if(key=='vin') value=value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,VIN_LENGTH)
            setForm(f=>({...f,[key]:value}))
            if(status.type!=='idle') setStatus({type:'idle',text:''})
        }
        const blur=(key)=>()=>{setTouched(t=>({...t,[key]:true}))}

        function pickPhoto(file){
            if(!file) return
            if(!PHOTO_TYPES.includes(file.type)){
                setPhotoError('Formato de archivo no válido. Solo se permiten imágenes JPEG y PNG.')
                return
            }
            if(file.size>PHOTO_MAX_MB*1024*1024){
                setPhotoError('El archivo es demasiado grande. Tamaño máximo permitido: '+PHOTO_MAX_MB+' MB')
                return
            }
            setPhoto({file,url:URL.createObjectURL(file)})
            setPhotoError('')
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
            setTouched({department_id:true,manufacturer:true,model:true,year:true,license_plate:true,vin:true})
            if(!isValid) return
            setStatus({type:'saving',text:'Guardando vehículo...'})
            const license_plate=form.license_plate.toUpperCase().replace(/[^A-Z0-9]/g,'')
            let imagePath=null
            if(photo){
                const ext=photo.file.name.split('.').pop().toLowerCase()
                imagePath=`${license_plate}-${Date.now()}.${ext}`
                const {error:uploadError}=await supabase.storage.from(PHOTO_BUCKET).upload(imagePath,photo.file)
                if(uploadError){
                    setStatus({type:'error',text:`Error al subir la foto: ${uploadError.message}`})
                    return
                }
            }
            const{error}=await supabase.from('vehicles').insert({
                department_id:Number(form.department_id),
                manufacturer:form.manufacturer.trim().replace(/\b\w/g,c=>c.toUpperCase()),
                model:form.model.trim(),
                year:form.year ? Number(form.year) : null,
                license_plate:license_plate,
                vin:form.vin,
                image_path:imagePath
            })
            if(error){
                if (imagePath) await supabase.storage.from(PHOTO_BUCKET).remove([imagePath])
                let text = 'No se pudo guardar el vehículo.'
                if(error.code==='23505') text='Ya existe un vehículo con la misma matrícula o VIN.'
                setStatus({type:'error',text})
                return
            }
            setStatus({type:'success',text:'Vehículo guardado correctamente.'})
            setForm(emptyForm)
            setTouched({})
            removePhoto()
        }

        function handleClear(){
            setForm(emptyForm)
            setTouched({})
            setStatus({type:'idle',text:''})
            removePhoto()
        }

       // const deptName=departments.find(d=>d.id===form.department_id)?.name||''
        //const hasPreview=form.manufacturer||form.model||form.year||form.license_plate||form.vin||photo  
        const saving=status.type==='saving'

        return(
            <div className="av">
                <div className="av-heading">
                    <div>
                    <h1>Agregar Vehículo</h1>
                    <p>Registra un vehiculo nuevo en la flota municipal.</p>
                </div>
                {onDone &&(
                    <button type="button" className="av-btn av-btn-secondary" onClick={onDone}>
                        Volver al inicio
                    </button>
                )}
            </div>
                <form className="av-card" onSubmit={handleSubmit} noValidate>
                    <h2 className="av-card-title">Información del Vehículo</h2>

                    <Field id="department_id" label="Departamento" error={errors.department_id} touched={touched.department_id}>
                        <select
                            id="department_id"
                            value={form.department_id}
                            onChange={set('department_id')}
                            onBlur={blur('department_id')}
                            aria-invalid={!!errors.department_id}
                            aria-describedby="department_id-error"
                        >
                            <option value="">Seleccione un departamento</option>
                            {departments.map(d=>(
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </Field>

                    <div className="av-row">
                        <Field id="manufacturer" label="Fabricante" error={errors.manufacturer} touched={touched.manufacturer}>
                            <input
                                type="text"
                                id="manufacturer"
                                value={form.manufacturer}
                                onChange={set('manufacturer')}
                                onBlur={blur('manufacturer')}
                                aria-invalid={!!errors.manufacturer}
                                aria-describedby="manufacturer-error"
                                list="common-makes"
                            />
                            <datalist id="common-makes">
                                {commonMakes.map(make=>(
                                    <option key={make} value={make}/>
                                ))}
                            </datalist>
                        </Field>
                        <Field id="model" label="Modelo" error={errors.model} touched={touched.model}>
                            <input
                                type="text"
                                id="model"
                                value={form.model}
                                onChange={set('model')}
                                onBlur={blur('model')}
                                aria-invalid={!!errors.model}
                                aria-describedby="model-error"
                            />
                        </Field>
                        </div>
                    <div className="av-row">
                        <Field id="year" label="Año" error={errors.year} touched={touched.year}>
                            <select
                                id="year"
                                value={form.year}
                                onChange={set('year')}
                                onBlur={blur('year')}
                                aria-invalid={!!errors.year}
                                aria-describedby="year-error"
                            >
                                <option value="">Seleccione un año</option>
                                {years.map(y=>(
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </Field>
                        <Field id="license_plate" label="Matrícula" error={errors.license_plate} touched={touched.license_plate}>
                            <input
                                type="text"
                                id="license_plate"
                                value={form.license_plate}
                                onChange={set('license_plate')}
                                onBlur={blur('license_plate')}
                                aria-invalid={!!errors.license_plate}
                                aria-describedby="license_plate-error"
                            />
                        </Field>
                    </div>
                    <Field id="vin" label="VIN" error={errors.vin} touched={touched.vin}>
                        <input
                            type="text"
                            id="vin"
                            value={form.vin}
                            onChange={set('vin')}
                            onBlur={blur('vin')}
                            aria-invalid={!!errors.vin}
                            aria-describedby="vin-error"
                        />
                    </Field>
                    <div className={`av-field av-photo-field ${photoError ? 'has-error' : ''}`}>
                        <label htmlFor="photo">Foto del vehículo (opcional)</label>
                        <div
                            className={`av-photo-dropzone ${dragging?'dragging':''}`}
                            onDragOver={(e)=>{e.preventDefault();setDragging(true)}}
                            onDragLeave={(e)=>{e.preventDefault();setDragging(false)}}
                            onDrop={onDrop}
                            onClick={()=>fileInputRef.current?.click()}
                        >
                            {photo ? (
                                <div className="av-photo-preview">
                                    <img src={photo.url} alt="Vista previa" />
                                    <button type="button" className="av-btn av-btn-secondary" onClick={(e)=>{e.stopPropagation();removePhoto()}}>
                                        <X size={16} /> Eliminar
                                    </button>
                                </div>
                            ) : (
                                <div className="av-photo-placeholder">
                                    <ImagePlus size={32} />
                                    <p>Arrastra y suelta una foto aquí, o haz clic para seleccionar un archivo.</p>
                                    <p>(Formatos: JPEG, PNG. Tamaño máximo: {PHOTO_MAX_MB} MB)</p>
                                </div>
                            )}
                            <input
                                type="file"
                                id="photo"
                                accept={PHOTO_TYPES.join(',')}
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={(e) => pickPhoto(e.target.files[0])}
                            />
                        </div>
                        {photoError && <p className="av-error">{photoError}</p>}
                    </div>
                    {status.type==='error' && <div className="av-alert av-alert-error"><AlertCircle size={16} /> {status.text}</div>
                    }
                    {status.type==='success' && <div className="av-alert av-alert-ok"><CheckCircle2 size={16} /> {status.text}</div>
                    }

                    <div className="av-actions">
                        <button type="submit" className="av-btn av-btn-primary" disabled={saving}>
                            {saving ? 'Guardando...' : 'Guardar Vehículo'}

                        </button>
                        <button type="button" className="av-btn av-btn-secondary" onClick={handleClear} disabled={saving}>
                            Limpiar
                        </button>   
                    </div>
                    
                    </form>
                    </div>




            

        )
        }

        function Field({id,label,error,touched,children}){
            const visibleError=touched && error
            return (
                <div className={`av-field ${visibleError?'has-error':''}`}>
                    <label htmlFor={id}>{label}</label>
                    {children}
                    {visibleError && <div className="av-error" id={`${id}-error`}>{error}</div>}
                </div>
            )
        }
            
