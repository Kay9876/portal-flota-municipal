begin;

create extension if not exists pgtap with schema extensions;
create temp table tap (n serial,line text);

insert into tap(line) select plan(10);

insert into public.departments (name) values ('Dept A'), ('Dept B');

insert into public.vehicles (department_id, manufacturer,model,year,license_plate,vin) values
((select id from public.departments where name = 'Dept A'), 'Toyota', 'Camry', 2020, 'VLT123', '1GNES16S136112426'), 
((select id from public.departments where name = 'Dept A'), 'Honda', 'Civic', 2021, 'VLT456', '2GNES16S136112426'), 
((select id from public.departments where name = 'Dept B'), 'Ford', 'F-150', 2022, 'VLT789', '3GNES16S136112426');

insert into public.profiles (id, first_name, is_admin, is_global_viewer) values
    ('aaaaaaaa-0000-0000-0000-000000000001', 'Global Viewer', false, true),
    ('aaaaaaaa-0000-0000-0000-000000000002', 'Dept A User', false, false),
    ('aaaaaaaa-0000-0000-0000-000000000003', 'Dept B User', false, false),
    ('aaaaaaaa-0000-0000-0000-000000000004', 'No View User', false, false);

insert into public.user_permissions (user_id, department_id, can_view_vehicle, can_create_vehicle, can_update_vehicle, granted_at) values
    ('aaaaaaaa-0000-0000-0000-000000000002', (select id from public.departments where name = 'Dept A'), true, false, false, now()),
    ('aaaaaaaa-0000-0000-0000-000000000003', (select id from public.departments where name = 'Dept B'), true, false, false, now()),
    ('aaaaaaaa-0000-0000-0000-000000000004', (select id from public.departments where name = 'Dept A'), false, false, false, now());


insert into tap(line) select has_function('public','has_permission',array['bigint','text'],'VL-UT-DB-01 has_permission(dept, action) function exists');
insert into tap(line) select has_function('public','is_admin',array[]::text[],'VL-UT-DB-02 is_admin() function exists');
insert into tap(line) select ok((select relrowsecurity from pg_class where oid = 'public.vehicles'::regclass),'VL-UT-DB-03 row level security is enabled on vehicles');
insert into tap(line) select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicles' and cmd = 'SELECT'),'VL-UT-DB-04 vehicles has a SELECT policy');
insert into tap(line) select has_column('public','profiles','is_global_viewer','VL-UT-DB-05 profiles.is_global_viewer column exists');
insert into tap(line) select has_column('public','user_permissions','can_view_vehicle','VL-UT-DB-06 user_permissions.can_view_vehicle column exists');


select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001"}', true);
insert into tap(line) select is(
    array[public.has_permission((select id from public.departments where name = 'Dept A'), 'view'),
          public.has_permission((select id from public.departments where name = 'Dept B'), 'view')],
    array[true,true],
    'VL-UT-DB-07 global viewer can view Dept A and Dept B'
);

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002"}', true);
insert into tap(line) select is(
    array[public.has_permission((select id from public.departments where name = 'Dept A'), 'view'),
          public.has_permission((select id from public.departments where name = 'Dept B'), 'view')],
    array[true,false],
    'VL-UT-DB-08 Dept A user can only view Dept A'
);

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003"}', true);
insert into tap(line) select is(
    array[public.has_permission((select id from public.departments where name = 'Dept A'), 'view'),
          public.has_permission((select id from public.departments where name = 'Dept B'), 'view')],
    array[false,true],
    'VL-UT-DB-09 Dept B user can only view Dept B'
);

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000004"}', true);
insert into tap(line) select is(
    array[public.has_permission((select id from public.departments where name = 'Dept A'), 'view'),
          public.has_permission((select id from public.departments where name = 'Dept B'), 'view')],
    array[false,false],
    'VL-UT-DB-10 user with can_view_vehicle = false cannot view any department'
);

insert into tap(line) select * from finish();
select line from tap order by n;
rollback;