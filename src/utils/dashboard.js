import { isVehicleActive } from './vehicleList'

// Keeps only the vehicles of the selected department ('' means all of them).
export function filterByDepartment(vehicles, departmentId) {
    if (!departmentId) return vehicles
    return vehicles.filter((v) => String(v.department_id) === String(departmentId))
}

// Total, active and out-of-service vehicles. A vehicle with no value in is_active
// counts as active, the same rule the vehicle list uses.
export function countFleet(vehicles) {
    const total = vehicles.length
    const active = vehicles.filter(isVehicleActive).length
    return { total, active, outOfService: total - active }
}

// Vehicles that are in the workshop right now (is_in_maintenance = true).
export function countInWorkshop(vehicles) {
    return vehicles.filter((v) => v.is_in_maintenance === true).length
}

// Key records that were picked up and never handed back.
function isKeyOut(k) {
    return k.key_pickup != null && k.key_handover == null
}

// Vehicles whose key is out right now. A record that was never returned still counts,
// even if it is from days ago. Each vehicle is counted once.
export function countKeysOut(vehicles, keyRows) {
    const ids = new Set(vehicles.map((v) => v.id))
    const out = new Set()
    keyRows.forEach((k) => {
        if (isKeyOut(k) && ids.has(k.vehicle_id)) out.add(k.vehicle_id)
    })
    return out.size
}

// Today's date in Puerto Rico as YYYY-MM-DD.
export function todayInPuertoRico(now = new Date()) {
    return now.toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' })
}

// Yesterday's date in Puerto Rico as YYYY-MM-DD.
export function yesterdayInPuertoRico(now = new Date()) {
    const [y, m, d] = todayInPuertoRico(now).split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d - 1))
    return date.toISOString().slice(0, 10)
}

// Keys taken yesterday (kr_date) that were not handed back.
export function countKeysNotReturnedYesterday(vehicles, keyRows, now = new Date()) {
    const ids = new Set(vehicles.map((v) => v.id))
    const yesterday = yesterdayInPuertoRico(now)
    return keyRows.filter((k) => isKeyOut(k) && k.kr_date === yesterday && ids.has(k.vehicle_id)).length
}

// Adds n days (can be negative) to a YYYY-MM-DD date.
export function addDays(dateStr, n) {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

// Last N days in Puerto Rico time, today included: { start, end } as YYYY-MM-DD.
export function lastDaysRange(days = 30, now = new Date()) {
    const end = todayInPuertoRico(now)
    return { start: addDays(end, -(days - 1)), end }
}

function inRange(date, range) {
    return Boolean(date) && date >= range.start && date <= range.end
}

// Vehicle with the most trips (rows of daily_register) inside the range.
// Returns { vehicle, count } or null when there are no trips.
// A tie is broken by license plate so the result does not change between renders.
export function topVehicleByDepartures(vehicles, dailyRows, range) {
    const byId = new Map(vehicles.map((v) => [v.id, v]))
    const counts = new Map()
    dailyRows.forEach((r) => {
        if (byId.has(r.vehicle_id) && inRange(r.departure_date, range)) {
            counts.set(r.vehicle_id, (counts.get(r.vehicle_id) || 0) + 1)
        }
    })
    let best = null
    counts.forEach((count, id) => {
        const vehicle = byId.get(id)
        const better = !best
            || count > best.count
            || (count === best.count && String(vehicle.license_plate || '') < String(best.vehicle.license_plate || ''))
        if (better) best = { vehicle, count }
    })
    return best
}

// Fuel cost (amount_dispatched) per day for every day of the range, zeros included,
// so the line chart has one point per day. Returns { points: [{ date, total }], total }.
export function fuelCostByDay(vehicles, fuelRows, range) {
    const ids = new Set(vehicles.map((v) => v.id))
    const perDay = new Map()
    for (let d = range.start; d <= range.end; d = addDays(d, 1)) perDay.set(d, 0)
    fuelRows.forEach((r) => {
        if (ids.has(r.vehicle_id) && perDay.has(r.dispatch_date)) {
            perDay.set(r.dispatch_date, perDay.get(r.dispatch_date) + (Number(r.amount_dispatched) || 0))
        }
    })
    const points = [...perDay].map(([date, total]) => ({ date, total }))
    return { points, total: points.reduce((sum, p) => sum + p.total, 0) }
}