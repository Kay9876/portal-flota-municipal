begin; 

create extension if not exists pgtap with schema extensions;
create temp table tap (n serial, line text);

insert into tap(line) select plan(10);

insert into auth.users (id, raw_user_meta_data) values 
('cccccccc-0000-0000-0000-000000000001', '{"must_change_password": true}');


insert into tap(line) select has_column('public','profiles','first_name','LG-UT-DB-01 profiles.first_name column exists');
insert into tap(line) select has_column('public','profiles','is_active','LG-UT-DB-02 profiles.is_active column exists');
insert into tap(line) select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),'LG-UT-DB-03 row level security is enabled on profiles');
insert into tap(line) select ok(exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and cmd = 'SELECT'),'LG-UT-DB-04 profiles has a SELECT policy');
insert into tap(line) select has_column('auth','users','email','LG-UT-DB-05 auth.users.email column exists');
insert into tap(line) select has_column('auth','users','encrypted_password','LG-UT-DB-06 auth.users.encrypted_password column exists');
insert into tap(line) select has_column('auth','users','email_confirmed_at','LG-UT-DB-07 auth.users.email_confirmed_at column exists');
insert into tap(line) select has_column('auth','users','raw_user_meta_data','LG-UT-DB-08 auth.users.raw_user_meta_data column exists');
insert into tap(line) select has_column('auth','users','recovery_sent_at','LG-UT-DB-09 auth.users.recovery_sent_at column exists');
insert into tap(line) select is(
    (select (raw_user_meta_data->>'must_change_password')::boolean from auth.users where id = 'cccccccc-0000-0000-0000-000000000001'),
    true,
    'LG-UT-DB-10 the must_change_password flag is kept in the account metadata'
);

insert into tap(line) select * from finish();
select line from tap order by n;
rollback;