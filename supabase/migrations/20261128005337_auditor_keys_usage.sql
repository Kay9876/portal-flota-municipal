create or replace function public.auditor_keys_usage(p_start date, p_end date, p_top integer default 20)
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

  if p_start is null or p_end is null or p_start > p_end or p_end > current_date
     or p_start < current_date - interval '10 years'
     or p_top is null or p_top < 1 or p_top > 200 then
    raise exception 'Filtros no válidos' using errcode = '22023';
  end if;

  with loans as (
    select k.vehicle_id, k.kr_date, k.driver_name, k.return_unknown, k.has_signature,
           case when k.return_unknown is not true and k.key_handover is not null
                then extract(epoch from (k.key_handover - k.key_pickup)) / 3600 end as hours,
           v.manufacturer, v.model, v.year, v.license_plate, v.department_id
    from public.key_register k
    join public.vehicles v on v.id = k.vehicle_id
    where k.kr_date between p_start and p_end
      and (global_view or v.department_id = own_department)
  ), by_vehicle as (
    select l.vehicle_id, min(l.manufacturer) as manufacturer, min(l.model) as model,
           min(l.year) as year, min(l.license_plate) as plate, min(d.name) as department,
           count(*)::integer as loans,
           round(coalesce(sum(l.hours), 0)::numeric, 1) as total_hours,
           round(avg(l.hours)::numeric, 1) as avg_hours,
           count(*) filter (where l.return_unknown is true)::integer as unknown_return,
           count(*) filter (where l.has_signature is not true)::integer as no_signature,
           max(l.kr_date) as last_loan
    from loans l
    left join public.departments d on d.id = l.department_id
    group by l.vehicle_id
    order by count(*) desc, l.vehicle_id
    limit p_top
  ), by_driver as (
    select min(trim(l.driver_name)) as driver,
           count(*)::integer as loans,
           count(distinct l.vehicle_id)::integer as vehicles,
           round(coalesce(sum(l.hours), 0)::numeric, 1) as total_hours,
           round(avg(l.hours)::numeric, 1) as avg_hours,
           count(*) filter (where l.return_unknown is true)::integer as unknown_return,
           count(*) filter (where l.has_signature is not true)::integer as no_signature,
           max(l.kr_date) as last_loan
    from loans l
    group by lower(trim(l.driver_name))
    order by count(*) desc, lower(trim(l.driver_name))
    limit p_top
  )
  select jsonb_build_object(
    'vehicles', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', v.vehicle_id, 'manufacturer', v.manufacturer, 'model', v.model, 'year', v.year,
        'plate', v.plate, 'department', v.department, 'loans', v.loans,
        'total_hours', v.total_hours, 'avg_hours', v.avg_hours,
        'unknown_return', v.unknown_return, 'no_signature', v.no_signature, 'last_loan', v.last_loan
      ) order by v.loans desc, v.vehicle_id), '[]'::jsonb) from by_vehicle v
    ),
    'drivers', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'driver', x.driver, 'loans', x.loans, 'vehicles', x.vehicles,
        'total_hours', x.total_hours, 'avg_hours', x.avg_hours,
        'unknown_return', x.unknown_return, 'no_signature', x.no_signature, 'last_loan', x.last_loan
      ) order by x.loans desc, lower(x.driver)), '[]'::jsonb) from by_driver x
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.auditor_keys_usage(date, date, integer) from public, anon;
grant execute on function public.auditor_keys_usage(date, date, integer) to authenticated;