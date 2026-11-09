import {describe, it, expect} from 'vitest'
import {toNumber,toIsoDate,aiValueToForm,isEmpty,validateFuel,NO_VEHICLE} from "./fuelHelpers";

const validTicked={
    vehicle_id: '1',
    control_number: '49219',
    fuel_type: 'gasolina',
    dispatch_date: '2026-10-30',
    requesting_department: 'Obras Públicas',
    amount_requested: '50',
    requester_name: 'Juan Rivera',
    requester_license: '1234567',
    mileage: '45210',
    container_gallons: '',
    container_equipment: '',
    authorized_by: 'María López',
    authorized_signature: true,
    amount_dispatched: '50',
    liters:'45.20 ',
    employee_name: 'Carlos Pérez',
    employee_license: '7654321',
    employee_signature: true,
    supplier_name: 'Total',
    supplier_signature: true,

}

describe('toIsoDate', () => {
    it('FR-UT-FE-01 converts valid date formats to ISO', () => {
        expect(toIsoDate('10 / 04 / 2025')).toBe('2025-10-04')
    })
    it('FR-UT-FE-02 completes a 2-digit year', () => {
        expect(toIsoDate('10 / 04 / 25')).toBe('2025-10-04')
    })
    it('FR-UT-FE-03 returns empty string for invalid date', () => {
        expect(toIsoDate('13/40/2025')).toBe('')
        expect(toIsoDate('invalid')).toBe('')   
    })
})

describe('aiValueToForm', () => {
    it('FR-UT-FE-04 normalize the fuel type', () => {
        expect(aiValueToForm('GASOLINA','text','fuel_type')).toBe('gasolina')
        expect(aiValueToForm('DIESEL','text','fuel_type')).toBe('diesel')
    })
    it('FR-UT-FE-05 returns real booleans, not text', () => {
        expect(aiValueToForm(false, 'boolean','authorized_signature')).toBe(false)
        expect(aiValueToForm(true, 'boolean','authorized_signature')).toBe(true)
    })
    it('FR-UT-FE-06 returns null for empty values', () => {
        expect(aiValueToForm('','string')).toBe(null)
        expect(aiValueToForm(null,'string')).toBe(null)
    })
    it('FR-UT-FE-07 converts numbers to text for the inputs', () => {
        expect(aiValueToForm(45210,'integer','mileage')).toBe('45210')
    })
})

describe('isEmpty and toNumber', () => {
    it('FR-UT-FE-08 returns true for empty values', () => {
        expect(isEmpty('')).toBe(true)
        expect(isEmpty(false)).toBe(true)
        expect(isEmpty('ABC')).toBe(false)
    } )
    it('FR-UT-FE-09 converts empty string to null, and numbers to Number', () => {
        expect(toNumber('')).toBe(null)
        expect(toNumber('48.50')).toBe(48.5)
    })
})

describe('validateFuel', () => {
    it('FR-UT-FE-10 returns no errors for valid ticket', () => {
        expect(validateFuel(validTicked)).toEqual({})
    })
    it('FR-UT-FE-11 flags missing required fields', () => {
        const empty=Object.fromEntries(Object.keys(validTicked).map(k=>[k,typeof validTicked[k]==='boolean' ? false : '']))
        const errs=validateFuel(empty)
        for (const field of ['vehicle_id','control_number','dispatch_date','fuel_type','requesting_department','amount_requested','requester_name','requester_license','authorized_by','amount_dispatched','liters','employee_name','employee_license','supplier_name']){
            expect(errs[field]).toBeDefined()
        }
    })
    it('FR-UT-FE-12 required mileage for a vehicle', () => {
        expect(validateFuel({...validTicked,mileage:''}).mileage).toBeDefined()
    })
    it('FR-UT-FE-13 required container_gallons and container_equipment for a container', () => {
        const errs=validateFuel({...validTicked,vehicle_id:NO_VEHICLE,mileage:'',container_gallons:'',container_equipment:''})
        expect(errs.container_gallons).toBeDefined()
        expect(errs.container_equipment).toBeDefined()
        expect(errs.mileage).toBeUndefined()
    }   )
    it('FR-UT-FE-14 flags missing signatures', () => {
        expect(validateFuel({...validTicked,authorized_signature:false}).authorized_signature).toBeDefined()
        expect(validateFuel({...validTicked,employee_signature:false}).employee_signature).toBeDefined()
        expect(validateFuel({...validTicked,supplier_signature:false}).supplier_signature).toBeDefined()
    })
    it('FR-UT-FE-15 flags negative amounts', () => {
        expect(validateFuel({...validTicked,amount_dispatched:'-5'}).amount_dispatched).toMatch(/negativo/)
    })  
})