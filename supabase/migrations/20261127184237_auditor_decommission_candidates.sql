-- Candidates for review for decommissioning, for the Panel Analítico.
-- One point per signal that applies (all signals weigh the same):
--   age        : vehicle older than p_age_years (current year - model year)
--   idle       : has trips in daily_register, but the last one is older than p_idle_days
--   mileage    : highest known mileage (vehicles.total_mileage or last arrival_mileage of the daily log) >= p_mileage
--   incidents  : at least one incident in the last 12 months
--   inactive   : vehicles.is_active is false
-- A vehicle without data for a signal (no trips, no mileage) gets no points for it; those are counted in the summary.
-- Access: active global viewers see every department, active directors only their own.
create or replace function public.auditor_decommission_candidates(
  p_age_years integer default 10,
  p_idle_days integer default 60,
  p_mileage integer default 150000,
  p_top integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb; global_view boolean; own_department bigint;
begin
  select p.is_global_viewer is true, p.department_id into global_view, own_department
  from public.profiles p where p.id = auth.uid() and p.is_active is true
    and (p.is_global_viewer is true or p.is_director is true);
  if not found or (not global_view and own_department is null) then
    raise exception 'Acceso restringido a directores y visores globales activos; los directores requieren departamento' using errcode = '42501';
  end if;

  if p_age_years is null or p_age_years < 1 or p_age_years > 100
     or p_idle_days is null or p_idle_days < 1 or p_idle_days > 3650
     or p_mileage is null or p_mileage < 1 or p_mileage > 10000000
     or p_top is null or p_top < 1 or p_top > 100 then
    raise exception 'Filtros no válidos' using errcode = '22023';
  end if;

  with scoped as (
    select v.id, v.license_plate, v.manufacturer, v.model, v.year, v.department_id, v.is_active, v.total_mileage
    from public.vehicles v
    where global_view or v.department_id = own_department
  ), trips as (
    select d.vehicle_id, max(d.departure_date) as last_trip, max(d.arrival_mileage) as last_mileage
    from public.daily_register d
    join scoped s on s.id = d.vehicle_id
    group by d.vehicle_id
  ), inc as (
    select s.id as vehicle_id, count(*)::integer as incidents
    from scoped s
    join public.incident_reports ir
      on ir.vehicle_id = s.id
      or (ir.vehicle_id is null and upper(ir.plate) = upper(s.license_plate))
    where ir.created_at >= current_date - interval '12 months'
    group by s.id
  ), calc as (
    select s.id, s.license_plate, s.manufacturer, s.model, s.year, s.is_active,
           dep.name as department_name,
           case when s.year is null then null else extract(year from current_date)::integer - s.year end as age_years,
           t.last_trip,
           greatest(s.total_mileage, t.last_mileage) as mileage,
           coalesce(i.incidents, 0) as incidents
    from scoped s
    left join public.departments dep on dep.id = s.department_id
    left join trips t on t.vehicle_id = s.id
    left join inc i on i.vehicle_id = s.id
  ), flagged as (
    select c.*,
           coalesce(c.age_years >= p_age_years, false) as f_age,
           coalesce(c.last_trip < current_date - p_idle_days, false) as f_idle,
           coalesce(c.mileage >= p_mileage, false) as f_mileage,
           c.incidents > 0 as f_incidents,
           c.is_active is false as f_inactive
    from calc c
  ), scored as (
    select f.*, (f.f_age::integer + f.f_idle::integer + f.f_mileage::integer
                 + f.f_incidents::integer + f.f_inactive::integer) as score
    from flagged f
  ), top_rows as (
    select * from scored where score > 0
    order by score desc, age_years desc nulls last, license_plate
    limit p_top
  )
  select jsonb_build_object(
    'total_vehicles', (select count(*)::integer from scored),
    'with_points', (select count(*)::integer from scored where score > 0),
    'without_mileage', (select count(*)::integer from scored where mileage is null),
    'without_trips', (select count(*)::integer from scored where last_trip is null),
    'candidates', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id,
        'plate', t.license_plate,
        'manufacturer', t.manufacturer,
        'model', t.model,
        'year', t.year,
        'department', t.department_name,
        'age_years', t.age_years,
        'mileage', t.mileage,
        'last_trip', t.last_trip,
        'incidents', t.incidents,
        'is_active', t.is_active,
        'f_age', t.f_age, 'f_idle', t.f_idle, 'f_mileage', t.f_mileage,
        'f_incidents', t.f_incidents, 'f_inactive', t.f_inactive,
        'score', t.score
      ) order by t.score desc, t.age_years desc nulls last, t.license_plate), '[]'::jsonb)
      from top_rows t
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.auditor_decommission_candidates(integer, integer, integer, integer) from public, anon;
grant execute on function public.auditor_decommission_candidates(integer, integer, integer, integer) to authenticated;