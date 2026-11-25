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
    return k.key_pickup != null && (k.key_handover == null || k.return_unknown === true)
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


export function dateInPuertoRico(timestamp) {
    return new Date(timestamp).toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' })
}

// Vehicles whose key is out right now: one entry per vehicle (its oldest open record),
// oldest first, so the keys that have been out the longest are at the top.
export function keysOutList(vehicles, keyRows) {
    const byId = new Map(vehicles.map((v) => [v.id, v]))
    const oldest = new Map()
    keyRows.forEach((k) => {
        if (!isKeyOut(k) || !byId.has(k.vehicle_id)) return
        const current = oldest.get(k.vehicle_id)
        if (!current || new Date(k.key_pickup) < new Date(current.key_pickup)) oldest.set(k.vehicle_id, k)
    })
    return [...oldest.values()]
        .map((k) => ({ vehicle: byId.get(k.vehicle_id), driver_name: k.driver_name || '', key_pickup: k.key_pickup }))
        .sort((a, b) => new Date(a.key_pickup) - new Date(b.key_pickup))
}

// Incidents saved with the department of the person who reported them (reporter_department_id).
// With no department selected every incident is kept, including those reported with no department.
export function incidentsForDepartment(incidents, departmentId) {
    if (!departmentId) return incidents
    return incidents.filter((i) => String(i.reporter_department_id) === String(departmentId))
}

// Incidents reported inside the date range (Puerto Rico time).
// Returns { count, latest } where latest has the newest `limit` incidents, newest first.
export function recentIncidents(incidents, range, limit = 5) {
    const inside = incidents.filter((i) => i.created_at && inRange(dateInPuertoRico(i.created_at), range))
    const sorted = [...inside].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    return { count: inside.length, latest: sorted.slice(0, limit) }
}

export function formatWhen(timestamp) {
    return new Date(timestamp).toLocaleString('es-PR', {
        timeZone: 'America/Puerto_Rico', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
    })
}


// Builds the chart points from the rows of fuel_cost_by_day: { day, department_id, total }.
// One point per day of the range, zeros included. departmentId '' means all departments.
export function fuelCostFromDaily(dailyTotals, departmentId, range) {
    const perDay = new Map()
    for (let d = range.start; d <= range.end; d = addDays(d, 1)) perDay.set(d, 0)
    dailyTotals.forEach((r) => {
        if (departmentId && String(r.department_id) !== String(departmentId)) return
        if (perDay.has(r.day)) perDay.set(r.day, perDay.get(r.day) + (Number(r.total) || 0))
    })
    const points = [...perDay].map(([date, total]) => ({ date, total }))
    return { points, total: points.reduce((sum, p) => sum + p.total, 0) }
}