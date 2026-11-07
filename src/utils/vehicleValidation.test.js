import {describe, it, expect} from 'vitest'
import { normalizePlate,normalizeVin,formatManufacturer,validateVehicle } from "./vehicleValidation";

const validForm = {
    department_id: '1',
    manufacturer: 'Toyota',
    model: 'Corolla',
    year: '2020',
    license_plate: 'ABC123',
    vin: '1HGCM82633A123456'
}

describe('normalizePlate', () => {
    it('AV-UT-FE-01 removes non-alphanumeric characters and converts to uppercase', () => {
        expect(normalizePlate('abc-123')).toBe('ABC123')})
    it('AV-UT-FE-02 returns empty string for null or undefined', () => {
        expect(normalizePlate(null)).toBe('')
        expect(normalizePlate(undefined)).toBe('')
    })
})

describe('normalizeVin', () => {
    it('AV-UT-FE-03 removes non-alphanumeric characters, converts to uppercase, and truncates to 17 characters', () => {
        expect(normalizeVin('1hgcm-8263 3a123456xx')).toBe('1HGCM82633A123456')
    })
})

describe('formatManufacturer', () => {
    it('AV-UT-FE-04 trims whitespace and capitalizes first letter of each word', () => {
        expect(formatManufacturer('  toyota  ')).toBe('Toyota')
    })
})

describe('validateVehicle', () => {
    it('AV-UT-FE-05 returns no errors for valid form', () => {
        expect(validateVehicle(validForm)).toEqual({})
    })
    it('AV-UT-FE-06 returns errors for missing required fields', () => {
        const errs= validateVehicle({department_id: '', manufacturer: '', model: '', year: '', license_plate: '', vin: ''})
        expect(Object.keys(errs)).toEqual(['department_id', 'manufacturer', 'model', 'year', 'license_plate', 'vin'])
    })
    it('AV-UT-FE-07 returns error for invalid VIN length', () => {
        expect(validateVehicle({...validForm, vin: '123'}).vin).toMatch(/17/)
    })
    it('AV-UT-FE-08 returns error for invalid VIN characters', () => {
        expect(validateVehicle({...validForm, vin: '1HGCM82633A12345I'}).vin).toMatch(/inválido/)
    })
})