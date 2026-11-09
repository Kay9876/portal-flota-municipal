export function normalizeVin(vin) {
  return vin.trim().toUpperCase()
}

export function isValidVin(vin) {
  const normalized = normalizeVin(vin)

  return /^[A-HJ-NPR-Z0-9]{17}$/.test(normalized)
}
