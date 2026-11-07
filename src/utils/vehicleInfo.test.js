import { describe, it, expect } from 'vitest'
import { normalizeVin, isValidVin } from './vehicleInfo'

describe('Vehicle Info - VIN Validation', () => {
  it('VI-UT-FE-01 accepts a valid VIN', () => {
    expect(isValidVin('1HGCM82633A004352')).toBe(true)
  })

  it('VI-UT-FE-02 rejects a short VIN', () => {
    expect(isValidVin('12345')).toBe(false)
  })

  it('VI-UT-FE-03 rejects invalid VIN characters', () => {
    expect(isValidVin('1HGCM82633I004352')).toBe(false)
  })

  it('VI-UT-FE-04 converts lowercase VIN to uppercase', () => {
    expect(normalizeVin('1hgcm82633a004352'))
      .toBe('1HGCM82633A004352')
  })

  it('VI-UT-FE-05 removes surrounding spaces', () => {
    expect(normalizeVin('  1HGCM82633A004352  '))
      .toBe('1HGCM82633A004352')
  })

  it('VI-UT-FE-06 rejects an empty VIN', () => {
    expect(isValidVin('')).toBe(false)
})
})
