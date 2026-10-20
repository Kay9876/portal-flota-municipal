
drop table if exists public.document_templates cascade;

create table public.document_templates(
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  description text,
  target_table text not null,
  created_at timestamptz not null default now()
);

create table public.template_columns(
  id bigint generated always as identity primary key,
  template_id bigint not null references public.document_templates(id) on delete cascade,
  sort_order int not null,
  key text not null,
  label text not null,
  description text,
  data_type text not null,
  db_column text not null,
  required boolean not null default false
);

create table public.template_instructions(
  id bigint generated always as identity primary key,
  template_id bigint not null references public.document_templates(id) on delete cascade,
  sort_order int not null,
  text text not null
);

create table public.document_scans(
  id bigint generated always as identity primary key,
  template_id bigint not null references public.document_templates(id),
  vehicle_id bigint not null references public.vehicles(id),
  file_path text not null,
  uploaded_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.daily_register(
  id bigint generated always as identity primary key,
  scan_id bigint references public.document_scans(id) on delete set null,
  vehicle_id bigint not null references public.vehicles(id),
  departure_date date,
  driver_name text,
  user_department text,
  destination text,
  departure_time time,
  departure_mileage int,
  arrival_time time,
  arrival_mileage int,
  has_signature boolean,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.document_templates disable row level security;
alter table public.template_columns disable row level security;
alter table public.template_instructions disable row level security;
alter table public.document_scans disable row level security;
alter table public.daily_register disable row level security;


insert into storage.buckets (id,name,public)
values('scans','scans',false)
on conflict (id) do nothing;


drop policy if exists scans_all on storage.objects;
create policy scans_all on storage.objects for all to authenticated 
  using (bucket_id='scans') with check (bucket_id='scans');

with t as (
  insert into public.document_templates (slug, name, description, target_table)
  values ('registro_diario',
          'Registro Diario de Movimiento de Vehículo',
          'Formulario físico del Municipio Autónomo de Vega Alta donde cada conductor anota sus viajes.',
          'daily_register')
  returning id
),
cols as (
  insert into public.template_columns
    (template_id, sort_order, key, label, description, data_type, db_column, required)
  select t.id, v.* from t, (values
    (1, 'fecha',           'Fecha',             'Columna FECHA, formato mm/dd/año, tal como está escrita',                             'date',    'departure_date',    true),
    (2, 'nombre',          'Nombre',            'Columna NOMBRE, escrito en letra de molde',                                           'text',    'driver_name',       true),
    (3, 'departamento',    'Departamento',      'Columna DEPTO. A UTILIZAR EL VEHÍCULO',                                               'text',    'user_department',   false),
    (4, 'lugar',           'Lugar / Propósito', 'Columna LUGAR A VISITAR/PROPÓSITO',                                                   'text',    'destination',       false),
    (5, 'hora_salida',     'Hora salida',       'Columna HORA DE SALIDA',                                                              'time',    'departure_time',    false),
    (6, 'millaje_salida',  'Millaje salida',    'PRIMERA columna MILLAJE DEL VEHÍCULO (la que sigue a HORA DE SALIDA), solo dígitos',  'integer', 'departure_mileage', false),
    (7, 'hora_regreso',    'Hora regreso',      'Columna HORA DE REGRESO',                                                             'time',    'arrival_time',      false),
    (8, 'millaje_regreso', 'Millaje regreso',   'SEGUNDA columna MILLAJE DEL VEHÍCULO (la que sigue a HORA DE REGRESO), solo dígitos', 'integer', 'arrival_mileage',   false),
    (9, 'tiene_firma',     'Firma',             'true si la columna FIRMA tiene una firma o marca escrita',                            'boolean', 'has_signature',     false)
  ) as v(sort_order, key, label, description, data_type, db_column, required)
  returning 1
)
insert into public.template_instructions (template_id, sort_order, text)
select t.id, v.* from t, (values
  (1, 'La foto puede estar rotada o de lado; léela en su orientación correcta.'),
  (2, 'Ignora el encabezado del formulario (Estado Libre Asociado, Municipio, Departamento, Vehículo, Tablilla) y el logo.'),
  (3, 'No incluyas la fila de títulos de las columnas.'),
  (4, 'Hay DOS columnas llamadas MILLAJE DEL VEHÍCULO: la primera es el millaje de salida y la segunda es el millaje de regreso.'),
  (5, 'Para la columna FIRMA no transcribas texto; indica en tiene_firma si hay una firma o marca.'),
  (6, 'No intentes leer las líneas de la tabla como texto. Extrae solo las filas que tengan datos escritos.'),
  (7, 'El millaje de regreso normalmente es mayor o igual al millaje de salida.')
) as v(sort_order, text);

