alter table public.profiles add column if not exists is_director boolean default false;

begin;
create or replace function public.auditor_departments()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare global_view boolean; own_department bigint;
begin
  select p.is_global_viewer is true, p.department_id into global_view, own_department
  from public.profiles p where p.id = auth.uid() and p.is_active is true
    and (p.is_global_viewer is true or p.is_director is true);
  if not found or (not global_view and own_department is null) then
    raise exception 'Acceso restringido a directores y visores globales activos; los directores requieren departamento' using errcode = '42501';
  end if;
  if not global_view then
    return jsonb_build_array(
      (select jsonb_build_object('id', d.id, 'name', d.name, 'count', (select count(*) from public.vehicles v where v.department_id = own_department)) from public.departments d where d.id = own_department),
      jsonb_build_object('id', 'rest', 'name', 'Resto de la Flota', 'count', (select count(*) from public.vehicles v where v.department_id <> own_department))
    );
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
declare result jsonb; global_view boolean; own_department bigint;
begin
  select p.is_global_viewer is true, p.department_id into global_view, own_department
  from public.profiles p where p.id = auth.uid() and p.is_active is true
    and (p.is_global_viewer is true or p.is_director is true);
  if not found or (not global_view and own_department is null) then
    raise exception 'Acceso restringido a directores y visores globales activos; los directores requieren departamento' using errcode = '42501';
  end if;
  if p_start is null or p_end is null or p_start > p_end or p_end > current_date
    or p_start < current_date - interval '10 years' or (p_top is not null and p_top not in (5,10))
    or (p_department_id is not null and p_department_id < 1) then
    raise exception 'Filtros no válidos' using errcode = '22023';
  end if;

  if not global_view then
    if p_department_id is not null and p_department_id <> own_department then
      raise exception 'Departamento no autorizado' using errcode = '42501';
    end if;
    p_department_id := own_department;
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
    select gs.month::date as month, coalesce(sum(sf.amount_dispatched),0)::numeric as total
    from pg_catalog.generate_series(date_trunc('month', p_start::timestamp), date_trunc('month', p_end::timestamp), interval '1 month') gs(month)
    left join selected_fuel sf on sf.dispatch_date >= gs.month::date and sf.dispatch_date < (gs.month + interval '1 month')::date and sf.dispatch_date between p_start and p_end
    group by gs.month
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

create or replace function public.auditor_maintenance_status(p_start date, p_end date)
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
    or p_start < current_date - interval '10 years' then
    raise exception 'Filtros no válidos' using errcode = '22023';
  end if;

  with statuses(status, label, sort_order) as (
    values ('abierta'::text, 'Abierta'::text, 1),
           ('en_proceso'::text, 'En proceso'::text, 2),
           ('cerrada'::text, 'Cerrada'::text, 3)
  ), counts as (
    select case
      when m.status = 'nueva' then 'abierta'
      when m.status in ('agendada', 'en_taller', 'esperando_piezas') then 'en_proceso'
      when m.status in ('completada', 'cancelada') then 'cerrada'
    end as status, count(*)::integer as count
    from public.maintenance m
    join public.vehicles v on v.id = m.vehicle_id
    where (global_view or v.department_id = own_department)
      and m.created_at >= p_start::timestamptz
      and m.created_at < (p_end + 1)::timestamptz
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'status', s.status, 'label', s.label, 'count', coalesce(c.count, 0)
  ) order by s.sort_order), '[]'::jsonb)
  into result
  from statuses s left join counts c on c.status = s.status;

  return result;
end;
$$;

revoke all on function public.auditor_maintenance_status(date,date) from public, anon;
grant execute on function public.auditor_maintenance_status(date,date) to authenticated;

create or replace function public.auditor_fuel_departments(p_start date, p_end date)
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
    where (global_view or v.department_id = own_department)
      and fr.dispatch_date between p_start and p_end
    group by d.id, d.name
    having sum(fr.amount_dispatched) > 0
  ) x;

  return result;
end;
$$;

revoke all on function public.auditor_fuel_departments(date,date) from public, anon;
grant execute on function public.auditor_fuel_departments(date,date) to authenticated;

commit;
