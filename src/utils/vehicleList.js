export function deptName(v){
    return v.departments?.name ?? `Departamento ${v.department_id}`
}

export function isVehicleActive(v){
    return v.is_active !== false
}

export function canCreateVehicle(permissionRows,profile){
    return (permissionRows?.length ?? 0) > 0 || profile?.is_admin === true
}

export function getDepartmentOptions(vehicles){
    const seen=new Map()
    vehicles.forEach((v)=>{
        if(!seen.has(v.department_id)) seen.set(v.department_id,deptName(v))
    })
    return [...seen].sort((a,b)=>a[1].localeCompare(b[1],'es'))
}

export function filterVehicles(vehicles,search,departmentId){
    const q=search.trim().toLowerCase()
    return vehicles.filter((v)=>{
        if(departmentId && String(v.department_id)!==departmentId) return false
        if(!q) return true
        return [v.license_plate,v.manufacturer,v.model,v.year,deptName(v)]
            .some((x)=>String(x ?? '').toLowerCase().includes(q))
    })
}