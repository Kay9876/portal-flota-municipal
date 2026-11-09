begin;

create extension if not exists pgtap with schema extensions;
create temp table tap (n serial, line text);
insert into tap(line) select plan(8);

insert into tap(line) select has_table('public', 'departments', 'CD-UT-DB-01 departments table exists');
insert into tap(line) select has_column('public', 'departments', 'name', 'CD-UT-DB-02 department name column exists');
insert into tap(line) select col_is_pk('public', 'departments', 'id', 'CD-UT-DB-03 department id is primary key');
insert into tap(line) select col_has_default('public', 'departments', 'created_at', 'CD-UT-DB-04 created_at has a default');

insert into public.departments (name) values ('CD-UT-DB Test Department');
insert into tap(line) select ok(
  exists(select 1 from public.departments where name = 'CD-UT-DB Test Department'),
  'CD-UT-DB-05 inserts a valid department'
);
insert into tap(line) select ok(
  (select id is not null from public.departments where name = 'CD-UT-DB Test Department'),
  'CD-UT-DB-06 assigns a department id'
);
insert into tap(line) select ok(
  (select created_at is not null from public.departments where name = 'CD-UT-DB Test Department'),
  'CD-UT-DB-07 assigns a creation timestamp'
);
insert into tap(line) select is(
  (select name from public.departments where name = 'CD-UT-DB Test Department'),
  'CD-UT-DB Test Department',
  'CD-UT-DB-08 stores the submitted department name'
);

insert into tap(line) select * from finish();
select line from tap order by n;
rollback;
