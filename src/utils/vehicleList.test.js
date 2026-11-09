import {describe, it, expect} from 'vitest'
import {deptName,isVehicleActive,canCreateVehicle,getDepartmentOptions,filterVehicles} from "./vehicleList";

const vehicles=[
    {id:1, department_id:1, departments:{name:'Obras Públicas'}, manufacturer:'Toyota', model:'Camry', year:2020, license_plate:'ABC123', is_active:true},
    {id:2, department_id:1, departments:{name:'Obras Públicas'}, manufacturer:'Honda', model:'Civic', year:2021, license_plate:'ABC456', is_active:false},
    {id:3, department_id:2, departments:{name:'Alcaldía'}, manufacturer:'Ford', model:'F-150', year:2022, license_plate:'XYZ789', is_active:true},
]

describe('deptName', () => {
    it('VL-UT-FE-01 shows the department name', () => {
        expect(deptName(vehicles[0])).toBe('Obras Públicas')
    })
    it('VL-UT-FE-02 falls back to the department id when the name is missing', () => {
        expect(deptName({department_id:7, departments:null})).toBe('Departamento 7')
    })
})

describe('isVehicleActive', () => {
    it('VL-UT-FE-03 a vehicle with is_active true is active', () => {
        expect(isVehicleActive({is_active:true})).toBe(true)
    })
    it('VL-UT-FE-04 a vehicle with is_active false is out of service', () => {
        expect(isVehicleActive({is_active:false})).toBe(false)
    })
    it('VL-UT-FE-05 a vehicle with no is_active value counts as active', () => {
        expect(isVehicleActive({is_active:null})).toBe(true)
    })
})

describe('canCreateVehicle', () => {
    it('VL-UT-FE-06 shows the add button when the user has can_create_vehicle', () => {
        expect(canCreateVehicle([{id:1}],{is_admin:false})).toBe(true)
    })
    it('VL-UT-FE-07 hides the add button when the user has no can_create_vehicle', () => {
        expect(canCreateVehicle([],{is_admin:false})).toBe(false)
    })
    it('VL-UT-FE-08 shows the add button to an admin without a permission row', () => {
        expect(canCreateVehicle([],{is_admin:true})).toBe(true)
    })
})

describe('getDepartmentOptions', () => {
    it('VL-UT-FE-09 builds one option per department without duplicates', () => {
        expect(getDepartmentOptions(vehicles)).toHaveLength(2)
    })
    it('VL-UT-FE-10 sorts the options by department name', () => {
        expect(getDepartmentOptions(vehicles)).toEqual([[2,'Alcaldía'],[1,'Obras Públicas']])
    })
})

describe('filterVehicles', () => {
    it('VL-UT-FE-11 returns every vehicle when there is no search or department filter', () => {
        expect(filterVehicles(vehicles,'','')).toHaveLength(3)
    })
    it('VL-UT-FE-12 keeps only the vehicles of the selected department', () => {
        expect(filterVehicles(vehicles,'','2').map((v)=>v.id)).toEqual([3])
    })
    it('VL-UT-FE-13 search by plate ignores case and extra spaces', () => {
        expect(filterVehicles(vehicles,'  abc456 ','').map((v)=>v.id)).toEqual([2])
    })
    it('VL-UT-FE-14 returns an empty list when nothing matches the search', () => {
        expect(filterVehicles(vehicles,'zzz','')).toEqual([])
    })
})