begin;

create extension if not exists pgtap with schema extensions;
create temp table tap (n serial, line text);

insert into tap(line) select plan(10);

insert into public.departments (name) values ('EU-UT-DB Department');

insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
    'e1000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'eu-ut-db-01@example.test', '',
    now(), '{}'::jsonb, '{"first_name":"Before"}'::jsonb, now(), now()
);

insert into tap(line) select ok(
    exists(select 1 from public.profiles where id = 'e1000000-0000-4000-8000-000000000001'),
    'EU-UT-DB-01 test user profile exists before editing'
);

insert into tap(line) select lives_ok(
    $$update public.profiles set
        first_name = 'Updated', last_name = 'Person',
        second_last_name = 'Example',
        department_id = (select id from public.departments where name = 'EU-UT-DB Department'),
        is_admin = false, is_global_viewer = true, is_active = true
      where id = 'e1000000-0000-4000-8000-000000000001'$$,
    'EU-UT-DB-02 updates valid user profile fields'
);

insert into tap(line) select is(
    (select first_name from public.profiles where id = 'e1000000-0000-4000-8000-000000000001'),
    'Updated',
    'EU-UT-DB-03 saves the updated first name'
);

insert into tap(line) select is(
    (select is_global_viewer from public.profiles where id = 'e1000000-0000-4000-8000-000000000001'),
    true,
    'EU-UT-DB-04 saves the updated global viewer role'
);

insert into tap(line) select is(
    (select department_id from public.profiles where id = 'e1000000-0000-4000-8000-000000000001'),
    (select id from public.departments where name = 'EU-UT-DB Department'),
    'EU-UT-DB-05 assigns the selected department'
);

insert into tap(line) select throws_ok(
    $$update public.profiles set department_id = 999999999
      where id = 'e1000000-0000-4000-8000-000000000001'$$,
    '23503', null,
    'EU-UT-DB-06 rejects a nonexistent department'
);

insert into tap(line) select lives_ok(
    $$insert into public.user_permissions
      (user_id, department_id, can_view_vehicle, can_create_vehicle, can_update_vehicle, granted_by)
      values (
        'e1000000-0000-4000-8000-000000000001',
        (select id from public.departments where name = 'EU-UT-DB Department'),
        true, false, false, 'e1000000-0000-4000-8000-000000000001'
      )$$,
    'EU-UT-DB-07 creates the selected department permission row'
);

insert into tap(line) select lives_ok(
    $$delete from public.user_permissions
      where user_id = 'e1000000-0000-4000-8000-000000000001'$$,
    'EU-UT-DB-08 removes previous permissions before replacement'
);

insert into tap(line) select is(
    (select count(*)::integer from public.user_permissions
      where user_id = 'e1000000-0000-4000-8000-000000000001'),
    0,
    'EU-UT-DB-09 confirms old permissions were removed'
);

insert into tap(line) select ok(
    exists(select 1 from public.profiles where id = 'e1000000-0000-4000-8000-000000000001'),
    'EU-UT-DB-10 editing user profile does not delete the account profile'
);

insert into tap(line) select * from finish();
select line from tap order by n;
rollback;
