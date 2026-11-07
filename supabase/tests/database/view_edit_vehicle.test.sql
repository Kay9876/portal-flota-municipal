begin;

create extension if not exists pgtap with schema extensions;
create temp table tap (n serial, line text);

insert into tap(line) select plan(10);

-- Create test department and vehicles
insert into public.departments (name)
values ('VI-UT-DB Test Department');

insert into public.vehicles
    (department_id, manufacturer, model, year, license_plate, vin, total_mileage, is_active)
values
    (
        (select id from public.departments where name = 'VI-UT-DB Test Department'),
        'Toyota', 'Corolla', 2020, 'VIT901', '1HGCM82633A004352', 25000, true
    ),
    (
        (select id from public.departments where name = 'VI-UT-DB Test Department'),
        'Honda', 'Civic', 2021, 'VIT902', '2HGCM82633A004352', 18000, true
    );

-- VI-UT-DB-01: vehicle can be retrieved
insert into tap(line) select ok(
    exists(
        select 1 from public.vehicles
        where license_plate = 'VIT901'
    ),
    'VI-UT-DB-01 retrieves existing vehicle information'
);

-- VI-UT-DB-02: update valid vehicle fields
insert into tap(line) select lives_ok(
    $$update public.vehicles
      set manufacturer = 'Hyundai',
          model = 'Elantra',
          total_mileage = 30000
      where license_plate = 'VIT901'$$,
    'VI-UT-DB-02 accepts valid vehicle updates'
);

-- VI-UT-DB-03: updated manufacturer is stored
insert into tap(line) select is(
    (select manufacturer from public.vehicles where license_plate = 'VIT901'),
    'Hyundai',
    'VI-UT-DB-03 saves the updated manufacturer'
);

-- VI-UT-DB-04: updated mileage is stored
insert into tap(line) select is(
    (select total_mileage from public.vehicles where license_plate = 'VIT901'),
    30000::numeric,
    'VI-UT-DB-04 saves the updated mileage'
);

-- VI-UT-DB-05: status can be updated
update public.vehicles
set is_active = false
where license_plate = 'VIT901';

insert into tap(line) select is(
    (select is_active from public.vehicles where license_plate = 'VIT901'),
    false,
    'VI-UT-DB-05 saves the updated vehicle status'
);

-- VI-UT-DB-06: updating one vehicle does not modify another
insert into tap(line) select is(
    (select manufacturer from public.vehicles where license_plate = 'VIT902'),
    'Honda',
    'VI-UT-DB-06 does not modify another vehicle'
);

-- VI-UT-DB-07: invalid department is rejected
insert into tap(line) select throws_ok(
    $$update public.vehicles
      set department_id = 999999999
      where license_plate = 'VIT901'$$,
    '23503', null,
    'VI-UT-DB-07 rejects a nonexistent department'
);

-- VI-UT-DB-08: duplicate VIN is rejected
insert into tap(line) select throws_ok(
    $$update public.vehicles
      set vin = '2HGCM82633A004352'
      where license_plate = 'VIT901'$$,
    '23505', null,
    'VI-UT-DB-08 rejects a duplicate VIN'
);

-- VI-UT-DB-09: duplicate license plate is rejected
insert into tap(line) select throws_ok(
    $$update public.vehicles
      set license_plate = 'VIT902'
      where license_plate = 'VIT901'$$,
    '23505', null,
    'VI-UT-DB-09 rejects a duplicate license plate'
);



-- VI-UT-DB-10: unauthorized user cannot edit vehicle information
create temp table vi_db10_result (
    affected_rows integer
);

do $$
declare
    affected integer;
begin
    perform set_config(
        'request.jwt.claim.sub',
        '00000000-0000-4000-8000-000000000010',
        true
    );

    execute 'set local role authenticated';

    update public.vehicles
    set manufacturer = 'UNAUTHORIZED CHANGE'
    where license_plate = 'VIT901';

    get diagnostics affected = row_count;

    execute 'reset role';

    insert into vi_db10_result values (affected);
end;
$$;

insert into tap(line) select is(
    (select affected_rows from vi_db10_result),
    0,
    'VI-UT-DB-10 unauthorized user cannot edit vehicle information'
);


insert into tap(line) select * from finish();
select line from tap order by n;

rollback;
