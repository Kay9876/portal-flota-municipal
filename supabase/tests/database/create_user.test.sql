begin;

create extension if not exists pgtap with schema extensions;
create temp table tap (n serial, line text);

insert into tap(line) select plan(10);

insert into public.departments (name) values ('CU-UT-DB Department');

-- Supabase Auth creates the corresponding public.profiles row through the
-- project's auth-user trigger.
insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
    'c1000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'cu-ut-db-01@example.test', '',
    now(), '{}'::jsonb, '{"first_name":"Test"}'::jsonb, now(), now()
);

insert into tap(line) select has_table('public','profiles','CU-UT-DB-01 profiles table exists');
insert into tap(line) select has_column('public','profiles','first_name','CU-UT-DB-02 profiles.first_name exists');
insert into tap(line) select has_column('public','profiles','department_id','CU-UT-DB-03 profiles.department_id exists');
insert into tap(line) select col_is_fk('public','profiles','department_id','CU-UT-DB-04 profiles.department_id references departments');

insert into tap(line) select ok(
    exists(select 1 from public.profiles where id = 'c1000000-0000-4000-8000-000000000001'),
    'CU-UT-DB-05 auth user creation creates a profile'
);

insert into tap(line) select lives_ok(
    $$update public.profiles set
        first_name = 'Created', last_name = 'User',
        department_id = (select id from public.departments where name = 'CU-UT-DB Department'),
        is_admin = false, is_global_viewer = false, is_active = true
      where id = 'c1000000-0000-4000-8000-000000000001'$$,
    'CU-UT-DB-06 accepts valid profile data for a new user'
);

insert into tap(line) select is(
    (select first_name from public.profiles where id = 'c1000000-0000-4000-8000-000000000001'),
    'Created',
    'CU-UT-DB-07 saves the new user first name'
);

insert into tap(line) select lives_ok(
    $$insert into public.user_permissions
      (user_id, department_id, can_view_vehicle, can_create_vehicle, can_update_vehicle, granted_by)
      values (
        'c1000000-0000-4000-8000-000000000001',
        (select id from public.departments where name = 'CU-UT-DB Department'),
        true, false, true, 'c1000000-0000-4000-8000-000000000001'
      )$$,
    'CU-UT-DB-08 accepts department permissions for the created user'
);

insert into tap(line) select ok(
    exists(select 1 from public.user_permissions
      where user_id = 'c1000000-0000-4000-8000-000000000001'
        and can_view_vehicle = true and can_update_vehicle = true),
    'CU-UT-DB-09 stores the selected vehicle permissions'
);

insert into tap(line) select throws_ok(
    $$insert into public.user_permissions
      (user_id, department_id, can_view_vehicle, can_create_vehicle, can_update_vehicle, granted_by)
      values (
        'c1000000-0000-4000-8000-000000000001', 999999999,
        true, false, false, 'c1000000-0000-4000-8000-000000000001'
      )$$,
    '23503', null,
    'CU-UT-DB-10 rejects permissions for a nonexistent department'
);

insert into tap(line) select * from finish();
select line from tap order by n;
rollback;
