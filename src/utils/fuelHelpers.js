export const NO_VEHICLE='none'

export function toNumber(value){
    return value==='' ? null : Number(value)
}

export function toIsoDate(text){
    const match=String(text||'').replace(/\s/g,'').match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
    if(!match) return ''
    let [,month,day,year]=match
    if(year.length===2) year='20'+year
    if(Number(month)<1 || Number(month)>12 || Number(day)<1 || Number(day)>31) return ''
    return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`
}

export function aiValueToForm(value,dataType,field){
    if(value==null||value===''||value===undefined) return null
    if(dataType==='date') return toIsoDate(value)||null
    if(dataType==='boolean') return value===true
    if(field==='fuel_type'){
        const fuel=String(value||'').toLowerCase()
        if(fuel.includes('gasolina')) return 'gasolina'
        if(fuel.includes('diesel')) return 'diesel'
        return null
    }
    return String(value).trim()
}

export function isEmpty(value){
    return value===''||value===false||value===null
}

const REQUIRED_FIELDS=
{
    control_number: 'Ingrese un número de control',
    dispatch_date: 'Ingrese una fecha de despacho',
    fuel_type: 'Seleccione un tipo de combustible',
    requesting_department: 'Ingrese un departamento solicitante',
    amount_requested: 'Ingrese la cantidad solicitada',
    requester_name: 'Ingrese el nombre del solicitante',
    requester_license: 'Ingrese la licencia del solicitante',
    authorized_by: 'Ingrese el nombre quien autoriza',
    amount_dispatched: 'Ingrese la cantidad despachada',
    liters: 'Ingrese la cantidad de litros',
    employee_name: 'Ingrese el nombre del empleado',
    employee_license: 'Ingrese la licencia del empleado',
    supplier_name: 'Ingrese el nombre del proveedor',
}

const SIGNATURES={
    authorized_signature: 'Falta la firma de quien autoriza',
    employee_signature: 'Falta la firma del empleado',
    supplier_signature: 'Falta la firma del suplidor',
}

const NUMBER_FIELDS=['amount_requested','amount_dispatched','liters','mileage','container_gallons']

export function validateFuel(form){
    const errs={}
    const isContainer=form.vehicle_id===NO_VEHICLE

    if(!form.vehicle_id) errs.vehicle_id='Seleccione un vehículo o contenedor'

    for(const [field,message] of Object.entries(REQUIRED_FIELDS)){
        if(!String(form[field]||'').trim()) errs[field]=message
    }

    if(form.vehicle_id && !isContainer && !String(form.mileage ?? '').trim()) errs.mileage='Ingrese el millaje del vehículo'
    if(isContainer && !String(form.container_gallons ?? '').trim()) errs.container_gallons='Ingrese la cantidad de galones del contenedor'
    if (isContainer && !String(form.container_equipment ?? '').trim()) errs.container_equipment='Ingrese el equipo del contenedor'

    for (const[field,message] of Object.entries(SIGNATURES)){
        if(!form[field]) errs[field]=message
    }
    for(const field of NUMBER_FIELDS){
        if (form[field] !== '' && form[field] != null && Number(form[field])<0) errs[field]='El valor no puede ser negativo'
    }
    return errs
}