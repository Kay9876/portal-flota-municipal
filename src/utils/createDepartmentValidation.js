export function normalizeDepartmentName(value) {
  return String(value ?? '').trim()
}

export function validateCreateDepartment(value, departments = []) {
  const name = normalizeDepartmentName(value)
  if (!name) return 'Escribe el nombre del departamento.'
  if (name.length > 100) return 'El nombre del departamento no puede exceder 100 caracteres.'
  if (departments.some(department =>
    normalizeDepartmentName(department.name).toLowerCase() === name.toLowerCase()
  )) return 'Ese departamento ya existe.'
  return null
}
