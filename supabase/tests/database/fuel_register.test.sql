begin;

create extension if not exists pgtap with schema extensions;
create temp table tap (n serial,line text);

insert into tap(line) select plan(25);

insert into public.departments (name) values ('TEST Department');
insert into public.vehicles (department_id,manufacturer,model,year,license_plate,vin)
values ((Select id from public.departments where name ='TEST Department'),
'Toyota', 'Test',2024,'XYZ123','1GNES16S136112426');


insert into tap(line) select has_table('public','fuel_register','FR-UT-DB-01 fuel_register table exists');
insert into tap(line) select col_is_pk('public','fuel_register','id','FR-UT-DB-02 fuel_register.id is the primary key of the table');
insert into tap(line) select col_is_fk('public','fuel_register','vehicle_id','FR-UT-DB-03 vehicle_id is the foreign key to vehicles table');
insert into tap(line) select col_is_fk('public','fuel_register','scan_id','FR-UT-DB-04 scan_id is the foreign key to document_scans');
insert into tap(line) select col_type_is('public','fuel_register','dispatch_date','date', 'FR-UT-DB-05 dispatch_date is a date type');
insert into tap(line) select col_type_is('public','fuel_register','mileage','integer', 'FR-UT-DB-06 mileage is an integer type');


insert into tap(line) select col_not_null('public','fuel_register','control_number','FR-UT-DB-07 control_number is required');
insert into tap(line) select col_not_null('public','fuel_register','fuel_type','FR-UT-DB-08 fuel_type is required');
insert into tap(line) select col_not_null('public','fuel_register','dispatch_date','FR-UT-DB-09 dispatch_date is required');
insert into tap(line) select col_not_null('public','fuel_register','requesting_department','FR-UT-DB-10 requesting_department is required');
insert into tap(line) select col_not_null('public','fuel_register','amount_requested','FR-UT-DB-11 amount_requested is required');
insert into tap(line) select col_not_null('public','fuel_register','requester_name','FR-UT-DB-12 requester_name is required');
insert into tap(line) select col_not_null('public','fuel_register','requester_license','FR-UT-DB-13 requester_license is required');
insert into tap(line) select col_not_null('public','fuel_register','authorized_by','FR-UT-DB-14 authorized_by is required');
insert into tap(line) select col_not_null('public','fuel_register','amount_dispatched','FR-UT-DB-15 amount_dispatched is required');
insert into tap(line) select col_not_null('public','fuel_register','liters','FR-UT-DB-16 liters is required');
insert into tap(line) select col_not_null('public','fuel_register','employee_name','FR-UT-DB-17 employee_name is required');
insert into tap(line) select col_not_null('public','fuel_register','employee_license','FR-UT-DB-18 employee_license is required');
insert into tap(line) select col_not_null('public','fuel_register','supplier_name','FR-UT-DB-19 supplier_name is required');
insert into tap(line) select col_not_null('public','fuel_register','authorized_signature','FR-UT-DB-20 authorized_signature is required');
insert into tap(line) select col_not_null('public','fuel_register','employee_signature','FR-UT-DB-21 employee_signature is required');
insert into tap(line) select col_not_null('public','fuel_register','supplier_signature','FR-UT-DB-22 supplier_signature is required');



insert into tap(line) select lives_ok(
    $$insert into public.fuel_register (vehicle_id, control_number,fuel_type,dispatch_date,requesting_department,amount_requested,requester_name,requester_license,mileage,
    authorized_by, authorized_signature,amount_dispatched,liters,
    employee_name,employee_license,employee_signature,supplier_name,supplier_signature)
        values((select id from public.vehicles where license_plate='XYZ123'),
        'TEST-FR-001', 'gasolina', current_date,'Obras Públicas',50.00, 'Test Requester','1234567', 45210,
        'Test Authorizer',true,48.50,45.20,'Test Employee','7654321',true,'Test Supplier',true)$$,
        'FR-UT-DB-23 accepts a complete vehicle ticket'
);

insert into tap(line) select throws_ok(
    $$insert into public.fuel_register (vehicle_id, control_number,fuel_type,dispatch_date,requesting_department,amount_requested,requester_name,requester_license,mileage,
    authorized_by, authorized_signature,amount_dispatched,liters,
    employee_name,employee_license,employee_signature,supplier_name,supplier_signature)
        values((select id from public.vehicles where license_plate='XYZ123'),
        'TEST-FR-001', 'gasolina', current_date,'Obras Públicas',50.00, 'Test Requester','1234567', 45210,
        'Test Authorizer',true,48.50,45.20,'Test Employee','7654321',true,'Test Supplier',true)$$,
        '23505',null,
        'FR-UT-DB-24 rejects a duplicate control number'
);


insert into tap(line) select throws_ok(
    $$insert into public.fuel_register (vehicle_id, control_number,fuel_type,dispatch_date,requesting_department,amount_requested,requester_name,requester_license,mileage,
    authorized_by, authorized_signature,amount_dispatched,liters,
    employee_name,employee_license,employee_signature,supplier_name,supplier_signature)
        values(999999,
        'TEST-FR-002', 'gasolina', current_date,'Obras Públicas',50.00, 'Test Requester','1234567', 45210,
        'Test Authorizer',true,48.50,45.20,'Test Employee','7654321',true,'Test Supplier',true)$$,
        '23503',null,
        'FR-UT-DB-25 rejects a nonexistent vehicle'
);



insert into tap(line) select * from finish();
select line from tap order by n;
rollback;




