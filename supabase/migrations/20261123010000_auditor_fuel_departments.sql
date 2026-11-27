-- Fuel spending by department for the selected date range only.
-- SECURITY DEFINER is necessary to aggregate fleet-wide data, so enforce role inside RPC.
create or replace function public.auditor_fuel_departments(p_start date, p_end date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_global_viewer is true
      and p.is_active is true
  ) then
    raise exception 'Acceso exclusivo para visores globales' using errcode = '42501';
  end if;

  if p_start is null or p_end is null or p_start > p_end
     or p_end > current_date or p_start < current_date - interval '10 years' then
    raise exception 'Filtros no válidos' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', x.department_id, 'name', x.department_name, 'total', x.total
  ) order by x.total desc, x.department_name), '[]'::jsonb)
  into result
  from (
    select d.id as department_id,
           coalesce(d.name, 'Sin departamento') as department_name,
           sum(fr.amount_dispatched)::numeric as total
    from public.fuel_register fr
    left join public.vehicles v on v.id = fr.vehicle_id
    left join public.departments d on d.id = v.department_id
    where fr.dispatch_date between p_start and p_end
    group by d.id, d.name
    having sum(fr.amount_dispatched) > 0
  ) x;

  return result;
end;
$$;

revoke all on function public.auditor_fuel_departments(date,date) from public, anon;
grant execute on function public.auditor_fuel_departments(date,date) to authenticated;
