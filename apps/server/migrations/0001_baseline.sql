-- Baseline: the schema at Alembic revision 0003_contact_maps (apps/api), taken with pg_dump.
-- Object names are unqualified so the runner and tests can apply it inside any schema on the search_path.
CREATE EXTENSION IF NOT EXISTS postgis;


CREATE FUNCTION prevent_immutable_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN RAISE EXCEPTION 'immutable record'; END; $$;

CREATE TABLE account_deletion_requests (
    user_id uuid NOT NULL,
    status character varying(40) NOT NULL,
    operational_holds jsonb DEFAULT '{}'::jsonb NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE addresses (
    owner_id uuid NOT NULL,
    city_id uuid NOT NULL,
    label character varying(80) NOT NULL,
    line1 character varying(240) NOT NULL,
    locality character varying(120) NOT NULL,
    state character varying(100) NOT NULL,
    postal_code character varying(12) NOT NULL,
    latitude character varying(30) NOT NULL,
    longitude character varying(30) NOT NULL,
    point geography(Point,4326) NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    maps_url character varying(500),
    location_precision character varying(10) DEFAULT 'PIN'::character varying NOT NULL,
    CONSTRAINT ck_location_precision_values CHECK (((location_precision)::text = ANY ((ARRAY['PIN'::character varying, 'AREA'::character varying])::text[])))
);

CREATE TABLE assignments (
    job_id uuid NOT NULL,
    worker_id uuid NOT NULL,
    offer_id uuid NOT NULL,
    slot_number integer NOT NULL,
    status character varying(40) NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    accepted_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    replacement_of_id uuid,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_status_values CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'ACCEPTED'::character varying, 'EN_ROUTE'::character varying, 'ARRIVED'::character varying, 'IN_PROGRESS'::character varying, 'COMPLETED'::character varying, 'CANCELLED'::character varying, 'NO_SHOW'::character varying, 'REPLACED'::character varying])::text[])))
);

CREATE TABLE attendance_events (
    worker_id uuid NOT NULL,
    shift_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    type character varying(40) NOT NULL,
    observation jsonb DEFAULT '{}'::jsonb NOT NULL,
    device_timestamp timestamp with time zone,
    server_timestamp timestamp with time zone DEFAULT now() NOT NULL,
    reason text,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE audit_logs (
    actor_id uuid NOT NULL,
    action character varying(100) NOT NULL,
    entity_id uuid NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    request_id character varying(100) NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE auth_attempts (
    bucket character varying(64) NOT NULL,
    count integer NOT NULL,
    window_start timestamp with time zone NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE cancellations (
    job_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    reason text NOT NULL,
    fee_paise bigint,
    refund_paise bigint,
    metadata jsonb NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE candidate_matches (
    job_id uuid NOT NULL,
    worker_id uuid NOT NULL,
    distance_m integer NOT NULL,
    final_score integer NOT NULL,
    metadata jsonb NOT NULL,
    status character varying(40) NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE cities (
    name character varying(100) NOT NULL,
    state character varying(100) NOT NULL,
    country character varying(2) NOT NULL,
    slug character varying(100) NOT NULL,
    timezone character varying(80) NOT NULL,
    active boolean NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE client_profiles (
    user_id uuid NOT NULL,
    client_type character varying(20) NOT NULL,
    primary_address_id uuid,
    onboarding_complete boolean NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    whatsapp_number character varying(20),
    CONSTRAINT ck_client_type_values CHECK (((client_type)::text = ANY ((ARRAY['INDIVIDUAL'::character varying, 'BUSINESS'::character varying])::text[])))
);

CREATE TABLE documents (
    owner_id uuid NOT NULL,
    storage_key character varying(120) NOT NULL,
    purpose character varying(40) NOT NULL,
    mime_type character varying(100) NOT NULL,
    size_bytes integer NOT NULL,
    checksum character varying(64) NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE domain_events (
    type character varying(80) NOT NULL,
    aggregate_id uuid NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    delivered_at timestamp with time zone,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE idempotency_records (
    actor_id uuid NOT NULL,
    operation character varying(160) NOT NULL,
    key character varying(120) NOT NULL,
    request_hash character varying(64) NOT NULL,
    response jsonb DEFAULT '{}'::jsonb NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE incidents (
    assignment_id uuid NOT NULL,
    reporter_id uuid NOT NULL,
    type character varying(40) NOT NULL,
    description text NOT NULL,
    status character varying(40) NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_status_values CHECK (((status)::text = ANY ((ARRAY['OPEN'::character varying, 'UNDER_REVIEW'::character varying, 'RESOLVED'::character varying, 'CLOSED'::character varying])::text[])))
);

CREATE TABLE job_interests (
    job_id uuid NOT NULL,
    worker_id uuid NOT NULL,
    status character varying(40) NOT NULL,
    distance_m integer NOT NULL,
    offer_id uuid,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_status_values CHECK (((status)::text = ANY ((ARRAY['EXPRESSED'::character varying, 'WITHDRAWN'::character varying, 'SELECTED'::character varying])::text[])))
);

CREATE TABLE job_offers (
    job_id uuid NOT NULL,
    worker_id uuid NOT NULL,
    status character varying(40) NOT NULL,
    offered_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    responded_at timestamp with time zone,
    agreed_worker_amount_paise bigint NOT NULL,
    replacement_request_id uuid,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_status_values CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'ACCEPTED'::character varying, 'DECLINED'::character varying, 'EXPIRED'::character varying, 'WITHDRAWN'::character varying])::text[]))),
    CONSTRAINT job_offers_agreed_worker_amount_paise_check CHECK ((agreed_worker_amount_paise >= 0))
);

CREATE TABLE job_requests (
    client_id uuid NOT NULL,
    service_id uuid NOT NULL,
    service_area_id uuid NOT NULL,
    engagement_type character varying(20) NOT NULL,
    location_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    point geography(Point,4326) NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    schedule jsonb NOT NULL,
    recurring_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    headcount integer NOT NULL,
    budget_min bigint,
    budget_max bigint,
    currency character varying(3) NOT NULL,
    notes text NOT NULL,
    status character varying(40) NOT NULL,
    submitted_at timestamp with time zone,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    maps_url character varying(500),
    contact_whatsapp character varying(20),
    location_precision character varying(10) DEFAULT 'PIN'::character varying NOT NULL,
    CONSTRAINT ck_engagement_type_values CHECK (((engagement_type)::text = ANY ((ARRAY['HOURLY'::character varying, 'DAILY'::character varying, 'FIXED_TERM'::character varying, 'MONTHLY'::character varying])::text[]))),
    CONSTRAINT ck_location_precision_values CHECK (((location_precision)::text = ANY ((ARRAY['PIN'::character varying, 'AREA'::character varying])::text[]))),
    CONSTRAINT ck_status_values CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'SUBMITTED'::character varying, 'MATCHING'::character varying, 'OFFERING'::character varying, 'ASSIGNED'::character varying, 'ACTIVE'::character varying, 'COMPLETED'::character varying, 'CANCELLED'::character varying, 'EXPIRED'::character varying, 'ON_HOLD'::character varying])::text[]))),
    CONSTRAINT job_requests_budget_min_check CHECK (((budget_min IS NULL) OR (budget_min >= 0))),
    CONSTRAINT job_requests_check CHECK (((headcount > 0) AND (end_at > start_at))),
    CONSTRAINT job_requests_check1 CHECK (((budget_max IS NULL) OR (budget_max >= COALESCE(budget_min, (0)::bigint))))
);

CREATE TABLE job_requirements (
    job_id uuid NOT NULL,
    key character varying(80) NOT NULL,
    value jsonb NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE localities (
    city_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    name_hi character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    center geography(Point,4326),
    active boolean NOT NULL,
    sort_order integer NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE notifications (
    recipient_id uuid NOT NULL,
    event_id uuid NOT NULL,
    kind character varying(80) NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    read_at timestamp with time zone,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE password_resets (
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE payments (
    job_id uuid NOT NULL,
    payer_id uuid NOT NULL,
    method character varying(30) NOT NULL,
    amount_paise bigint NOT NULL,
    currency character varying(3) NOT NULL,
    status character varying(40) NOT NULL,
    provider_reference character varying(200),
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_method_values CHECK (((method)::text = ANY ((ARRAY['PAY_LATER'::character varying, 'CASH'::character varying, 'MANUAL_UPI'::character varying])::text[]))),
    CONSTRAINT ck_status_values CHECK (((status)::text = ANY ((ARRAY['CREATED'::character varying, 'PENDING'::character varying, 'AUTHORIZED'::character varying, 'CAPTURED'::character varying, 'FAILED'::character varying, 'REFUNDED'::character varying, 'PARTIALLY_REFUNDED'::character varying])::text[]))),
    CONSTRAINT payments_amount_paise_check CHECK ((amount_paise >= 0))
);

CREATE TABLE payouts (
    worker_id uuid NOT NULL,
    amount_paise bigint NOT NULL,
    currency character varying(3) NOT NULL,
    status character varying(40) NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_status_values CHECK (((status)::text = ANY ((ARRAY['REQUESTED'::character varying, 'APPROVED'::character varying, 'PROCESSING'::character varying, 'PAID'::character varying, 'FAILED'::character varying, 'REVERSED'::character varying])::text[]))),
    CONSTRAINT payouts_amount_paise_check CHECK ((amount_paise > 0))
);

CREATE TABLE replacement_requests (
    job_id uuid NOT NULL,
    original_assignment_id uuid NOT NULL,
    requester_id uuid NOT NULL,
    reason character varying(40) NOT NULL,
    details text NOT NULL,
    status character varying(40) NOT NULL,
    replacement_assignment_id uuid,
    resolved_at timestamp with time zone,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_status_values CHECK (((status)::text = ANY ((ARRAY['REQUESTED'::character varying, 'UNDER_REVIEW'::character varying, 'MATCHING'::character varying, 'OFFERING'::character varying, 'ASSIGNED'::character varying, 'RESOLVED'::character varying, 'REJECTED'::character varying, 'CANCELLED'::character varying])::text[])))
);

CREATE TABLE reviews (
    assignment_id uuid NOT NULL,
    reviewer_id uuid NOT NULL,
    reviewee_id uuid NOT NULL,
    rating integer NOT NULL,
    tags jsonb NOT NULL,
    comment text NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

CREATE TABLE service_areas (
    city_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    center geography(Point,4326) NOT NULL,
    radius_m integer NOT NULL,
    active boolean NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_areas_radius_m_check CHECK ((radius_m > 0))
);

CREATE TABLE service_categories (
    name character varying(100) NOT NULL,
    name_hi character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    icon character varying(60) NOT NULL,
    parent_id uuid,
    active boolean NOT NULL,
    sort_order integer NOT NULL,
    requirement_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    verification_types jsonb NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE sessions (
    user_id uuid NOT NULL,
    family_id uuid NOT NULL,
    refresh_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    consumed_at timestamp with time zone,
    device jsonb DEFAULT '{}'::jsonb NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE shifts (
    assignment_id uuid NOT NULL,
    scheduled_start timestamp with time zone NOT NULL,
    scheduled_end timestamp with time zone NOT NULL,
    status character varying(40) NOT NULL,
    agreed_earning_paise bigint NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_status_values CHECK (((status)::text = ANY ((ARRAY['SCHEDULED'::character varying, 'IN_PROGRESS'::character varying, 'COMPLETION_PENDING'::character varying, 'COMPLETED'::character varying, 'DISPUTED'::character varying, 'CANCELLED'::character varying, 'MISSED'::character varying])::text[]))),
    CONSTRAINT shifts_check CHECK (((scheduled_end > scheduled_start) AND (agreed_earning_paise >= 0)))
);

CREATE TABLE user_roles (
    user_id uuid NOT NULL,
    role character varying(30) NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_role_values CHECK (((role)::text = ANY ((ARRAY['CLIENT'::character varying, 'WORKER'::character varying, 'SUPER_ADMIN'::character varying, 'OPERATIONS'::character varying, 'VERIFICATION'::character varying, 'FINANCE'::character varying, 'SUPPORT'::character varying])::text[])))
);

CREATE TABLE users (
    full_name character varying(160) NOT NULL,
    email character varying(254) NOT NULL,
    phone_number character varying(20) NOT NULL,
    password_hash text NOT NULL,
    status character varying(40) NOT NULL,
    email_verified_at timestamp with time zone,
    phone_verified_at timestamp with time zone,
    preferences jsonb DEFAULT '{}'::jsonb NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_status_values CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'DISABLED'::character varying, 'DELETION_REQUESTED'::character varying])::text[])))
);

CREATE TABLE worker_availability (
    worker_id uuid NOT NULL,
    online boolean NOT NULL,
    kind character varying(20) NOT NULL,
    service_area_id uuid,
    point geography(Point,4326),
    radius_m integer NOT NULL,
    schedule jsonb DEFAULT '{}'::jsonb NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_kind_values CHECK (((kind)::text = ANY ((ARRAY['IMMEDIATE'::character varying, 'SCHEDULED'::character varying, 'RECURRING'::character varying])::text[]))),
    CONSTRAINT worker_availability_radius_m_check CHECK ((radius_m > 0))
);

CREATE TABLE worker_languages (
    worker_id uuid NOT NULL,
    language_code character varying(20) NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE worker_ledger_entries (
    worker_id uuid NOT NULL,
    type character varying(30) NOT NULL,
    amount_paise bigint NOT NULL,
    currency character varying(3) NOT NULL,
    shift_id uuid,
    payout_id uuid,
    reversal_of_id uuid,
    source_key character varying(200) NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_type_values CHECK (((type)::text = ANY ((ARRAY['EARNING'::character varying, 'BONUS'::character varying, 'INCENTIVE'::character varying, 'DEDUCTION'::character varying, 'ADJUSTMENT'::character varying, 'PAYOUT'::character varying, 'REVERSAL'::character varying])::text[])))
);

CREATE TABLE worker_profiles (
    user_id uuid NOT NULL,
    onboarding_status character varying(40) NOT NULL,
    worker_status character varying(40) NOT NULL,
    progress jsonb DEFAULT '{}'::jsonb NOT NULL,
    experience_years integer NOT NULL,
    engagement_types jsonb NOT NULL,
    rate_min_paise bigint,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_onboarding_status_values CHECK (((onboarding_status)::text = ANY ((ARRAY['NOT_STARTED'::character varying, 'IN_PROGRESS'::character varying, 'SUBMITTED'::character varying, 'COMPLETE'::character varying])::text[]))),
    CONSTRAINT ck_worker_status_values CHECK (((worker_status)::text = ANY ((ARRAY['PENDING_VERIFICATION'::character varying, 'ACTIVE'::character varying, 'SUSPENDED'::character varying, 'BLOCKED'::character varying, 'INACTIVE'::character varying])::text[])))
);

CREATE TABLE worker_services (
    worker_id uuid NOT NULL,
    service_id uuid NOT NULL,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE worker_verifications (
    worker_id uuid NOT NULL,
    document_id uuid NOT NULL,
    type character varying(40) NOT NULL,
    status character varying(40) NOT NULL,
    reviewer_id uuid,
    reviewed_at timestamp with time zone,
    expires_at timestamp with time zone,
    reason text,
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_status_values CHECK (((status)::text = ANY ((ARRAY['NOT_SUBMITTED'::character varying, 'PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'EXPIRED'::character varying])::text[]))),
    CONSTRAINT ck_type_values CHECK (((type)::text = ANY ((ARRAY['IDENTITY'::character varying, 'POLICE'::character varying, 'BANK'::character varying, 'DRIVING_LICENSE'::character varying, 'ADDRESS'::character varying, 'SKILL_CERTIFICATE'::character varying, 'REFERENCE'::character varying])::text[])))
);

ALTER TABLE ONLY account_deletion_requests
    ADD CONSTRAINT account_deletion_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY assignments
    ADD CONSTRAINT assignments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY attendance_events
    ADD CONSTRAINT attendance_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY auth_attempts
    ADD CONSTRAINT auth_attempts_bucket_window_start_key UNIQUE (bucket, window_start);

ALTER TABLE ONLY auth_attempts
    ADD CONSTRAINT auth_attempts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY cancellations
    ADD CONSTRAINT cancellations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY candidate_matches
    ADD CONSTRAINT candidate_matches_job_id_worker_id_key UNIQUE (job_id, worker_id);

ALTER TABLE ONLY candidate_matches
    ADD CONSTRAINT candidate_matches_pkey PRIMARY KEY (id);

ALTER TABLE ONLY cities
    ADD CONSTRAINT cities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY cities
    ADD CONSTRAINT cities_slug_key UNIQUE (slug);

ALTER TABLE ONLY client_profiles
    ADD CONSTRAINT client_profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);

ALTER TABLE ONLY documents
    ADD CONSTRAINT documents_storage_key_key UNIQUE (storage_key);

ALTER TABLE ONLY domain_events
    ADD CONSTRAINT domain_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY idempotency_records
    ADD CONSTRAINT idempotency_records_actor_id_operation_key_key UNIQUE (actor_id, operation, key);

ALTER TABLE ONLY idempotency_records
    ADD CONSTRAINT idempotency_records_pkey PRIMARY KEY (id);

ALTER TABLE ONLY incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (id);

ALTER TABLE ONLY job_interests
    ADD CONSTRAINT job_interests_job_id_worker_id_key UNIQUE (job_id, worker_id);

ALTER TABLE ONLY job_interests
    ADD CONSTRAINT job_interests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY job_offers
    ADD CONSTRAINT job_offers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY job_requests
    ADD CONSTRAINT job_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY job_requirements
    ADD CONSTRAINT job_requirements_job_id_key_key UNIQUE (job_id, key);

ALTER TABLE ONLY job_requirements
    ADD CONSTRAINT job_requirements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY localities
    ADD CONSTRAINT localities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY localities
    ADD CONSTRAINT localities_slug_key UNIQUE (slug);

ALTER TABLE ONLY notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY notifications
    ADD CONSTRAINT notifications_recipient_id_event_id_key UNIQUE (recipient_id, event_id);

ALTER TABLE ONLY password_resets
    ADD CONSTRAINT password_resets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY password_resets
    ADD CONSTRAINT password_resets_token_hash_key UNIQUE (token_hash);

ALTER TABLE ONLY payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY payments
    ADD CONSTRAINT payments_provider_reference_key UNIQUE (provider_reference);

ALTER TABLE ONLY payouts
    ADD CONSTRAINT payouts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY replacement_requests
    ADD CONSTRAINT replacement_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY reviews
    ADD CONSTRAINT reviews_assignment_id_reviewer_id_reviewee_id_key UNIQUE (assignment_id, reviewer_id, reviewee_id);

ALTER TABLE ONLY reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);

ALTER TABLE ONLY service_areas
    ADD CONSTRAINT service_areas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY service_areas
    ADD CONSTRAINT service_areas_slug_key UNIQUE (slug);

ALTER TABLE ONLY service_categories
    ADD CONSTRAINT service_categories_pkey PRIMARY KEY (id);

ALTER TABLE ONLY service_categories
    ADD CONSTRAINT service_categories_slug_key UNIQUE (slug);

ALTER TABLE ONLY sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY sessions
    ADD CONSTRAINT sessions_refresh_hash_key UNIQUE (refresh_hash);

ALTER TABLE ONLY shifts
    ADD CONSTRAINT shifts_assignment_id_scheduled_start_key UNIQUE (assignment_id, scheduled_start);

ALTER TABLE ONLY shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);

ALTER TABLE ONLY users
    ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE ONLY users
    ADD CONSTRAINT users_phone_number_key UNIQUE (phone_number);

ALTER TABLE ONLY users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY worker_availability
    ADD CONSTRAINT worker_availability_pkey PRIMARY KEY (id);

ALTER TABLE ONLY worker_languages
    ADD CONSTRAINT worker_languages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY worker_languages
    ADD CONSTRAINT worker_languages_worker_id_language_code_key UNIQUE (worker_id, language_code);

ALTER TABLE ONLY worker_ledger_entries
    ADD CONSTRAINT worker_ledger_entries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY worker_ledger_entries
    ADD CONSTRAINT worker_ledger_entries_source_key_key UNIQUE (source_key);

ALTER TABLE ONLY worker_profiles
    ADD CONSTRAINT worker_profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY worker_services
    ADD CONSTRAINT worker_services_pkey PRIMARY KEY (id);

ALTER TABLE ONLY worker_services
    ADD CONSTRAINT worker_services_worker_id_service_id_key UNIQUE (worker_id, service_id);

ALTER TABLE ONLY worker_verifications
    ADD CONSTRAINT worker_verifications_pkey PRIMARY KEY (id);

CREATE INDEX idx_addresses_point ON addresses USING gist (point);

CREATE INDEX idx_job_requests_point ON job_requests USING gist (point);

CREATE INDEX idx_service_areas_center ON service_areas USING gist (center);

CREATE INDEX idx_worker_availability_point ON worker_availability USING gist (point);

CREATE INDEX ix_account_deletion_requests_status ON account_deletion_requests USING btree (status);

CREATE UNIQUE INDEX ix_account_deletion_requests_user_id ON account_deletion_requests USING btree (user_id);

CREATE INDEX ix_addresses_city_id ON addresses USING btree (city_id);

CREATE INDEX ix_addresses_owner_id ON addresses USING btree (owner_id);

CREATE INDEX ix_assignments_job_id ON assignments USING btree (job_id);

CREATE UNIQUE INDEX ix_assignments_offer_id ON assignments USING btree (offer_id);

CREATE INDEX ix_assignments_replacement_of_id ON assignments USING btree (replacement_of_id);

CREATE INDEX ix_assignments_status ON assignments USING btree (status);

CREATE INDEX ix_assignments_worker_id ON assignments USING btree (worker_id);

CREATE INDEX ix_attendance_events_actor_id ON attendance_events USING btree (actor_id);

CREATE INDEX ix_attendance_events_shift_id ON attendance_events USING btree (shift_id);

CREATE INDEX ix_attendance_events_worker_id ON attendance_events USING btree (worker_id);

CREATE INDEX ix_audit_logs_actor_id ON audit_logs USING btree (actor_id);

CREATE INDEX ix_auth_attempts_bucket ON auth_attempts USING btree (bucket);

CREATE INDEX ix_cancellations_actor_id ON cancellations USING btree (actor_id);

CREATE INDEX ix_cancellations_job_id ON cancellations USING btree (job_id);

CREATE INDEX ix_candidate_matches_job_id ON candidate_matches USING btree (job_id);

CREATE INDEX ix_candidate_matches_status ON candidate_matches USING btree (status);

CREATE INDEX ix_candidate_matches_worker_id ON candidate_matches USING btree (worker_id);

CREATE INDEX ix_client_profiles_primary_address_id ON client_profiles USING btree (primary_address_id);

CREATE UNIQUE INDEX ix_client_profiles_user_id ON client_profiles USING btree (user_id);

CREATE INDEX ix_documents_owner_id ON documents USING btree (owner_id);

CREATE INDEX ix_domain_events_aggregate_id ON domain_events USING btree (aggregate_id);

CREATE INDEX ix_idempotency_records_actor_id ON idempotency_records USING btree (actor_id);

CREATE INDEX ix_incidents_assignment_id ON incidents USING btree (assignment_id);

CREATE INDEX ix_incidents_reporter_id ON incidents USING btree (reporter_id);

CREATE INDEX ix_incidents_status ON incidents USING btree (status);

CREATE INDEX ix_job_interests_job_id ON job_interests USING btree (job_id);

CREATE INDEX ix_job_interests_offer_id ON job_interests USING btree (offer_id);

CREATE INDEX ix_job_interests_status ON job_interests USING btree (status);

CREATE INDEX ix_job_interests_worker_id ON job_interests USING btree (worker_id);

CREATE INDEX ix_job_offers_job_id ON job_offers USING btree (job_id);

CREATE INDEX ix_job_offers_replacement_request_id ON job_offers USING btree (replacement_request_id);

CREATE INDEX ix_job_offers_status ON job_offers USING btree (status);

CREATE INDEX ix_job_offers_worker_id ON job_offers USING btree (worker_id);

CREATE INDEX ix_job_requests_client_id ON job_requests USING btree (client_id);

CREATE INDEX ix_job_requests_service_area_id ON job_requests USING btree (service_area_id);

CREATE INDEX ix_job_requests_service_id ON job_requests USING btree (service_id);

CREATE INDEX ix_job_requests_status ON job_requests USING btree (status);

CREATE INDEX ix_job_requirements_job_id ON job_requirements USING btree (job_id);

CREATE INDEX ix_localities_city_id ON localities USING btree (city_id);

CREATE INDEX ix_notifications_event_id ON notifications USING btree (event_id);

CREATE INDEX ix_notifications_recipient_id ON notifications USING btree (recipient_id);

CREATE INDEX ix_password_resets_user_id ON password_resets USING btree (user_id);

CREATE INDEX ix_payments_job_id ON payments USING btree (job_id);

CREATE INDEX ix_payments_payer_id ON payments USING btree (payer_id);

CREATE INDEX ix_payments_status ON payments USING btree (status);

CREATE INDEX ix_payouts_status ON payouts USING btree (status);

CREATE INDEX ix_payouts_worker_id ON payouts USING btree (worker_id);

CREATE INDEX ix_replacement_requests_job_id ON replacement_requests USING btree (job_id);

CREATE INDEX ix_replacement_requests_original_assignment_id ON replacement_requests USING btree (original_assignment_id);

CREATE INDEX ix_replacement_requests_replacement_assignment_id ON replacement_requests USING btree (replacement_assignment_id);

CREATE INDEX ix_replacement_requests_requester_id ON replacement_requests USING btree (requester_id);

CREATE INDEX ix_replacement_requests_status ON replacement_requests USING btree (status);

CREATE INDEX ix_reviews_assignment_id ON reviews USING btree (assignment_id);

CREATE INDEX ix_reviews_reviewee_id ON reviews USING btree (reviewee_id);

CREATE INDEX ix_reviews_reviewer_id ON reviews USING btree (reviewer_id);

CREATE INDEX ix_service_areas_city_id ON service_areas USING btree (city_id);

CREATE INDEX ix_service_categories_parent_id ON service_categories USING btree (parent_id);

CREATE INDEX ix_sessions_family_id ON sessions USING btree (family_id);

CREATE INDEX ix_sessions_user_id ON sessions USING btree (user_id);

CREATE INDEX ix_shifts_assignment_id ON shifts USING btree (assignment_id);

CREATE INDEX ix_shifts_status ON shifts USING btree (status);

CREATE INDEX ix_user_roles_user_id ON user_roles USING btree (user_id);

CREATE INDEX ix_users_status ON users USING btree (status);

CREATE INDEX ix_worker_availability_service_area_id ON worker_availability USING btree (service_area_id);

CREATE UNIQUE INDEX ix_worker_availability_worker_id ON worker_availability USING btree (worker_id);

CREATE INDEX ix_worker_languages_worker_id ON worker_languages USING btree (worker_id);

CREATE INDEX ix_worker_ledger_entries_payout_id ON worker_ledger_entries USING btree (payout_id);

CREATE INDEX ix_worker_ledger_entries_reversal_of_id ON worker_ledger_entries USING btree (reversal_of_id);

CREATE INDEX ix_worker_ledger_entries_shift_id ON worker_ledger_entries USING btree (shift_id);

CREATE INDEX ix_worker_ledger_entries_worker_id ON worker_ledger_entries USING btree (worker_id);

CREATE INDEX ix_worker_profiles_onboarding_status ON worker_profiles USING btree (onboarding_status);

CREATE UNIQUE INDEX ix_worker_profiles_user_id ON worker_profiles USING btree (user_id);

CREATE INDEX ix_worker_profiles_worker_status ON worker_profiles USING btree (worker_status);

CREATE INDEX ix_worker_services_service_id ON worker_services USING btree (service_id);

CREATE INDEX ix_worker_services_worker_id ON worker_services USING btree (worker_id);

CREATE INDEX ix_worker_verifications_document_id ON worker_verifications USING btree (document_id);

CREATE INDEX ix_worker_verifications_reviewer_id ON worker_verifications USING btree (reviewer_id);

CREATE INDEX ix_worker_verifications_status ON worker_verifications USING btree (status);

CREATE INDEX ix_worker_verifications_worker_id ON worker_verifications USING btree (worker_id);

CREATE UNIQUE INDEX uq_live_job_slot ON assignments USING btree (job_id, slot_number) WHERE ((status)::text <> ALL ((ARRAY['CANCELLED'::character varying, 'NO_SHOW'::character varying, 'REPLACED'::character varying])::text[]));

CREATE UNIQUE INDEX uq_open_replacement ON replacement_requests USING btree (original_assignment_id) WHERE ((status)::text <> ALL ((ARRAY['RESOLVED'::character varying, 'REJECTED'::character varying, 'CANCELLED'::character varying])::text[]));

CREATE UNIQUE INDEX uq_pending_offer ON job_offers USING btree (job_id, worker_id) WHERE ((status)::text = 'PENDING'::text);

CREATE TRIGGER immutable_attendance_events BEFORE DELETE OR UPDATE ON attendance_events FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();

CREATE TRIGGER immutable_audit_logs BEFORE DELETE OR UPDATE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();

CREATE TRIGGER immutable_cancellations BEFORE DELETE OR UPDATE ON cancellations FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();

CREATE TRIGGER immutable_worker_ledger_entries BEFORE DELETE OR UPDATE ON worker_ledger_entries FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation();

ALTER TABLE ONLY account_deletion_requests
    ADD CONSTRAINT account_deletion_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY addresses
    ADD CONSTRAINT addresses_city_id_fkey FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE RESTRICT;

ALTER TABLE ONLY addresses
    ADD CONSTRAINT addresses_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY assignments
    ADD CONSTRAINT assignments_job_id_fkey FOREIGN KEY (job_id) REFERENCES job_requests(id) ON DELETE RESTRICT;

ALTER TABLE ONLY assignments
    ADD CONSTRAINT assignments_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES job_offers(id) ON DELETE RESTRICT;

ALTER TABLE ONLY assignments
    ADD CONSTRAINT assignments_replacement_of_id_fkey FOREIGN KEY (replacement_of_id) REFERENCES assignments(id) ON DELETE RESTRICT;

ALTER TABLE ONLY assignments
    ADD CONSTRAINT assignments_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY attendance_events
    ADD CONSTRAINT attendance_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY attendance_events
    ADD CONSTRAINT attendance_events_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE RESTRICT;

ALTER TABLE ONLY attendance_events
    ADD CONSTRAINT attendance_events_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY cancellations
    ADD CONSTRAINT cancellations_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY cancellations
    ADD CONSTRAINT cancellations_job_id_fkey FOREIGN KEY (job_id) REFERENCES job_requests(id) ON DELETE RESTRICT;

ALTER TABLE ONLY candidate_matches
    ADD CONSTRAINT candidate_matches_job_id_fkey FOREIGN KEY (job_id) REFERENCES job_requests(id) ON DELETE RESTRICT;

ALTER TABLE ONLY candidate_matches
    ADD CONSTRAINT candidate_matches_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY client_profiles
    ADD CONSTRAINT client_profiles_primary_address_id_fkey FOREIGN KEY (primary_address_id) REFERENCES addresses(id) ON DELETE RESTRICT;

ALTER TABLE ONLY client_profiles
    ADD CONSTRAINT client_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY documents
    ADD CONSTRAINT documents_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY idempotency_records
    ADD CONSTRAINT idempotency_records_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY incidents
    ADD CONSTRAINT incidents_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE RESTRICT;

ALTER TABLE ONLY incidents
    ADD CONSTRAINT incidents_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY job_interests
    ADD CONSTRAINT job_interests_job_id_fkey FOREIGN KEY (job_id) REFERENCES job_requests(id) ON DELETE RESTRICT;

ALTER TABLE ONLY job_interests
    ADD CONSTRAINT job_interests_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES job_offers(id) ON DELETE RESTRICT;

ALTER TABLE ONLY job_interests
    ADD CONSTRAINT job_interests_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY job_offers
    ADD CONSTRAINT job_offers_job_id_fkey FOREIGN KEY (job_id) REFERENCES job_requests(id) ON DELETE RESTRICT;

ALTER TABLE ONLY job_offers
    ADD CONSTRAINT job_offers_replacement_request_id_fkey FOREIGN KEY (replacement_request_id) REFERENCES replacement_requests(id) ON DELETE RESTRICT;

ALTER TABLE ONLY job_offers
    ADD CONSTRAINT job_offers_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY job_requests
    ADD CONSTRAINT job_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY job_requests
    ADD CONSTRAINT job_requests_service_area_id_fkey FOREIGN KEY (service_area_id) REFERENCES service_areas(id) ON DELETE RESTRICT;

ALTER TABLE ONLY job_requests
    ADD CONSTRAINT job_requests_service_id_fkey FOREIGN KEY (service_id) REFERENCES service_categories(id) ON DELETE RESTRICT;

ALTER TABLE ONLY job_requirements
    ADD CONSTRAINT job_requirements_job_id_fkey FOREIGN KEY (job_id) REFERENCES job_requests(id) ON DELETE RESTRICT;

ALTER TABLE ONLY localities
    ADD CONSTRAINT localities_city_id_fkey FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE RESTRICT;

ALTER TABLE ONLY notifications
    ADD CONSTRAINT notifications_event_id_fkey FOREIGN KEY (event_id) REFERENCES domain_events(id) ON DELETE RESTRICT;

ALTER TABLE ONLY notifications
    ADD CONSTRAINT notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY password_resets
    ADD CONSTRAINT password_resets_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY payments
    ADD CONSTRAINT payments_job_id_fkey FOREIGN KEY (job_id) REFERENCES job_requests(id) ON DELETE RESTRICT;

ALTER TABLE ONLY payments
    ADD CONSTRAINT payments_payer_id_fkey FOREIGN KEY (payer_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY payouts
    ADD CONSTRAINT payouts_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY replacement_requests
    ADD CONSTRAINT replacement_requests_job_id_fkey FOREIGN KEY (job_id) REFERENCES job_requests(id) ON DELETE RESTRICT;

ALTER TABLE ONLY replacement_requests
    ADD CONSTRAINT replacement_requests_original_assignment_id_fkey FOREIGN KEY (original_assignment_id) REFERENCES assignments(id) ON DELETE RESTRICT;

ALTER TABLE ONLY replacement_requests
    ADD CONSTRAINT replacement_requests_replacement_assignment_id_fkey FOREIGN KEY (replacement_assignment_id) REFERENCES assignments(id) ON DELETE RESTRICT;

ALTER TABLE ONLY replacement_requests
    ADD CONSTRAINT replacement_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY reviews
    ADD CONSTRAINT reviews_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE RESTRICT;

ALTER TABLE ONLY reviews
    ADD CONSTRAINT reviews_reviewee_id_fkey FOREIGN KEY (reviewee_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY reviews
    ADD CONSTRAINT reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY service_areas
    ADD CONSTRAINT service_areas_city_id_fkey FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE RESTRICT;

ALTER TABLE ONLY service_categories
    ADD CONSTRAINT service_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES service_categories(id) ON DELETE RESTRICT;

ALTER TABLE ONLY sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY shifts
    ADD CONSTRAINT shifts_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE RESTRICT;

ALTER TABLE ONLY user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY worker_availability
    ADD CONSTRAINT worker_availability_service_area_id_fkey FOREIGN KEY (service_area_id) REFERENCES service_areas(id) ON DELETE RESTRICT;

ALTER TABLE ONLY worker_availability
    ADD CONSTRAINT worker_availability_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY worker_languages
    ADD CONSTRAINT worker_languages_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY worker_ledger_entries
    ADD CONSTRAINT worker_ledger_entries_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES payouts(id) ON DELETE RESTRICT;

ALTER TABLE ONLY worker_ledger_entries
    ADD CONSTRAINT worker_ledger_entries_reversal_of_id_fkey FOREIGN KEY (reversal_of_id) REFERENCES worker_ledger_entries(id) ON DELETE RESTRICT;

ALTER TABLE ONLY worker_ledger_entries
    ADD CONSTRAINT worker_ledger_entries_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE RESTRICT;

ALTER TABLE ONLY worker_ledger_entries
    ADD CONSTRAINT worker_ledger_entries_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY worker_profiles
    ADD CONSTRAINT worker_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY worker_services
    ADD CONSTRAINT worker_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES service_categories(id) ON DELETE RESTRICT;

ALTER TABLE ONLY worker_services
    ADD CONSTRAINT worker_services_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE RESTRICT;

ALTER TABLE ONLY worker_verifications
    ADD CONSTRAINT worker_verifications_document_id_fkey FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE RESTRICT;

ALTER TABLE ONLY worker_verifications
    ADD CONSTRAINT worker_verifications_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY worker_verifications
    ADD CONSTRAINT worker_verifications_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES worker_profiles(id) ON DELETE RESTRICT;

