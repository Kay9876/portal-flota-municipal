create or replace function public.auditor_keys(p_start date, p_end date)
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

  with loans as (
    select k.kr_date, k.return_unknown, k.has_signature, v.department_id
    from public.key_register k
    join public.vehicles v on v.id = k.vehicle_id
    where k.kr_date between p_start and p_end
      and (global_view or v.department_id = own_department)
  ), months as (
    select gs.month::date as month,
           count(l.kr_date)::integer as total,
           count(l.kr_date) filter (where l.return_unknown is true)::integer as unknown_return,
           count(l.kr_date) filter (where l.has_signature is not true)::integer as no_signature
    from pg_catalog.generate_series(
      date_trunc('month', p_start::timestamp), date_trunc('month', p_end::timestamp), interval '1 month'
    ) gs(month)
    left join loans l on l.kr_date >= gs.month::date
      and l.kr_date < (gs.month + interval '1 month')::date
    group by gs.month
  ), departments as (
    select d.id, d.name, count(*)::integer as total
    from loans l
    join public.departments d on d.id = l.department_id
    where global_view
    group by d.id, d.name
  )
  select jsonb_build_object(
    'loans_by_month', (
      select coalesce(jsonb_agg(jsonb_build_object('month', m.month, 'total', m.total) order by m.month), '[]'::jsonb)
      from months m
    ),
    'control_by_month', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'month', m.month, 'total', m.total, 'unknown_return', m.unknown_return, 'no_signature', m.no_signature
      ) order by m.month), '[]'::jsonb)
      from months m
    ),
    'by_department', (
      select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'total', x.total) order by x.total desc, x.name), '[]'::jsonb)
      from departments x
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.auditor_keys(date, date) from public, anon;
grant execute on function public.auditor_keys(date, date) to authenticated;