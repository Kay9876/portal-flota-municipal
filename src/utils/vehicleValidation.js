export const VIN_LENGTH = 17;
export const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/; // VIN regex pattern

export function normalizePlate(plate){
    return (plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function normalizeVin(vin){
    return (vin || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0,VIN_LENGTH)
}

export function formatManufacturer(text){
    return (text || '').trim().replace(/\b\w/g, c=> c.toUpperCase())
}

export function validateVehicle(form){
    const errs={}
    if(!form.department_id) errs.department_id = 'Seleccione un departamento'
    if(!form.manufacturer) errs.manufacturer = 'Ingrese un fabricante'
    if(!form.model) errs.model = 'Ingrese un modelo'
    if(!form.year) errs.year = 'Seleccione un año'
    if(!form.license_plate) errs.license_plate = 'Ingrese una tablilla'
    if(!form.vin) errs.vin = 'Ingrese un VIN'
    else if(form.vin.length !== VIN_LENGTH) errs.vin = `El VIN debe tener ${VIN_LENGTH} caracteres`
    else if(!VIN_REGEX.test(form.vin)) errs.vin = 'El VIN contiene caracteres inválidos'
    return errs
}

