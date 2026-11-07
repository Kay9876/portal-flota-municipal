import { describe, it, expect } from 'vitest'
import { normalizeDepartmentName, validateCreateDepartment } from './createDepartmentValidation'

describe('Create Department validation', () => {
  const departments = [{ id: 1, name: 'Obras Públicas' }, { id: 2, name: 'Finanzas' }]

  it('CD-UT-FE-01 accepts a valid new department name', () => {
    expect(validateCreateDepartment('Recursos Humanos', departments)).toBeNull()
  })
  it('CD-UT-FE-02 rejects an empty name', () => {
    expect(validateCreateDepartment('', departments)).toBe('Escribe el nombre del departamento.')
  })
  it('CD-UT-FE-03 rejects whitespace-only names', () => {
    expect(validateCreateDepartment('   ', departments)).toBe('Escribe el nombre del departamento.')
  })
  it('CD-UT-FE-04 trims leading and trailing whitespace', () => {
    expect(normalizeDepartmentName('  Recursos Humanos  ')).toBe('Recursos Humanos')
  })
  it('CD-UT-FE-05 rejects an exact duplicate', () => {
    expect(validateCreateDepartment('Finanzas', departments)).toBe('Ese departamento ya existe.')
  })
  it('CD-UT-FE-06 rejects duplicates ignoring case and whitespace', () => {
    expect(validateCreateDepartment('  oBRAS pÚBLICAS ', departments)).toBe('Ese departamento ya existe.')
  })
  it('CD-UT-FE-07 accepts a name with exactly 100 characters', () => {
    expect(validateCreateDepartment('A'.repeat(100), departments)).toBeNull()
  })
  it('CD-UT-FE-08 rejects a name longer than the input maxLength', () => {
    expect(validateCreateDepartment('A'.repeat(101), departments)).toBe('El nombre del departamento no puede exceder 100 caracteres.')
  })
})
