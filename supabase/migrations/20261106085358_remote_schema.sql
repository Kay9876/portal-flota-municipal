


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'first_name', ''),
          coalesce(new.raw_user_meta_data->>'last_name', ''));
  return new;
end $$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_permission"("dept" bigint, "action" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    -- Regla original: fila en user_permissions para ese departamento
    exists (
      select 1 from public.user_permissions p
      where p.user_id = auth.uid()
        and p.department_id = dept
        and case action
              when 'view'   then p.can_view_vehicle
              when 'create' then p.can_create_vehicle
              when 'update' then p.can_update_vehicle
              else false
            end
    )
    -- Regla nueva: el auditor ve todos los departamentos (solo ver)
    or (
      action = 'view'
      and exists (
        select 1 from public.profiles pr
        where pr.id = auth.uid()
          and pr.is_global_viewer = true
          and pr.is_active is not false
      )
    );
$$;


ALTER FUNCTION "public"."has_permission"("dept" bigint, "action" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_active_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_admin is true
      and coalesce(p.is_active, true) is true
  );
$$;


ALTER FUNCTION "public"."is_active_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."daily_register" (
    "id" bigint NOT NULL,
    "scan_id" bigint,
    "vehicle_id" bigint NOT NULL,
    "departure_date" "date",
    "driver_name" "text",
    "user_department" "text",
    "destination" "text",
    "departure_time" time without time zone,
    "departure_mileage" integer,
    "arrival_time" time without time zone,
    "arrival_mileage" integer,
    "has_signature" boolean,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."daily_register" OWNER TO "postgres";


ALTER TABLE "public"."daily_register" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."daily_register_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text"
);


ALTER TABLE "public"."departments" OWNER TO "postgres";


ALTER TABLE "public"."departments" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."departments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."document_scans" (
    "id" bigint NOT NULL,
    "template_id" bigint NOT NULL,
    "vehicle_id" bigint,
    "file_path" "text" NOT NULL,
    "uploaded_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."document_scans" OWNER TO "postgres";


ALTER TABLE "public"."document_scans" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."document_scans_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."document_templates" (
    "id" bigint NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "target_table" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."document_templates" OWNER TO "postgres";


ALTER TABLE "public"."document_templates" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."document_templates_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."fuel" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "vehicle_id" bigint NOT NULL,
    "fuel_date" "date" NOT NULL,
    "liters" numeric NOT NULL,
    "cost" numeric NOT NULL,
    "fuel_type" "text",
    "supplier_name" "text",
    "driver_name" "text",
    "driver_license_num" "text",
    "vehicle_mileage" integer
);


ALTER TABLE "public"."fuel" OWNER TO "postgres";


ALTER TABLE "public"."fuel" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."fuel_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."fuel_register" (
    "id" bigint NOT NULL,
    "scan_id" bigint,
    "vehicle_id" bigint,
    "control_number" "text" NOT NULL,
    "fuel_type" "text" NOT NULL,
    "dispatch_date" "date" NOT NULL,
    "requesting_department" "text" NOT NULL,
    "amount_requested" numeric(10,2) NOT NULL,
    "requester_name" "text" NOT NULL,
    "requester_license" "text" NOT NULL,
    "plate_on_form" "text",
    "mileage" integer,
    "container_gallons" numeric(10,2),
    "container_equipment" "text",
    "authorized_by" "text" NOT NULL,
    "authorized_signature" boolean NOT NULL,
    "amount_dispatched" numeric(10,2) NOT NULL,
    "liters" numeric(10,2) NOT NULL,
    "employee_name" "text" NOT NULL,
    "employee_license" "text" NOT NULL,
    "employee_signature" boolean NOT NULL,
    "supplier_name" "text" NOT NULL,
    "supplier_signature" boolean NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."fuel_register" OWNER TO "postgres";


ALTER TABLE "public"."fuel_register" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."fuel_register_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."key_register" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "vehicle_id" bigint NOT NULL,
    "kr_date" "date" NOT NULL,
    "departure_time" time without time zone,
    "arrival_time" time without time zone,
    "driver_name" "text" NOT NULL,
    "driver_license_num" "text",
    "destination" "text",
    "passenger_name" "text",
    "user_department" "text",
    "key_pickup" timestamp with time zone,
    "key_handover" timestamp with time zone
);


ALTER TABLE "public"."key_register" OWNER TO "postgres";


ALTER TABLE "public"."key_register" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."key_register_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."maintenance" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "vehicle_id" bigint NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "location" "text",
    "description" "text",
    "cost" numeric DEFAULT '0'::numeric NOT NULL
);


ALTER TABLE "public"."maintenance" OWNER TO "postgres";


ALTER TABLE "public"."maintenance" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."maintenance_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text",
    "second_last_name" "text",
    "department_id" bigint,
    "is_admin" boolean DEFAULT false,
    "is_global_viewer" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."template_columns" (
    "id" bigint NOT NULL,
    "template_id" bigint NOT NULL,
    "sort_order" integer NOT NULL,
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text",
    "data_type" "text" NOT NULL,
    "db_column" "text" NOT NULL,
    "required" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."template_columns" OWNER TO "postgres";


ALTER TABLE "public"."template_columns" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."template_columns_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."template_instructions" (
    "id" bigint NOT NULL,
    "template_id" bigint NOT NULL,
    "sort_order" integer NOT NULL,
    "text" "text" NOT NULL
);


ALTER TABLE "public"."template_instructions" OWNER TO "postgres";


ALTER TABLE "public"."template_instructions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."template_instructions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_permissions" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "department_id" bigint,
    "can_view_vehicle" boolean,
    "can_create_vehicle" boolean,
    "can_update_vehicle" boolean,
    "granted_by" "uuid",
    "granted_at" timestamp with time zone
);


ALTER TABLE "public"."user_permissions" OWNER TO "postgres";


ALTER TABLE "public"."user_permissions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_permissions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."vehicles" (
    "id" bigint NOT NULL,
    "department_id" bigint NOT NULL,
    "manufacturer" "text",
    "model" "text",
    "year" smallint,
    "license_plate" "text" NOT NULL,
    "is_active" boolean,
    "total_mileage" numeric,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image_path" "text",
    "vin" "text"
);


ALTER TABLE "public"."vehicles" OWNER TO "postgres";


ALTER TABLE "public"."vehicles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."vehicles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."daily_register"
    ADD CONSTRAINT "daily_register_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_scans"
    ADD CONSTRAINT "document_scans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_templates"
    ADD CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_templates"
    ADD CONSTRAINT "document_templates_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."fuel"
    ADD CONSTRAINT "fuel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fuel_register"
    ADD CONSTRAINT "fuel_register_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."key_register"
    ADD CONSTRAINT "key_register_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."maintenance"
    ADD CONSTRAINT "maintenance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template_columns"
    ADD CONSTRAINT "template_columns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template_instructions"
    ADD CONSTRAINT "template_instructions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_license_plate_key" UNIQUE ("license_plate");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "fuel_register_control_number_key" ON "public"."fuel_register" USING "btree" ("control_number");



CREATE UNIQUE INDEX "vehicles_vin_key" ON "public"."vehicles" USING "btree" ("vin");



ALTER TABLE ONLY "public"."daily_register"
    ADD CONSTRAINT "daily_register_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."daily_register"
    ADD CONSTRAINT "daily_register_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "public"."document_scans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_register"
    ADD CONSTRAINT "daily_register_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id");



ALTER TABLE ONLY "public"."document_scans"
    ADD CONSTRAINT "document_scans_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id");



ALTER TABLE ONLY "public"."document_scans"
    ADD CONSTRAINT "document_scans_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."document_scans"
    ADD CONSTRAINT "document_scans_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id");



ALTER TABLE ONLY "public"."fuel_register"
    ADD CONSTRAINT "fuel_register_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."fuel_register"
    ADD CONSTRAINT "fuel_register_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "public"."document_scans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fuel_register"
    ADD CONSTRAINT "fuel_register_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id");



ALTER TABLE ONLY "public"."fuel"
    ADD CONSTRAINT "fuel_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id");



ALTER TABLE ONLY "public"."key_register"
    ADD CONSTRAINT "key_register_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id");



ALTER TABLE ONLY "public"."maintenance"
    ADD CONSTRAINT "maintenance_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id");



ALTER TABLE ONLY "public"."template_columns"
    ADD CONSTRAINT "template_columns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_instructions"
    ADD CONSTRAINT "template_instructions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id");



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id");



CREATE POLICY "Admins can create departments" ON "public"."departments" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true) AND ("profiles"."is_active" = true)))));



CREATE POLICY "dep_admin" ON "public"."departments" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "dep_select" ON "public"."departments" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "departments_admin_delete" ON "public"."departments" FOR DELETE TO "authenticated" USING ("public"."is_active_admin"());



CREATE POLICY "departments_admin_insert" ON "public"."departments" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_active_admin"());



CREATE POLICY "departments_admin_update" ON "public"."departments" FOR UPDATE TO "authenticated" USING ("public"."is_active_admin"()) WITH CHECK ("public"."is_active_admin"());



CREATE POLICY "departments_authenticated_select" ON "public"."departments" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."fuel" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."key_register" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."maintenance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "perm_admin" ON "public"."user_permissions" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "perm_select" ON "public"."user_permissions" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "permissions_admin_delete" ON "public"."user_permissions" FOR DELETE TO "authenticated" USING ("public"."is_active_admin"());



CREATE POLICY "permissions_admin_insert" ON "public"."user_permissions" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_active_admin"() AND (("granted_by" IS NULL) OR ("granted_by" = "auth"."uid"()))));



CREATE POLICY "permissions_admin_update" ON "public"."user_permissions" FOR UPDATE TO "authenticated" USING ("public"."is_active_admin"()) WITH CHECK (("public"."is_active_admin"() AND (("granted_by" IS NULL) OR ("granted_by" = "auth"."uid"()))));



CREATE POLICY "permissions_select_self_or_admin" ON "public"."user_permissions" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_active_admin"()));



CREATE POLICY "prof_admin" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "prof_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_admin_insert" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_active_admin"());



CREATE POLICY "profiles_admin_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ("public"."is_active_admin"()) WITH CHECK ("public"."is_active_admin"());



CREATE POLICY "profiles_select_self_or_admin" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."is_active_admin"()));



CREATE POLICY "select_fuel" ON "public"."fuel" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."vehicles" "v"
  WHERE (("v"."id" = "fuel"."vehicle_id") AND "public"."has_permission"("v"."department_id", 'view'::"text"))))));



CREATE POLICY "select_key_register" ON "public"."key_register" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."vehicles" "v"
  WHERE (("v"."id" = "key_register"."vehicle_id") AND "public"."has_permission"("v"."department_id", 'view'::"text"))))));



CREATE POLICY "select_maintenance" ON "public"."maintenance" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."vehicles" "v"
  WHERE (("v"."id" = "maintenance"."vehicle_id") AND "public"."has_permission"("v"."department_id", 'view'::"text"))))));



ALTER TABLE "public"."user_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "veh_insert" ON "public"."vehicles" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin"() OR "public"."has_permission"("department_id", 'create'::"text")));



CREATE POLICY "veh_select" ON "public"."vehicles" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR "public"."has_permission"("department_id", 'view'::"text")));



CREATE POLICY "veh_update" ON "public"."vehicles" FOR UPDATE TO "authenticated" USING (("public"."is_admin"() OR "public"."has_permission"("department_id", 'update'::"text")));



ALTER TABLE "public"."vehicles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_permission"("dept" bigint, "action" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_permission"("dept" bigint, "action" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_permission"("dept" bigint, "action" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_active_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_active_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_active_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_active_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";


















GRANT ALL ON TABLE "public"."daily_register" TO "anon";
GRANT ALL ON TABLE "public"."daily_register" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_register" TO "service_role";



GRANT ALL ON SEQUENCE "public"."daily_register_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."daily_register_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."daily_register_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."departments" TO "anon";
GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT ALL ON TABLE "public"."departments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."departments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."departments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."departments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."document_scans" TO "anon";
GRANT ALL ON TABLE "public"."document_scans" TO "authenticated";
GRANT ALL ON TABLE "public"."document_scans" TO "service_role";



GRANT ALL ON SEQUENCE "public"."document_scans_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."document_scans_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."document_scans_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."document_templates" TO "anon";
GRANT ALL ON TABLE "public"."document_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."document_templates" TO "service_role";



GRANT ALL ON SEQUENCE "public"."document_templates_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."document_templates_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."document_templates_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."fuel" TO "anon";
GRANT ALL ON TABLE "public"."fuel" TO "authenticated";
GRANT ALL ON TABLE "public"."fuel" TO "service_role";



GRANT ALL ON SEQUENCE "public"."fuel_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."fuel_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."fuel_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."fuel_register" TO "anon";
GRANT ALL ON TABLE "public"."fuel_register" TO "authenticated";
GRANT ALL ON TABLE "public"."fuel_register" TO "service_role";



GRANT ALL ON SEQUENCE "public"."fuel_register_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."fuel_register_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."fuel_register_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."key_register" TO "anon";
GRANT ALL ON TABLE "public"."key_register" TO "authenticated";
GRANT ALL ON TABLE "public"."key_register" TO "service_role";



GRANT ALL ON SEQUENCE "public"."key_register_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."key_register_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."key_register_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."maintenance" TO "anon";
GRANT ALL ON TABLE "public"."maintenance" TO "authenticated";
GRANT ALL ON TABLE "public"."maintenance" TO "service_role";



GRANT ALL ON SEQUENCE "public"."maintenance_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."maintenance_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."maintenance_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."template_columns" TO "anon";
GRANT ALL ON TABLE "public"."template_columns" TO "authenticated";
GRANT ALL ON TABLE "public"."template_columns" TO "service_role";



GRANT ALL ON SEQUENCE "public"."template_columns_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."template_columns_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."template_columns_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."template_instructions" TO "anon";
GRANT ALL ON TABLE "public"."template_instructions" TO "authenticated";
GRANT ALL ON TABLE "public"."template_instructions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."template_instructions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."template_instructions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."template_instructions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_permissions" TO "anon";
GRANT ALL ON TABLE "public"."user_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_permissions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_permissions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_permissions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_permissions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."vehicles" TO "anon";
GRANT ALL ON TABLE "public"."vehicles" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."vehicles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."vehicles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."vehicles_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "scans_all"
  on "storage"."objects"
  as permissive
  for all
  to authenticated
using ((bucket_id = 'scans'::text))
with check ((bucket_id = 'scans'::text));



  create policy "vehicle_photos_all"
  on "storage"."objects"
  as permissive
  for all
  to authenticated
using ((bucket_id = 'vehicle-photos'::text))
with check ((bucket_id = 'vehicle-photos'::text));


-- CREATE TRIGGER enforce_versioning_status_transition BEFORE UPDATE OF versioning_status ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_versioning_status_transition();

-- CREATE TRIGGER protect_active_lifecycle_states BEFORE DELETE ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_active_lifecycle_states();

-- CREATE TRIGGER wake_lifecycle_on_policy_write AFTER INSERT OR UPDATE OF lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.wake_lifecycle_state();

-- CREATE TRIGGER wake_lifecycle_on_versioning_enable AFTER UPDATE OF versioning_status ON storage.buckets FOR EACH ROW WHEN ((new.lifecycle_configuration IS NOT NULL)) EXECUTE FUNCTION storage.wake_lifecycle_state();


