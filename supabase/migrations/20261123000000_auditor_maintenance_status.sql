-- Read-only status summary, restricted to active global viewers.
-- Dates refer to when requests were created; status is their current status.
create or replace function public.auditor_maintenance_status(p_start date, p_end date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_global_viewer is true
      and p.is_active is true
  ) then
    raise exception 'Acceso exclusivo para visores globales' using errcode = '42501';
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
    where m.created_at >= p_start::timestamptz
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
