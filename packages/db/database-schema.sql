--
-- PostgreSQL database dump
--

\restrict T7uaQNUJwgDeCCgxatYuqjMvv51gkRJie04M2lHhJbPBXuxVW2N5rjzytpHtuK1

-- Dumped from database version 17.5 (6bc9ef8)
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: audit_operation; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.audit_operation AS ENUM (
    'create',
    'update',
    'delete',
    'soft_delete',
    'restore'
);


ALTER TYPE public.audit_operation OWNER TO neondb_owner;

--
-- Name: batch_status; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.batch_status AS ENUM (
    'fermentation',
    'aging',
    'conditioning',
    'completed',
    'discarded'
);


ALTER TYPE public.batch_status OWNER TO neondb_owner;

--
-- Name: bottle_run_photo_type; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.bottle_run_photo_type AS ENUM (
    'fill_level',
    'label_placement',
    'other'
);


ALTER TYPE public.bottle_run_photo_type OWNER TO neondb_owner;

--
-- Name: bottle_run_status; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.bottle_run_status AS ENUM (
    'completed',
    'voided'
);


ALTER TYPE public.bottle_run_status OWNER TO neondb_owner;

--
-- Name: carbonation_level; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.carbonation_level AS ENUM (
    'still',
    'petillant',
    'sparkling'
);


ALTER TYPE public.carbonation_level OWNER TO neondb_owner;

--
-- Name: cider_category_enum; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.cider_category_enum AS ENUM (
    'sweet',
    'bittersweet',
    'sharp',
    'bittersharp'
);


ALTER TYPE public.cider_category_enum OWNER TO neondb_owner;

--
-- Name: cogs_item_type; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.cogs_item_type AS ENUM (
    'apple_cost',
    'labor',
    'overhead',
    'packaging'
);


ALTER TYPE public.cogs_item_type OWNER TO neondb_owner;

--
-- Name: fill_check; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.fill_check AS ENUM (
    'pass',
    'fail',
    'not_tested'
);


ALTER TYPE public.fill_check OWNER TO neondb_owner;

--
-- Name: filter_type; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.filter_type AS ENUM (
    'coarse',
    'fine',
    'sterile'
);


ALTER TYPE public.filter_type OWNER TO neondb_owner;

--
-- Name: fruit_type; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.fruit_type AS ENUM (
    'apple',
    'pear',
    'plum'
);


ALTER TYPE public.fruit_type OWNER TO neondb_owner;

--
-- Name: harvest_window_enum; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.harvest_window_enum AS ENUM (
    'Late',
    'Mid-Late',
    'Mid',
    'Early-Mid',
    'Early'
);


ALTER TYPE public.harvest_window_enum OWNER TO neondb_owner;

--
-- Name: intensity_enum; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.intensity_enum AS ENUM (
    'high',
    'medium-high',
    'medium',
    'low-medium',
    'low'
);


ALTER TYPE public.intensity_enum OWNER TO neondb_owner;

--
-- Name: material_type; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.material_type AS ENUM (
    'apple',
    'additive',
    'juice',
    'packaging'
);


ALTER TYPE public.material_type OWNER TO neondb_owner;

--
-- Name: package_size_type; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.package_size_type AS ENUM (
    'bottle',
    'can',
    'keg'
);


ALTER TYPE public.package_size_type OWNER TO neondb_owner;

--
-- Name: package_type; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.package_type AS ENUM (
    'bottle',
    'can',
    'keg'
);


ALTER TYPE public.package_type OWNER TO neondb_owner;

--
-- Name: packaging_item_type; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.packaging_item_type AS ENUM (
    'Primary Packaging',
    'Closures',
    'Secondary Packaging',
    'Tertiary Packaging'
);


ALTER TYPE public.packaging_item_type OWNER TO neondb_owner;

--
-- Name: press_run_status; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.press_run_status AS ENUM (
    'draft',
    'in_progress',
    'completed',
    'cancelled'
);


ALTER TYPE public.press_run_status OWNER TO neondb_owner;

--
-- Name: transaction_type; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.transaction_type AS ENUM (
    'purchase',
    'transfer',
    'adjustment',
    'sale',
    'waste'
);


ALTER TYPE public.transaction_type OWNER TO neondb_owner;

--
-- Name: unit; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.unit AS ENUM (
    'kg',
    'lb',
    'L',
    'gal',
    'bushel'
);


ALTER TYPE public.unit OWNER TO neondb_owner;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'operator'
);


ALTER TYPE public.user_role OWNER TO neondb_owner;

--
-- Name: vessel_jacketed; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.vessel_jacketed AS ENUM (
    'yes',
    'no'
);


ALTER TYPE public.vessel_jacketed OWNER TO neondb_owner;

--
-- Name: vessel_material; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.vessel_material AS ENUM (
    'stainless_steel',
    'plastic'
);


ALTER TYPE public.vessel_material OWNER TO neondb_owner;

--
-- Name: vessel_pressure; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.vessel_pressure AS ENUM (
    'yes',
    'no'
);


ALTER TYPE public.vessel_pressure OWNER TO neondb_owner;

--
-- Name: vessel_status; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.vessel_status AS ENUM (
    'available',
    'cleaning',
    'maintenance'
);


ALTER TYPE public.vessel_status OWNER TO neondb_owner;

--
-- Name: vessel_type; Type: TYPE; Schema: public; Owner: neondb_owner
--

CREATE TYPE public.vessel_type AS ENUM (
    'fermenter',
    'conditioning_tank',
    'bright_tank',
    'storage'
);


ALTER TYPE public.vessel_type OWNER TO neondb_owner;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: users_sync; Type: TABLE; Schema: neon_auth; Owner: neondb_owner
--

CREATE TABLE neon_auth.users_sync (
    raw_json jsonb NOT NULL,
    id text GENERATED ALWAYS AS ((raw_json ->> 'id'::text)) STORED NOT NULL,
    name text GENERATED ALWAYS AS ((raw_json ->> 'display_name'::text)) STORED,
    email text GENERATED ALWAYS AS ((raw_json ->> 'primary_email'::text)) STORED,
    created_at timestamp with time zone GENERATED ALWAYS AS (to_timestamp((trunc((((raw_json ->> 'signed_up_at_millis'::text))::bigint)::double precision) / (1000)::double precision))) STORED,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


ALTER TABLE neon_auth.users_sync OWNER TO neondb_owner;

--
-- Name: additive_purchase_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.additive_purchase_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_id uuid NOT NULL,
    additive_variety_id uuid,
    additive_type text,
    brand_manufacturer text,
    product_name text,
    quantity numeric(10,3) NOT NULL,
    unit text NOT NULL,
    lot_batch_number text,
    expiration_date date,
    storage_requirements text,
    price_per_unit numeric(8,4),
    total_cost numeric(10,2),
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);


ALTER TABLE public.additive_purchase_items OWNER TO neondb_owner;

--
-- Name: additive_purchases; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.additive_purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    purchase_date timestamp without time zone NOT NULL,
    total_cost numeric(10,2) NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    deleted_at timestamp without time zone
);


ALTER TABLE public.additive_purchases OWNER TO neondb_owner;

--
-- Name: additive_varieties; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.additive_varieties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    item_type text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    label_impact boolean DEFAULT false NOT NULL,
    label_impact_notes text,
    allergens_vegan boolean DEFAULT false NOT NULL,
    allergens_vegan_notes text
);


ALTER TABLE public.additive_varieties OWNER TO neondb_owner;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    operation public.audit_operation NOT NULL,
    old_data jsonb,
    new_data jsonb,
    diff_data jsonb,
    changed_by uuid,
    changed_by_email text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    reason text,
    ip_address text,
    user_agent text,
    session_id text,
    audit_version text DEFAULT '1.0'::text NOT NULL,
    checksum text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO neondb_owner;

--
-- Name: base_fruit_varieties; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.base_fruit_varieties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    is_active boolean DEFAULT true NOT NULL,
    cider_category public.cider_category_enum,
    tannin public.intensity_enum,
    acid public.intensity_enum,
    sugar_brix public.intensity_enum,
    harvest_window public.harvest_window_enum,
    variety_notes text,
    fruit_type public.fruit_type DEFAULT 'apple'::public.fruit_type NOT NULL
);


ALTER TABLE public.base_fruit_varieties OWNER TO neondb_owner;

--
-- Name: basefruit_purchase_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.basefruit_purchase_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_id uuid NOT NULL,
    fruit_variety_id uuid NOT NULL,
    quantity numeric(10,3) NOT NULL,
    unit public.unit NOT NULL,
    price_per_unit numeric(8,4),
    total_cost numeric(10,2),
    quantity_kg numeric(10,3),
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    harvest_date date,
    is_depleted boolean DEFAULT false,
    depleted_at timestamp without time zone,
    depleted_by uuid,
    depleted_in_press_run uuid
);


ALTER TABLE public.basefruit_purchase_items OWNER TO neondb_owner;

--
-- Name: basefruit_purchases; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.basefruit_purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    purchase_date timestamp without time zone NOT NULL,
    total_cost numeric(10,2) NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    created_by uuid,
    updated_by uuid
);


ALTER TABLE public.basefruit_purchases OWNER TO neondb_owner;

--
-- Name: batch_additives; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.batch_additives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    vessel_id uuid NOT NULL,
    additive_type text NOT NULL,
    additive_name text NOT NULL,
    amount numeric(10,3) NOT NULL,
    unit text NOT NULL,
    notes text,
    added_at timestamp without time zone DEFAULT now() NOT NULL,
    added_by text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);


ALTER TABLE public.batch_additives OWNER TO neondb_owner;

--
-- Name: batch_compositions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.batch_compositions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    purchase_item_id uuid,
    vendor_id uuid NOT NULL,
    variety_id uuid,
    lot_code text,
    input_weight_kg numeric(12,3),
    fraction_of_batch numeric(8,6),
    material_cost numeric(12,2) NOT NULL,
    avg_brix numeric(5,2),
    est_sugar_kg numeric(12,3),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    juice_volume numeric(12,3) NOT NULL,
    juice_volume_unit public.unit DEFAULT 'L'::public.unit NOT NULL,
    source_type text DEFAULT 'base_fruit'::text NOT NULL,
    juice_purchase_item_id uuid
);


ALTER TABLE public.batch_compositions OWNER TO neondb_owner;

--
-- Name: batch_filter_operations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.batch_filter_operations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    vessel_id uuid NOT NULL,
    filter_type public.filter_type NOT NULL,
    volume_before numeric(10,3) NOT NULL,
    volume_before_unit public.unit DEFAULT 'L'::public.unit NOT NULL,
    volume_after numeric(10,3) NOT NULL,
    volume_after_unit public.unit DEFAULT 'L'::public.unit NOT NULL,
    volume_loss numeric(10,3) DEFAULT '0'::numeric NOT NULL,
    filtered_by text,
    filtered_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);


ALTER TABLE public.batch_filter_operations OWNER TO neondb_owner;

--
-- Name: batch_measurements; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.batch_measurements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    measurement_date timestamp without time zone NOT NULL,
    specific_gravity numeric(5,4),
    abv numeric(4,2),
    ph numeric(3,2),
    total_acidity numeric(4,2),
    temperature numeric(4,1),
    notes text,
    taken_by text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    volume numeric(10,3),
    volume_unit public.unit DEFAULT 'L'::public.unit NOT NULL
);


ALTER TABLE public.batch_measurements OWNER TO neondb_owner;

--
-- Name: batch_merge_history; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.batch_merge_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    target_batch_id uuid NOT NULL,
    source_press_run_id uuid,
    source_type text NOT NULL,
    composition_snapshot jsonb,
    notes text,
    merged_at timestamp without time zone DEFAULT now() NOT NULL,
    merged_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    volume_added numeric(10,3) NOT NULL,
    volume_added_unit public.unit DEFAULT 'L'::public.unit NOT NULL,
    target_volume_before numeric(10,3) NOT NULL,
    target_volume_before_unit public.unit DEFAULT 'L'::public.unit NOT NULL,
    target_volume_after numeric(10,3) NOT NULL,
    target_volume_after_unit public.unit DEFAULT 'L'::public.unit NOT NULL,
    source_juice_purchase_item_id uuid
);


ALTER TABLE public.batch_merge_history OWNER TO neondb_owner;

--
-- Name: COLUMN batch_merge_history.source_type; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public.batch_merge_history.source_type IS 'Source type: press_run, batch_transfer, or juice_purchase';


--
-- Name: batch_racking_operations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.batch_racking_operations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    source_vessel_id uuid NOT NULL,
    destination_vessel_id uuid NOT NULL,
    volume_before numeric(10,3) NOT NULL,
    volume_before_unit public.unit DEFAULT 'L'::public.unit NOT NULL,
    volume_after numeric(10,3) NOT NULL,
    volume_after_unit public.unit DEFAULT 'L'::public.unit NOT NULL,
    volume_loss numeric(10,3) DEFAULT '0'::numeric NOT NULL,
    volume_loss_unit public.unit DEFAULT 'L'::public.unit NOT NULL,
    racked_by uuid,
    racked_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);


ALTER TABLE public.batch_racking_operations OWNER TO neondb_owner;

--
-- Name: batch_transfers; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.batch_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_batch_id uuid NOT NULL,
    source_vessel_id uuid NOT NULL,
    destination_batch_id uuid NOT NULL,
    destination_vessel_id uuid NOT NULL,
    remaining_batch_id uuid,
    notes text,
    transferred_at timestamp without time zone DEFAULT now() NOT NULL,
    transferred_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    volume_transferred numeric(10,3) NOT NULL,
    volume_transferred_unit public.unit DEFAULT 'L'::public.unit NOT NULL,
    loss numeric(10,3) DEFAULT '0'::numeric,
    loss_unit public.unit DEFAULT 'L'::public.unit NOT NULL,
    total_volume_processed numeric(10,3) NOT NULL,
    total_volume_processed_unit public.unit DEFAULT 'L'::public.unit NOT NULL,
    remaining_volume numeric(10,3),
    remaining_volume_unit public.unit DEFAULT 'L'::public.unit NOT NULL
);


ALTER TABLE public.batch_transfers OWNER TO neondb_owner;

--
-- Name: batches; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_number text NOT NULL,
    status public.batch_status DEFAULT 'fermentation'::public.batch_status NOT NULL,
    vessel_id uuid,
    start_date timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name text NOT NULL,
    end_date timestamp with time zone,
    origin_press_run_id uuid,
    custom_name text,
    initial_volume numeric(10,3) NOT NULL,
    initial_volume_unit public.unit DEFAULT 'L'::public.unit NOT NULL,
    current_volume numeric(10,3),
    current_volume_unit public.unit DEFAULT 'L'::public.unit NOT NULL,
    origin_juice_purchase_item_id uuid
);


ALTER TABLE public.batches OWNER TO neondb_owner;

--
-- Name: bottle_run_photos; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.bottle_run_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bottle_run_id uuid NOT NULL,
    photo_url text NOT NULL,
    photo_type public.bottle_run_photo_type,
    caption text,
    uploaded_by uuid NOT NULL,
    uploaded_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.bottle_run_photos OWNER TO neondb_owner;

--
-- Name: bottle_runs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.bottle_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    vessel_id uuid NOT NULL,
    packaged_at timestamp without time zone NOT NULL,
    package_type public.package_type NOT NULL,
    package_size_ml integer NOT NULL,
    unit_size numeric(10,4) NOT NULL,
    unit_size_unit public.unit DEFAULT 'L'::public.unit NOT NULL,
    units_produced integer NOT NULL,
    volume_taken numeric(10,2) NOT NULL,
    volume_taken_unit public.unit DEFAULT 'L'::public.unit NOT NULL,
    loss numeric(10,2) NOT NULL,
    loss_unit public.unit DEFAULT 'L'::public.unit NOT NULL,
    loss_percentage numeric(5,2),
    abv_at_packaging numeric(5,2),
    carbonation_level public.carbonation_level,
    fill_check public.fill_check,
    fill_variance_ml numeric(6,2),
    test_method text,
    test_date timestamp without time zone,
    qa_technician_id uuid,
    qa_notes text,
    production_notes text,
    status public.bottle_run_status DEFAULT 'completed'::public.bottle_run_status,
    void_reason text,
    voided_at timestamp without time zone,
    voided_by uuid,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.bottle_runs OWNER TO neondb_owner;

--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.inventory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid,
    lot_code text,
    bottle_run_id uuid,
    package_type text,
    package_size_ml integer,
    expiration_date date,
    purchase_date date,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);


ALTER TABLE public.inventory_items OWNER TO neondb_owner;

--
-- Name: juice_purchase_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.juice_purchase_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_id uuid NOT NULL,
    juice_variety_id uuid,
    juice_type text,
    variety_name text,
    volume numeric(10,3) NOT NULL,
    volume_unit public.unit DEFAULT 'L'::public.unit NOT NULL,
    brix numeric(5,2),
    ph numeric(3,2),
    specific_gravity numeric(5,4),
    container_type text,
    price_per_liter numeric(8,4),
    total_cost numeric(10,2),
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    volume_allocated numeric(10,3) DEFAULT '0'::numeric NOT NULL
);


ALTER TABLE public.juice_purchase_items OWNER TO neondb_owner;

--
-- Name: juice_purchases; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.juice_purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    purchase_date timestamp without time zone NOT NULL,
    total_cost numeric(10,2) NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    deleted_at timestamp without time zone
);


ALTER TABLE public.juice_purchases OWNER TO neondb_owner;

--
-- Name: juice_varieties; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.juice_varieties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);


ALTER TABLE public.juice_varieties OWNER TO neondb_owner;

--
-- Name: package_sizes; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.package_sizes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    size_ml integer NOT NULL,
    size_oz numeric(6,2),
    display_name text NOT NULL,
    package_type public.package_size_type NOT NULL,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.package_sizes OWNER TO neondb_owner;

--
-- Name: packaging_purchase_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.packaging_purchase_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_id uuid NOT NULL,
    packaging_variety_id uuid,
    package_type text,
    material_type text,
    size text NOT NULL,
    quantity integer NOT NULL,
    price_per_unit numeric(8,4),
    total_cost numeric(10,2),
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);


ALTER TABLE public.packaging_purchase_items OWNER TO neondb_owner;

--
-- Name: packaging_purchases; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.packaging_purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    purchase_date timestamp without time zone NOT NULL,
    total_cost numeric(10,2) NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    deleted_at timestamp without time zone
);


ALTER TABLE public.packaging_purchases OWNER TO neondb_owner;

--
-- Name: packaging_varieties; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.packaging_varieties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    item_type public.packaging_item_type NOT NULL
);


ALTER TABLE public.packaging_varieties OWNER TO neondb_owner;

--
-- Name: press_run_loads; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.press_run_loads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    press_run_id uuid NOT NULL,
    purchase_item_id uuid NOT NULL,
    fruit_variety_id uuid NOT NULL,
    load_sequence integer NOT NULL,
    apple_weight_kg numeric(10,3) NOT NULL,
    original_weight numeric(10,3),
    original_weight_unit text,
    original_volume numeric(10,3),
    original_volume_unit text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    deleted_at timestamp without time zone,
    juice_volume numeric(10,3),
    juice_volume_unit public.unit DEFAULT 'L'::public.unit NOT NULL
);


ALTER TABLE public.press_run_loads OWNER TO neondb_owner;

--
-- Name: press_runs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.press_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid,
    vessel_id uuid,
    status public.press_run_status DEFAULT 'draft'::public.press_run_status NOT NULL,
    total_apple_weight_kg numeric(10,3),
    extraction_rate numeric(5,4),
    labor_hours numeric(8,2),
    labor_cost_per_hour numeric(8,2),
    total_labor_cost numeric(10,2),
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    deleted_at timestamp without time zone,
    press_run_name text,
    total_juice_volume numeric(10,3),
    total_juice_volume_unit public.unit DEFAULT 'L'::public.unit NOT NULL,
    date_completed date
);


ALTER TABLE public.press_runs OWNER TO neondb_owner;

--
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    password_hash text NOT NULL,
    role public.user_role DEFAULT 'operator'::public.user_role NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);


ALTER TABLE public.users OWNER TO neondb_owner;

--
-- Name: vendor_additive_varieties; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.vendor_additive_varieties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    variety_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);


ALTER TABLE public.vendor_additive_varieties OWNER TO neondb_owner;

--
-- Name: vendor_juice_varieties; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.vendor_juice_varieties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    variety_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);


ALTER TABLE public.vendor_juice_varieties OWNER TO neondb_owner;

--
-- Name: vendor_packaging_varieties; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.vendor_packaging_varieties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    variety_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);


ALTER TABLE public.vendor_packaging_varieties OWNER TO neondb_owner;

--
-- Name: vendor_varieties; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.vendor_varieties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    variety_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);


ALTER TABLE public.vendor_varieties OWNER TO neondb_owner;

--
-- Name: vendors; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.vendors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    contact_info jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);


ALTER TABLE public.vendors OWNER TO neondb_owner;

--
-- Name: vessels; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.vessels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    type public.vessel_type,
    status public.vessel_status DEFAULT 'available'::public.vessel_status NOT NULL,
    location text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    capacity_unit public.unit DEFAULT 'L'::public.unit NOT NULL,
    material public.vessel_material,
    jacketed public.vessel_jacketed,
    capacity numeric(10,3) NOT NULL,
    is_pressure_vessel public.vessel_pressure
);


ALTER TABLE public.vessels OWNER TO neondb_owner;

--
-- Name: users_sync users_sync_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: neondb_owner
--

ALTER TABLE ONLY neon_auth.users_sync
    ADD CONSTRAINT users_sync_pkey PRIMARY KEY (id);


--
-- Name: additive_purchase_items additive_purchase_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.additive_purchase_items
    ADD CONSTRAINT additive_purchase_items_pkey PRIMARY KEY (id);


--
-- Name: additive_purchases additive_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.additive_purchases
    ADD CONSTRAINT additive_purchases_pkey PRIMARY KEY (id);


--
-- Name: additive_varieties additive_varieties_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.additive_varieties
    ADD CONSTRAINT additive_varieties_pkey PRIMARY KEY (id);


--
-- Name: press_run_loads apple_press_run_loads_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.press_run_loads
    ADD CONSTRAINT apple_press_run_loads_pkey PRIMARY KEY (id);


--
-- Name: press_runs apple_press_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.press_runs
    ADD CONSTRAINT apple_press_runs_pkey PRIMARY KEY (id);


--
-- Name: base_fruit_varieties apple_varieties_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.base_fruit_varieties
    ADD CONSTRAINT apple_varieties_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: batch_additives batch_additives_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_additives
    ADD CONSTRAINT batch_additives_pkey PRIMARY KEY (id);


--
-- Name: batch_compositions batch_compositions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_compositions
    ADD CONSTRAINT batch_compositions_pkey PRIMARY KEY (id);


--
-- Name: batch_filter_operations batch_filter_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_filter_operations
    ADD CONSTRAINT batch_filter_operations_pkey PRIMARY KEY (id);


--
-- Name: batch_measurements batch_measurements_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_measurements
    ADD CONSTRAINT batch_measurements_pkey PRIMARY KEY (id);


--
-- Name: batch_merge_history batch_merge_history_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_merge_history
    ADD CONSTRAINT batch_merge_history_pkey PRIMARY KEY (id);


--
-- Name: batch_racking_operations batch_racking_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_racking_operations
    ADD CONSTRAINT batch_racking_operations_pkey PRIMARY KEY (id);


--
-- Name: batch_transfers batch_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_transfers
    ADD CONSTRAINT batch_transfers_pkey PRIMARY KEY (id);


--
-- Name: batches batches_name_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_name_unique UNIQUE (name);


--
-- Name: batches batches_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_pkey PRIMARY KEY (id);


--
-- Name: bottle_run_photos bottle_run_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.bottle_run_photos
    ADD CONSTRAINT bottle_run_photos_pkey PRIMARY KEY (id);


--
-- Name: bottle_runs bottle_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.bottle_runs
    ADD CONSTRAINT bottle_runs_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_lot_code_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_lot_code_unique UNIQUE (lot_code);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: juice_purchase_items juice_purchase_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.juice_purchase_items
    ADD CONSTRAINT juice_purchase_items_pkey PRIMARY KEY (id);


--
-- Name: juice_purchases juice_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.juice_purchases
    ADD CONSTRAINT juice_purchases_pkey PRIMARY KEY (id);


--
-- Name: juice_varieties juice_varieties_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.juice_varieties
    ADD CONSTRAINT juice_varieties_pkey PRIMARY KEY (id);


--
-- Name: package_sizes package_sizes_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.package_sizes
    ADD CONSTRAINT package_sizes_pkey PRIMARY KEY (id);


--
-- Name: packaging_purchase_items packaging_purchase_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packaging_purchase_items
    ADD CONSTRAINT packaging_purchase_items_pkey PRIMARY KEY (id);


--
-- Name: packaging_purchases packaging_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packaging_purchases
    ADD CONSTRAINT packaging_purchases_pkey PRIMARY KEY (id);


--
-- Name: packaging_varieties packaging_varieties_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packaging_varieties
    ADD CONSTRAINT packaging_varieties_pkey PRIMARY KEY (id);


--
-- Name: basefruit_purchase_items purchase_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.basefruit_purchase_items
    ADD CONSTRAINT purchase_items_pkey PRIMARY KEY (id);


--
-- Name: basefruit_purchases purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.basefruit_purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendor_additive_varieties vendor_additive_varieties_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendor_additive_varieties
    ADD CONSTRAINT vendor_additive_varieties_pkey PRIMARY KEY (id);


--
-- Name: vendor_juice_varieties vendor_juice_varieties_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendor_juice_varieties
    ADD CONSTRAINT vendor_juice_varieties_pkey PRIMARY KEY (id);


--
-- Name: vendor_packaging_varieties vendor_packaging_varieties_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendor_packaging_varieties
    ADD CONSTRAINT vendor_packaging_varieties_pkey PRIMARY KEY (id);


--
-- Name: vendor_varieties vendor_varieties_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendor_varieties
    ADD CONSTRAINT vendor_varieties_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: vessels vessels_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vessels
    ADD CONSTRAINT vessels_pkey PRIMARY KEY (id);


--
-- Name: users_sync_deleted_at_idx; Type: INDEX; Schema: neon_auth; Owner: neondb_owner
--

CREATE INDEX users_sync_deleted_at_idx ON neon_auth.users_sync USING btree (deleted_at);


--
-- Name: additive_varieties_name_unique_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX additive_varieties_name_unique_idx ON public.additive_varieties USING btree (name);


--
-- Name: audit_logs_changed_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX audit_logs_changed_at_idx ON public.audit_logs USING btree (changed_at);


--
-- Name: audit_logs_changed_by_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX audit_logs_changed_by_idx ON public.audit_logs USING btree (changed_by);


--
-- Name: audit_logs_operation_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX audit_logs_operation_idx ON public.audit_logs USING btree (operation);


--
-- Name: audit_logs_record_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX audit_logs_record_id_idx ON public.audit_logs USING btree (record_id);


--
-- Name: audit_logs_table_name_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX audit_logs_table_name_idx ON public.audit_logs USING btree (table_name);


--
-- Name: audit_logs_table_record_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX audit_logs_table_record_idx ON public.audit_logs USING btree (table_name, record_id);


--
-- Name: audit_logs_table_time_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX audit_logs_table_time_idx ON public.audit_logs USING btree (table_name, changed_at);


--
-- Name: audit_logs_user_time_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX audit_logs_user_time_idx ON public.audit_logs USING btree (changed_by, changed_at);


--
-- Name: base_fruit_varieties_name_unique_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX base_fruit_varieties_name_unique_idx ON public.base_fruit_varieties USING btree (name);


--
-- Name: batch_compositions_batch_fruit_item_unique_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX batch_compositions_batch_fruit_item_unique_idx ON public.batch_compositions USING btree (batch_id, purchase_item_id);


--
-- Name: batch_compositions_batch_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX batch_compositions_batch_idx ON public.batch_compositions USING btree (batch_id);


--
-- Name: batch_compositions_batch_juice_item_unique_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX batch_compositions_batch_juice_item_unique_idx ON public.batch_compositions USING btree (batch_id, juice_purchase_item_id);


--
-- Name: batch_compositions_juice_purchase_item_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX batch_compositions_juice_purchase_item_idx ON public.batch_compositions USING btree (juice_purchase_item_id);


--
-- Name: batch_compositions_purchase_item_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX batch_compositions_purchase_item_idx ON public.batch_compositions USING btree (purchase_item_id);


--
-- Name: batch_filter_operations_batch_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX batch_filter_operations_batch_id_idx ON public.batch_filter_operations USING btree (batch_id);


--
-- Name: batch_filter_operations_filtered_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX batch_filter_operations_filtered_at_idx ON public.batch_filter_operations USING btree (filtered_at);


--
-- Name: batch_filter_operations_vessel_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX batch_filter_operations_vessel_id_idx ON public.batch_filter_operations USING btree (vessel_id);


--
-- Name: batch_merge_history_merged_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX batch_merge_history_merged_at_idx ON public.batch_merge_history USING btree (merged_at);


--
-- Name: batch_merge_history_source_juice_purchase_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX batch_merge_history_source_juice_purchase_idx ON public.batch_merge_history USING btree (source_juice_purchase_item_id);


--
-- Name: batch_merge_history_source_press_run_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX batch_merge_history_source_press_run_idx ON public.batch_merge_history USING btree (source_press_run_id);


--
-- Name: batch_merge_history_target_batch_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX batch_merge_history_target_batch_idx ON public.batch_merge_history USING btree (target_batch_id);


--
-- Name: batch_racking_operations_batch_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX batch_racking_operations_batch_id_idx ON public.batch_racking_operations USING btree (batch_id);


--
-- Name: batch_racking_operations_destination_vessel_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX batch_racking_operations_destination_vessel_id_idx ON public.batch_racking_operations USING btree (destination_vessel_id);


--
-- Name: batch_racking_operations_racked_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX batch_racking_operations_racked_at_idx ON public.batch_racking_operations USING btree (racked_at);


--
-- Name: batch_racking_operations_source_vessel_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX batch_racking_operations_source_vessel_id_idx ON public.batch_racking_operations USING btree (source_vessel_id);


--
-- Name: batch_transfers_destination_batch_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX batch_transfers_destination_batch_idx ON public.batch_transfers USING btree (destination_batch_id);


--
-- Name: batch_transfers_destination_vessel_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX batch_transfers_destination_vessel_idx ON public.batch_transfers USING btree (destination_vessel_id);


--
-- Name: batch_transfers_source_batch_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX batch_transfers_source_batch_idx ON public.batch_transfers USING btree (source_batch_id);


--
-- Name: batch_transfers_source_vessel_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX batch_transfers_source_vessel_idx ON public.batch_transfers USING btree (source_vessel_id);


--
-- Name: batch_transfers_transferred_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX batch_transfers_transferred_at_idx ON public.batch_transfers USING btree (transferred_at);


--
-- Name: batches_origin_juice_purchase_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX batches_origin_juice_purchase_idx ON public.batches USING btree (origin_juice_purchase_item_id);


--
-- Name: batches_origin_press_run_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX batches_origin_press_run_idx ON public.batches USING btree (origin_press_run_id);


--
-- Name: batches_status_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX batches_status_idx ON public.batches USING btree (status);


--
-- Name: batches_vessel_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX batches_vessel_idx ON public.batches USING btree (vessel_id);


--
-- Name: bottle_run_photos_bottle_run_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX bottle_run_photos_bottle_run_idx ON public.bottle_run_photos USING btree (bottle_run_id);


--
-- Name: bottle_run_photos_uploaded_by_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX bottle_run_photos_uploaded_by_idx ON public.bottle_run_photos USING btree (uploaded_by);


--
-- Name: bottle_runs_batch_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX bottle_runs_batch_idx ON public.bottle_runs USING btree (batch_id);


--
-- Name: bottle_runs_batch_status_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX bottle_runs_batch_status_idx ON public.bottle_runs USING btree (batch_id, status);


--
-- Name: bottle_runs_packaged_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX bottle_runs_packaged_at_idx ON public.bottle_runs USING btree (packaged_at);


--
-- Name: bottle_runs_status_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX bottle_runs_status_idx ON public.bottle_runs USING btree (status);


--
-- Name: bottle_runs_vessel_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX bottle_runs_vessel_idx ON public.bottle_runs USING btree (vessel_id);


--
-- Name: idx_inventory_lot_code; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_inventory_lot_code ON public.inventory_items USING btree (lot_code);


--
-- Name: inventory_items_batch_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX inventory_items_batch_idx ON public.inventory_items USING btree (batch_id);


--
-- Name: inventory_items_bottle_run_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX inventory_items_bottle_run_idx ON public.inventory_items USING btree (bottle_run_id);


--
-- Name: inventory_items_expiration_date_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX inventory_items_expiration_date_idx ON public.inventory_items USING btree (expiration_date);


--
-- Name: inventory_items_purchase_date_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX inventory_items_purchase_date_idx ON public.inventory_items USING btree (purchase_date);


--
-- Name: juice_varieties_name_unique_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX juice_varieties_name_unique_idx ON public.juice_varieties USING btree (name);


--
-- Name: package_sizes_package_type_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX package_sizes_package_type_idx ON public.package_sizes USING btree (package_type);


--
-- Name: package_sizes_size_package_type_unique_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX package_sizes_size_package_type_unique_idx ON public.package_sizes USING btree (size_ml, package_type);


--
-- Name: package_sizes_sort_order_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX package_sizes_sort_order_idx ON public.package_sizes USING btree (sort_order);


--
-- Name: packaging_varieties_name_unique_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX packaging_varieties_name_unique_idx ON public.packaging_varieties USING btree (name);


--
-- Name: press_run_loads_created_by_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX press_run_loads_created_by_idx ON public.press_run_loads USING btree (created_by);


--
-- Name: press_run_loads_press_run_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX press_run_loads_press_run_idx ON public.press_run_loads USING btree (press_run_id);


--
-- Name: press_run_loads_purchase_item_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX press_run_loads_purchase_item_idx ON public.press_run_loads USING btree (purchase_item_id);


--
-- Name: press_run_loads_sequence_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX press_run_loads_sequence_idx ON public.press_run_loads USING btree (press_run_id, load_sequence);


--
-- Name: press_run_loads_unique_sequence; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX press_run_loads_unique_sequence ON public.press_run_loads USING btree (press_run_id, load_sequence) WHERE (deleted_at IS NULL);


--
-- Name: press_run_loads_updated_by_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX press_run_loads_updated_by_idx ON public.press_run_loads USING btree (updated_by);


--
-- Name: press_run_loads_variety_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX press_run_loads_variety_idx ON public.press_run_loads USING btree (fruit_variety_id);


--
-- Name: press_runs_created_by_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX press_runs_created_by_idx ON public.press_runs USING btree (created_by);


--
-- Name: press_runs_date_completed_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX press_runs_date_completed_idx ON public.press_runs USING btree (date_completed);


--
-- Name: press_runs_status_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX press_runs_status_idx ON public.press_runs USING btree (status);


--
-- Name: press_runs_updated_by_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX press_runs_updated_by_idx ON public.press_runs USING btree (updated_by);


--
-- Name: press_runs_vendor_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX press_runs_vendor_idx ON public.press_runs USING btree (vendor_id);


--
-- Name: press_runs_vendor_status_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX press_runs_vendor_status_idx ON public.press_runs USING btree (vendor_id, status);


--
-- Name: vendor_additive_varieties_variety_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX vendor_additive_varieties_variety_idx ON public.vendor_additive_varieties USING btree (variety_id);


--
-- Name: vendor_additive_varieties_vendor_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX vendor_additive_varieties_vendor_idx ON public.vendor_additive_varieties USING btree (vendor_id);


--
-- Name: vendor_additive_varieties_vendor_variety_unique_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX vendor_additive_varieties_vendor_variety_unique_idx ON public.vendor_additive_varieties USING btree (vendor_id, variety_id);


--
-- Name: vendor_juice_varieties_variety_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX vendor_juice_varieties_variety_idx ON public.vendor_juice_varieties USING btree (variety_id);


--
-- Name: vendor_juice_varieties_vendor_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX vendor_juice_varieties_vendor_idx ON public.vendor_juice_varieties USING btree (vendor_id);


--
-- Name: vendor_juice_varieties_vendor_variety_unique_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX vendor_juice_varieties_vendor_variety_unique_idx ON public.vendor_juice_varieties USING btree (vendor_id, variety_id);


--
-- Name: vendor_packaging_varieties_variety_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX vendor_packaging_varieties_variety_idx ON public.vendor_packaging_varieties USING btree (variety_id);


--
-- Name: vendor_packaging_varieties_vendor_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX vendor_packaging_varieties_vendor_idx ON public.vendor_packaging_varieties USING btree (vendor_id);


--
-- Name: vendor_packaging_varieties_vendor_variety_unique_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX vendor_packaging_varieties_vendor_variety_unique_idx ON public.vendor_packaging_varieties USING btree (vendor_id, variety_id);


--
-- Name: vendor_varieties_variety_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX vendor_varieties_variety_idx ON public.vendor_varieties USING btree (variety_id);


--
-- Name: vendor_varieties_vendor_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX vendor_varieties_vendor_idx ON public.vendor_varieties USING btree (vendor_id);


--
-- Name: vendor_varieties_vendor_variety_unique_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX vendor_varieties_vendor_variety_unique_idx ON public.vendor_varieties USING btree (vendor_id, variety_id);


--
-- Name: additive_purchase_items additive_purchase_items_additive_variety_id_additive_varieties_; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.additive_purchase_items
    ADD CONSTRAINT additive_purchase_items_additive_variety_id_additive_varieties_ FOREIGN KEY (additive_variety_id) REFERENCES public.additive_varieties(id);


--
-- Name: additive_purchase_items additive_purchase_items_purchase_id_additive_purchases_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.additive_purchase_items
    ADD CONSTRAINT additive_purchase_items_purchase_id_additive_purchases_id_fk FOREIGN KEY (purchase_id) REFERENCES public.additive_purchases(id);


--
-- Name: additive_purchases additive_purchases_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.additive_purchases
    ADD CONSTRAINT additive_purchases_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: additive_purchases additive_purchases_updated_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.additive_purchases
    ADD CONSTRAINT additive_purchases_updated_by_users_id_fk FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: additive_purchases additive_purchases_vendor_id_vendors_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.additive_purchases
    ADD CONSTRAINT additive_purchases_vendor_id_vendors_id_fk FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: audit_logs audit_logs_changed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_changed_by_users_id_fk FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: basefruit_purchase_items basefruit_purchase_items_fruit_variety_id_base_fruit_varieties_; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.basefruit_purchase_items
    ADD CONSTRAINT basefruit_purchase_items_fruit_variety_id_base_fruit_varieties_ FOREIGN KEY (fruit_variety_id) REFERENCES public.base_fruit_varieties(id);


--
-- Name: basefruit_purchase_items basefruit_purchase_items_purchase_id_basefruit_purchases_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.basefruit_purchase_items
    ADD CONSTRAINT basefruit_purchase_items_purchase_id_basefruit_purchases_id_fk FOREIGN KEY (purchase_id) REFERENCES public.basefruit_purchases(id);


--
-- Name: basefruit_purchases basefruit_purchases_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.basefruit_purchases
    ADD CONSTRAINT basefruit_purchases_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: basefruit_purchases basefruit_purchases_updated_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.basefruit_purchases
    ADD CONSTRAINT basefruit_purchases_updated_by_users_id_fk FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: basefruit_purchases basefruit_purchases_vendor_id_vendors_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.basefruit_purchases
    ADD CONSTRAINT basefruit_purchases_vendor_id_vendors_id_fk FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: batch_additives batch_additives_batch_id_batches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_additives
    ADD CONSTRAINT batch_additives_batch_id_batches_id_fk FOREIGN KEY (batch_id) REFERENCES public.batches(id);


--
-- Name: batch_additives batch_additives_vessel_id_vessels_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_additives
    ADD CONSTRAINT batch_additives_vessel_id_vessels_id_fk FOREIGN KEY (vessel_id) REFERENCES public.vessels(id);


--
-- Name: batch_compositions batch_compositions_batch_id_batches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_compositions
    ADD CONSTRAINT batch_compositions_batch_id_batches_id_fk FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE;


--
-- Name: batch_compositions batch_compositions_juice_purchase_item_id_juice_purchase_items_; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_compositions
    ADD CONSTRAINT batch_compositions_juice_purchase_item_id_juice_purchase_items_ FOREIGN KEY (juice_purchase_item_id) REFERENCES public.juice_purchase_items(id);


--
-- Name: batch_compositions batch_compositions_purchase_item_id_basefruit_purchase_items_id; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_compositions
    ADD CONSTRAINT batch_compositions_purchase_item_id_basefruit_purchase_items_id FOREIGN KEY (purchase_item_id) REFERENCES public.basefruit_purchase_items(id);


--
-- Name: batch_compositions batch_compositions_variety_id_base_fruit_varieties_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_compositions
    ADD CONSTRAINT batch_compositions_variety_id_base_fruit_varieties_id_fk FOREIGN KEY (variety_id) REFERENCES public.base_fruit_varieties(id);


--
-- Name: batch_compositions batch_compositions_vendor_id_vendors_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_compositions
    ADD CONSTRAINT batch_compositions_vendor_id_vendors_id_fk FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: batch_filter_operations batch_filter_operations_batch_id_batches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_filter_operations
    ADD CONSTRAINT batch_filter_operations_batch_id_batches_id_fk FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE;


--
-- Name: batch_filter_operations batch_filter_operations_vessel_id_vessels_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_filter_operations
    ADD CONSTRAINT batch_filter_operations_vessel_id_vessels_id_fk FOREIGN KEY (vessel_id) REFERENCES public.vessels(id) ON DELETE CASCADE;


--
-- Name: batch_measurements batch_measurements_batch_id_batches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_measurements
    ADD CONSTRAINT batch_measurements_batch_id_batches_id_fk FOREIGN KEY (batch_id) REFERENCES public.batches(id);


--
-- Name: batch_merge_history batch_merge_history_merged_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_merge_history
    ADD CONSTRAINT batch_merge_history_merged_by_users_id_fk FOREIGN KEY (merged_by) REFERENCES public.users(id);


--
-- Name: batch_merge_history batch_merge_history_source_juice_purchase_item_id_juice_purchas; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_merge_history
    ADD CONSTRAINT batch_merge_history_source_juice_purchase_item_id_juice_purchas FOREIGN KEY (source_juice_purchase_item_id) REFERENCES public.juice_purchase_items(id);


--
-- Name: batch_merge_history batch_merge_history_source_press_run_id_press_runs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_merge_history
    ADD CONSTRAINT batch_merge_history_source_press_run_id_press_runs_id_fk FOREIGN KEY (source_press_run_id) REFERENCES public.press_runs(id);


--
-- Name: batch_merge_history batch_merge_history_target_batch_id_batches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_merge_history
    ADD CONSTRAINT batch_merge_history_target_batch_id_batches_id_fk FOREIGN KEY (target_batch_id) REFERENCES public.batches(id);


--
-- Name: batch_racking_operations batch_racking_operations_batch_id_batches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_racking_operations
    ADD CONSTRAINT batch_racking_operations_batch_id_batches_id_fk FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE CASCADE;


--
-- Name: batch_racking_operations batch_racking_operations_destination_vessel_id_vessels_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_racking_operations
    ADD CONSTRAINT batch_racking_operations_destination_vessel_id_vessels_id_fk FOREIGN KEY (destination_vessel_id) REFERENCES public.vessels(id) ON DELETE CASCADE;


--
-- Name: batch_racking_operations batch_racking_operations_racked_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_racking_operations
    ADD CONSTRAINT batch_racking_operations_racked_by_users_id_fk FOREIGN KEY (racked_by) REFERENCES public.users(id);


--
-- Name: batch_racking_operations batch_racking_operations_source_vessel_id_vessels_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_racking_operations
    ADD CONSTRAINT batch_racking_operations_source_vessel_id_vessels_id_fk FOREIGN KEY (source_vessel_id) REFERENCES public.vessels(id) ON DELETE CASCADE;


--
-- Name: batch_transfers batch_transfers_destination_batch_id_batches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_transfers
    ADD CONSTRAINT batch_transfers_destination_batch_id_batches_id_fk FOREIGN KEY (destination_batch_id) REFERENCES public.batches(id);


--
-- Name: batch_transfers batch_transfers_destination_vessel_id_vessels_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_transfers
    ADD CONSTRAINT batch_transfers_destination_vessel_id_vessels_id_fk FOREIGN KEY (destination_vessel_id) REFERENCES public.vessels(id);


--
-- Name: batch_transfers batch_transfers_remaining_batch_id_batches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_transfers
    ADD CONSTRAINT batch_transfers_remaining_batch_id_batches_id_fk FOREIGN KEY (remaining_batch_id) REFERENCES public.batches(id);


--
-- Name: batch_transfers batch_transfers_source_batch_id_batches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_transfers
    ADD CONSTRAINT batch_transfers_source_batch_id_batches_id_fk FOREIGN KEY (source_batch_id) REFERENCES public.batches(id);


--
-- Name: batch_transfers batch_transfers_source_vessel_id_vessels_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_transfers
    ADD CONSTRAINT batch_transfers_source_vessel_id_vessels_id_fk FOREIGN KEY (source_vessel_id) REFERENCES public.vessels(id);


--
-- Name: batch_transfers batch_transfers_transferred_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batch_transfers
    ADD CONSTRAINT batch_transfers_transferred_by_users_id_fk FOREIGN KEY (transferred_by) REFERENCES public.users(id);


--
-- Name: batches batches_origin_juice_purchase_item_id_juice_purchase_items_id_f; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_origin_juice_purchase_item_id_juice_purchase_items_id_f FOREIGN KEY (origin_juice_purchase_item_id) REFERENCES public.juice_purchase_items(id);


--
-- Name: batches batches_origin_press_run_id_press_runs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_origin_press_run_id_press_runs_id_fk FOREIGN KEY (origin_press_run_id) REFERENCES public.press_runs(id);


--
-- Name: batches batches_vessel_id_vessels_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.batches
    ADD CONSTRAINT batches_vessel_id_vessels_id_fk FOREIGN KEY (vessel_id) REFERENCES public.vessels(id);


--
-- Name: bottle_run_photos bottle_run_photos_bottle_run_id_bottle_runs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.bottle_run_photos
    ADD CONSTRAINT bottle_run_photos_bottle_run_id_bottle_runs_id_fk FOREIGN KEY (bottle_run_id) REFERENCES public.bottle_runs(id) ON DELETE CASCADE;


--
-- Name: inventory_items inventory_items_bottle_run_id_bottle_runs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_bottle_run_id_bottle_runs_id_fk FOREIGN KEY (bottle_run_id) REFERENCES public.bottle_runs(id);


--
-- Name: juice_purchase_items juice_purchase_items_juice_variety_id_juice_varieties_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.juice_purchase_items
    ADD CONSTRAINT juice_purchase_items_juice_variety_id_juice_varieties_id_fk FOREIGN KEY (juice_variety_id) REFERENCES public.juice_varieties(id);


--
-- Name: juice_purchase_items juice_purchase_items_purchase_id_juice_purchases_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.juice_purchase_items
    ADD CONSTRAINT juice_purchase_items_purchase_id_juice_purchases_id_fk FOREIGN KEY (purchase_id) REFERENCES public.juice_purchases(id);


--
-- Name: juice_purchases juice_purchases_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.juice_purchases
    ADD CONSTRAINT juice_purchases_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: juice_purchases juice_purchases_updated_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.juice_purchases
    ADD CONSTRAINT juice_purchases_updated_by_users_id_fk FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: juice_purchases juice_purchases_vendor_id_vendors_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.juice_purchases
    ADD CONSTRAINT juice_purchases_vendor_id_vendors_id_fk FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: packaging_purchase_items packaging_purchase_items_packaging_variety_id_packaging_varieti; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packaging_purchase_items
    ADD CONSTRAINT packaging_purchase_items_packaging_variety_id_packaging_varieti FOREIGN KEY (packaging_variety_id) REFERENCES public.packaging_varieties(id);


--
-- Name: packaging_purchase_items packaging_purchase_items_purchase_id_packaging_purchases_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packaging_purchase_items
    ADD CONSTRAINT packaging_purchase_items_purchase_id_packaging_purchases_id_fk FOREIGN KEY (purchase_id) REFERENCES public.packaging_purchases(id);


--
-- Name: packaging_purchases packaging_purchases_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packaging_purchases
    ADD CONSTRAINT packaging_purchases_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: packaging_purchases packaging_purchases_updated_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packaging_purchases
    ADD CONSTRAINT packaging_purchases_updated_by_users_id_fk FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: packaging_purchases packaging_purchases_vendor_id_vendors_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.packaging_purchases
    ADD CONSTRAINT packaging_purchases_vendor_id_vendors_id_fk FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: press_run_loads press_run_loads_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.press_run_loads
    ADD CONSTRAINT press_run_loads_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: press_run_loads press_run_loads_fruit_variety_id_base_fruit_varieties_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.press_run_loads
    ADD CONSTRAINT press_run_loads_fruit_variety_id_base_fruit_varieties_id_fk FOREIGN KEY (fruit_variety_id) REFERENCES public.base_fruit_varieties(id);


--
-- Name: press_run_loads press_run_loads_press_run_id_press_runs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.press_run_loads
    ADD CONSTRAINT press_run_loads_press_run_id_press_runs_id_fk FOREIGN KEY (press_run_id) REFERENCES public.press_runs(id) ON DELETE CASCADE;


--
-- Name: press_run_loads press_run_loads_purchase_item_id_basefruit_purchase_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.press_run_loads
    ADD CONSTRAINT press_run_loads_purchase_item_id_basefruit_purchase_items_id_fk FOREIGN KEY (purchase_item_id) REFERENCES public.basefruit_purchase_items(id);


--
-- Name: press_run_loads press_run_loads_updated_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.press_run_loads
    ADD CONSTRAINT press_run_loads_updated_by_users_id_fk FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: press_runs press_runs_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.press_runs
    ADD CONSTRAINT press_runs_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: press_runs press_runs_updated_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.press_runs
    ADD CONSTRAINT press_runs_updated_by_users_id_fk FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: press_runs press_runs_vendor_id_vendors_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.press_runs
    ADD CONSTRAINT press_runs_vendor_id_vendors_id_fk FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);


--
-- Name: press_runs press_runs_vessel_id_vessels_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.press_runs
    ADD CONSTRAINT press_runs_vessel_id_vessels_id_fk FOREIGN KEY (vessel_id) REFERENCES public.vessels(id);


--
-- Name: vendor_additive_varieties vendor_additive_varieties_variety_id_additive_varieties_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendor_additive_varieties
    ADD CONSTRAINT vendor_additive_varieties_variety_id_additive_varieties_id_fk FOREIGN KEY (variety_id) REFERENCES public.additive_varieties(id) ON DELETE CASCADE;


--
-- Name: vendor_additive_varieties vendor_additive_varieties_vendor_id_vendors_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendor_additive_varieties
    ADD CONSTRAINT vendor_additive_varieties_vendor_id_vendors_id_fk FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: vendor_juice_varieties vendor_juice_varieties_variety_id_juice_varieties_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendor_juice_varieties
    ADD CONSTRAINT vendor_juice_varieties_variety_id_juice_varieties_id_fk FOREIGN KEY (variety_id) REFERENCES public.juice_varieties(id) ON DELETE CASCADE;


--
-- Name: vendor_juice_varieties vendor_juice_varieties_vendor_id_vendors_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendor_juice_varieties
    ADD CONSTRAINT vendor_juice_varieties_vendor_id_vendors_id_fk FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: vendor_packaging_varieties vendor_packaging_varieties_variety_id_packaging_varieties_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendor_packaging_varieties
    ADD CONSTRAINT vendor_packaging_varieties_variety_id_packaging_varieties_id_fk FOREIGN KEY (variety_id) REFERENCES public.packaging_varieties(id) ON DELETE CASCADE;


--
-- Name: vendor_packaging_varieties vendor_packaging_varieties_vendor_id_vendors_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendor_packaging_varieties
    ADD CONSTRAINT vendor_packaging_varieties_vendor_id_vendors_id_fk FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: vendor_varieties vendor_varieties_variety_id_base_fruit_varieties_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendor_varieties
    ADD CONSTRAINT vendor_varieties_variety_id_base_fruit_varieties_id_fk FOREIGN KEY (variety_id) REFERENCES public.base_fruit_varieties(id) ON DELETE CASCADE;


--
-- Name: vendor_varieties vendor_varieties_vendor_id_vendors_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vendor_varieties
    ADD CONSTRAINT vendor_varieties_vendor_id_vendors_id_fk FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

\unrestrict T7uaQNUJwgDeCCgxatYuqjMvv51gkRJie04M2lHhJbPBXuxVW2N5rjzytpHtuK1

