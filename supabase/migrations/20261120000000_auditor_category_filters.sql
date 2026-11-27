-- Separate, restricted RPCs. Existing auditor_dashboard is left unchanged.
create or replace function public.auditor_departments()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid()
      and p.is_global_viewer is true and p.is_active is true
  ) then
    raise exception 'Acceso exclusivo para visores globales' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'count', d.vehicle_count) order by d.name, d.id), '[]'::jsonb)
    from (
      select dep.id, dep.name, count(v.id)::integer as vehicle_count
      from public.departments dep left join public.vehicles v on v.department_id = dep.id
      group by dep.id, dep.name
    ) d
  );
end;
$$;
revoke all on function public.auditor_departments() from public, anon;
grant execute on function public.auditor_departments() to authenticated;

create or replace function public.auditor_fuel_v2(
  p_start date, p_end date, p_department_id bigint default null, p_top integer default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id = auth.uid()
      and p.is_global_viewer is true and p.is_active is true
  ) then
    raise exception 'Acceso exclusivo para visores globales' using errcode = '42501';
  end if;
  if p_start is null or p_end is null or p_start > p_end or p_end > current_date
    or p_start < current_date - interval '10 years' or (p_top is not null and p_top not in (5,10))
    or (p_department_id is not null and p_department_id < 1) then
    raise exception 'Filtros no válidos' using errcode = '22023';
  end if;

  with eligible_vehicles as (
    select v.id from public.vehicles v
    where p_department_id is null or v.department_id = p_department_id
  ), ranked_vehicles as (
    select fr.vehicle_id, sum(fr.amount_dispatched) as total
    from public.fuel_register fr
    join eligible_vehicles ev on ev.id = fr.vehicle_id
    where fr.dispatch_date between p_start and p_end
    group by fr.vehicle_id
    order by total desc, fr.vehicle_id
    limit p_top
  ), selected_fuel as (
    select fr.dispatch_date, fr.amount_dispatched
    from public.fuel_register fr
    where (
      (p_department_id is null and p_top is null)
      or (p_top is null and fr.vehicle_id in (select id from eligible_vehicles))
      or (p_top is not null and fr.vehicle_id in (select vehicle_id from ranked_vehicles))
    )
  ), period_months as (
    select date_trunc('month', dispatch_date)::date as month, sum(amount_dispatched)::numeric as total
    from selected_fuel where dispatch_date between p_start and p_end group by 1
  ), last12 as (
    select gs.month::date as month, coalesce(sum(sf.amount_dispatched), 0)::numeric as total
    from pg_catalog.generate_series(
      date_trunc('month', current_date) - interval '11 months',
      date_trunc('month', current_date), interval '1 month'
    ) gs(month)
    left join selected_fuel sf on sf.dispatch_date >= gs.month::date
      and sf.dispatch_date < (gs.month + interval '1 month')::date
    group by gs.month
  ), average12 as (
    select avg(total)::numeric as mean, coalesce(var_pop(total), 0)::numeric as variance from last12
  )
  select jsonb_build_object(
    'fuel_period', (select coalesce(jsonb_agg(jsonb_build_object('month', month, 'total', total) order by month), '[]'::jsonb) from period_months),
    'fuel_variance_months', (select coalesce(jsonb_agg(jsonb_build_object('month', l.month, 'squared_deviation', power(l.total - a.mean, 2)) order by l.month), '[]'::jsonb) from last12 l cross join average12 a),
    'fuel_mean', (select mean from average12),
    'fuel_variance', (select variance from average12)
  ) into result;
  return result;
end;
$$;
revoke all on function public.auditor_fuel_v2(date,date,bigint,integer) from public, anon;
grant execute on function public.auditor_fuel_v2(date,date,bigint,integer) to authenticated;
