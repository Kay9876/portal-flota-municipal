import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { normalizeVin, isValidVin } from '../utils/vehicleInfo'

export default function VehicleGeneralTab({
vehicle,
statusLabel,
onVehicleUpdated
}) {

const [vinError, setVinError] = useState('')
const [formError, setFormError] = useState('')
const [isEditing, setIsEditing] = useState(false)
const [canEdit, setCanEdit] = useState(false)

const [formData, setFormData] = useState({
    license_plate: vehicle.license_plate || '',
    manufacturer: vehicle.manufacturer || '',
    model: vehicle.model || '',
    year: vehicle.year ?? '',
    department_id: String(vehicle.department_id ?? ''),
    is_active: vehicle.is_active,
    vin: vehicle.vin || '',
    total_mileage: vehicle.total_mileage ?? ''
})

const handleChange = (e) => {
    const { name, value } = e.target
    const updatedData = Object.assign({}, formData)

    updatedData[name] = name === 'is_active' ? value === 'true' : value

    setFormData(updatedData)
}

const handleCancel = () => {
    setFormData({
        license_plate: vehicle.license_plate || '',
        manufacturer: vehicle.manufacturer || '',
        model: vehicle.model || '',
        year: vehicle.year ?? '',
        department_id: String(vehicle.department_id ?? ''),
        is_active: vehicle.is_active,
        vin: vehicle.vin || '',
        total_mileage: vehicle.total_mileage ?? ''
    })

    setIsEditing(false)
    setVinError('')
    setFormError('')
}

const handleSave = async (e) => {
    e.preventDefault()

    // const vin = formData.vin.trim().toUpperCase()

    // if (vin !== '' && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    //     setVinError('El VIN debe contener 17 caracteres válidos.')
    //     return
    // }

    // setVinError('')

    if (!canEdit) return

    
    const requiredFields = [
        ['license_plate', 'la tablilla'],
        ['manufacturer', 'la marca'],
        ['model', 'el modelo'],
        ['year', 'el año'],
        ['vin', 'el VIN'],
        ['total_mileage', 'el millaje total']
    ]

    setFormError('')

    for (const [field, label] of requiredFields) {
        if (String(formData[field] ?? '').trim() === '') {
            setFormError(`Debe ingresar ${label} del vehículo.`)
            return
        }
    }

    if (
        formData.year !== '' &&
        (!Number.isInteger(Number(formData.year)) || Number(formData.year) <= 0)
    ) {
        setFormError('El año debe ser un número entero positivo.')
        return
    }

    
    if (
        formData.total_mileage !== '' &&
        (!Number.isFinite(Number(formData.total_mileage)) ||
        Number(formData.total_mileage) < 0)
    ) {
        setFormError('El millaje no puede ser negativo.')
        return
    }

    const vin = normalizeVin(formData.vin)

    if (!isValidVin(formData.vin)) {
        setVinError('El VIN debe contener 17 caracteres válidos.')
        return
    }
    setVinError('')

    if (formData.department_id === '' || formData.is_active == null) {
        setFormError('Departamento o estado no seleccionado.')
        return
    }

    const updates = {
        license_plate: formData.license_plate.trim(),
        manufacturer: formData.manufacturer.trim(),
        model: formData.model.trim(),
        year: formData.year === '' ? null : Number(formData.year),
        department_id: Number(formData.department_id),
        is_active: formData.is_active,
        vin: vin || null,
        total_mileage: formData.total_mileage === '' ? null : Number(formData.total_mileage)
    }

    const { data, error } = await supabase
        .from('vehicles')
        .update(updates)
        .eq('id', vehicle.id)
        .select()
        .single()

    if (error) {
        setFormError('No se pudieron guardar los cambios del vehículo.')
        return
    }

    onVehicleUpdated(data)
    setIsEditing(false)
}

const [departments, setDepartments] = useState([])

useEffect(() => {
async function loadDepartments() {
    const { data, error } = await supabase
    .from('departments')
    .select('id, name')
    .order('id')

    if (error) {
    console.error('Error loading departments:', error)
    return
    }

    setDepartments(data || [])
}

loadDepartments()
}, [])

const currentDepartment = departments.find(
    (d) => String(d.id) === String(vehicle.department_id)
)

const vehicleDetails = [
    ['Tablilla', vehicle.license_plate],
    ['Marca', vehicle.manufacturer],
    ['Modelo', vehicle.model],
    ['Año', vehicle.year],
    ['Departamento', currentDepartment?.name || 'No registrado'],
    ['Estado', statusLabel],
    ['VIN', vehicle.vin],
    ['Millaje total', vehicle.total_mileage],
    ['ID', vehicle.id]
]

const editableFields = [
    ['Tablilla', 'license_plate', 'text'],
    ['Marca', 'manufacturer', 'text'],
    ['Modelo', 'model', 'text'],
    ['Año', 'year', 'number'],
    ['VIN', 'vin', 'text'],
    ['Millaje total', 'total_mileage', 'number'],
    ['Departamento', 'department_id', 'select'],
    ['Estado', 'is_active', 'select']
]

useEffect(() => {
    async function checkPermission() {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            setCanEdit(false)
            return
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('is_active')
            .eq('id', user.id)
            .maybeSingle()

        if (profile?.is_active !== true) {
            setCanEdit(false)
            return
        }

        const { data, error } = await supabase
            .from('user_permissions')
            .select('id')
            .eq('user_id', user.id)
            .eq('department_id', vehicle.department_id)
            .eq('can_update_vehicle', true)
            .limit(1)

        setCanEdit(!error && (data?.length ?? 0) > 0)
    }

    setCanEdit(false)
    checkPermission()
}, [vehicle.department_id])

return (
<section className="card vdi-information">
    <div className="vdi-general-header">
    <h2>Datos del vehículo</h2>
    {canEdit && (
        <button
            type="button"
            className="admin-button primary"
            onClick={() => setIsEditing(true)}>
            Editar
        </button>
    )}
    </div>

    <div className="vdi-details-grid">
    {vehicleDetails.map(([label, value]) => (
        <div className="vdi-detail" key={label}>
        <span className="vdi-label">{label}</span>
        <strong>{value ?? 'No registrado'}</strong>
        </div>
    ))}
    </div>

    {isEditing && canEdit && (
        <div className="vdi-modal-overlay">
            <div className="vdi-modal">
            <h2>Editar información del vehículo</h2>
            <form onSubmit={handleSave} noValidate>
                {formError && (
                    <p className="msg error" role="alert">
                        {formError}
                    </p>
                )}
                <div className="vdi-form-grid">
                {editableFields.map(([label, field, type]) => (
                    <label key={field}>
                    {label}
                    {type === 'select' ? (
                        <select
                            name={field}
                            value={field === 'is_active' && formData[field] === null ? '' : String(formData[field])}
                            onChange={handleChange}
                            required={field === 'is_active' || field === 'department_id'}
                        >
                        {field === 'department_id'
                            ? <>
                                <option value="" disabled>Seleccionar departamento</option>
                                {departments.map((d) => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </>
                            : <>
                                <option value="" disabled>Seleccionar estado</option>
                                <option value="true">Activo</option>
                                <option value="false">Fuera de servicio</option>
                            </>
                        }
                        </select>
                    ) : (
                        <>
                            <input
                                name={field}
                                type={type}
                                value={formData[field]}
                                onChange={handleChange}
                            />
                            {field === 'vin' && vinError && (
                                <span className="error-message">{vinError}</span>
                            )}
                        </>
                    )}
                    </label>
                ))}
                </div>
                    <div className="vdi-form-actions">
                        <button
                            type="button"
                            className="admin-button secondary"
                            onClick={handleCancel} >
                                Cancelar
                        </button>

                        <button type="submit" className="admin-button primary">
                            Guardar cambios
                        </button>
                    </div>
            </form>
            </div>
        </div>
    )}
</section>
)}