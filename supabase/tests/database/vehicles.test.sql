begin;

create extension if not exists pgtap with schema extensions;
create temp table tap (n serial,line text);

insert into tap(line) select plan(12);

insert into public.departments (name) values ('TEST Department');

insert into tap(line) select has_table('public','vehicles','AV-UT-DB-01 vehicles table exists');
insert into tap(line) select col_is_pk('public','vehicles','id','AV-UT-DB-02 vehicles.id is the primary key of the table');
insert into tap(line) select has_column('public', 'vehicles', 'license_plate','AV-UT-DB-03 license_plate column exists');
insert into tap(line) select has_column('public', 'vehicles', 'vin','AV-UT-DB-04 vin column exists');
insert into tap(line) select has_column('public', 'vehicles', 'image_path','AV-UT-DB-05 image_path column exists');
insert into tap(line) select col_is_fk('public','vehicles','department_id','AV-UT-DB-06 department_id is a foreign key to departments');
insert into tap(line) select col_not_null('public','vehicles','license_plate','AV-UT-DB-07 license_plate is required');
insert into tap(line) select col_not_null('public','vehicles','department_id','AV-UT-DB-08 department_id is required');


insert into tap(line) select lives_ok(
    $$insert into public.vehicles (department_id, manufacturer,model,year,license_plate,vin)
        values((select id from public.departments where name = 'TEST Department'),
        'Toyota', 'Test', 2024, 'ABC567','1GNES16S136112426')$$,
        'AV-UT-DB-09 accepts a valid vehicle'
);

insert into tap(line) select throws_ok(
    $$insert into public.vehicles (department_id, manufacturer,model,year,license_plate,vin)
        values((select id from public.departments where name = 'TEST Department'),
        'Ford', 'Duplicate', 2020, 'ABC567','2GNES16S136112426')$$,
        '23505',null,
        'AV-UT-DB-10 rejects a duplicate license plate'
);

insert into tap(line) select throws_ok(
    $$insert into public.vehicles (department_id, manufacturer,model,year,license_plate,vin)
        values((select id from public.departments where name = 'TEST Department'),
        'Ford', 'Duplicate', 2020, 'ABC568','1GNES16S136112426')$$,
        '23505',null,
        'AV-UT-DB-11 rejects a duplicate VIN'
);

insert into tap(line) select throws_ok(
    $$insert into public.vehicles (department_id, manufacturer,model,year,license_plate,vin)
        values(999999999,'Ford', 'NoDept', 2020, 'ABC569','3GNES16S136112426')$$,
        '23503',null,
        'AV-UT-DB-12 rejects a nonexistent department'
);

insert into tap(line) select * from finish();
select line from tap order by n;
rollback;




