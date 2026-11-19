-- Auditor dashboard: only active global viewers may retrieve aggregates.
-- This function deliberately returns aggregates rather than unrestricted table rows.
create or replace function public.auditor_dashboard(p_start date, p_end date)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_global_viewer is true and is_active is true
  ) then
    raise exception 'Acceso exclusivo para visores globales' using errcode = '42501';
  end if;
  if p_start is null or p_end is null or p_start > p_end or p_end > current_date
     or p_start < current_date - interval '10 years' then
    raise exception 'Intervalo de fechas no válido' using errcode = '22023';
  end if;

  with department_totals as (
    select d.id, d.name, count(v.id)::integer as vehicle_count
    from public.departments d left join public.vehicles v on v.department_id = d.id
    group by d.id, d.name
  ),
  monthly as (
    select gs.month::date as month,
           coalesce(sum(fr.amount_dispatched) filter (
             where fr.dispatch_date >= gs.month::date
               and fr.dispatch_date < (gs.month + interval '1 month')::date
           ), 0)::numeric as total
    from generate_series(date_trunc('month', current_date) - interval '11 months',
                         date_trunc('month', current_date), interval '1 month') gs(month)
    left join public.fuel_register fr
      on fr.dispatch_date >= gs.month::date
     and fr.dispatch_date < (gs.month + interval '1 month')::date
    group by gs.month
  ),
  period_months as (
    select date_trunc('month', fr.dispatch_date)::date as month,
           sum(fr.amount_dispatched)::numeric as total
    from public.fuel_register fr
    where fr.dispatch_date between p_start and p_end
    group by 1
  )
  select jsonb_build_object(
    'departments', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'count', vehicle_count) order by name), '[]'::jsonb) from department_totals),
    'fuel_period', (select coalesce(jsonb_agg(jsonb_build_object('month', month, 'total', total) order by month), '[]'::jsonb) from period_months),
    'fuel_12_months', (select coalesce(jsonb_agg(jsonb_build_object('month', month, 'total', total) order by month), '[]'::jsonb) from monthly),
    'fuel_mean', (select coalesce(avg(total), 0) from monthly),
    'fuel_stddev', (select coalesce(stddev_pop(total), 0) from monthly)
  ) into result;
  return result;
end;
$$;

revoke all on function public.auditor_dashboard(date,date) from public, anon;
grant execute on function public.auditor_dashboard(date,date) to authenticated;
