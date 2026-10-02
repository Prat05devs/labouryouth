"""Initial production domain schema, frozen DDL."""

from alembic import op

revision = "0001_domain"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute(
        "CREATE TABLE users (\n\tfull_name VARCHAR(160) NOT NULL, \n\temail VARCHAR(254) NOT NULL, \n\tphone_number VARCHAR(20) NOT NULL, \n\tpassword_hash TEXT NOT NULL, \n\tstatus VARCHAR(40) NOT NULL, \n\temail_verified_at TIMESTAMP WITH TIME ZONE, \n\tphone_verified_at TIMESTAMP WITH TIME ZONE, \n\tpreferences JSONB DEFAULT '{}'::jsonb NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT ck_status_values CHECK (status IN ('ACTIVE','DISABLED','DELETION_REQUESTED')), \n\tUNIQUE (email), \n\tUNIQUE (phone_number)\n)"
    )
    op.execute("CREATE INDEX ix_users_status ON users (status)")
    op.execute(
        "CREATE TABLE cities (\n\tname VARCHAR(100) NOT NULL, \n\tstate VARCHAR(100) NOT NULL, \n\tcountry VARCHAR(2) NOT NULL, \n\tslug VARCHAR(100) NOT NULL, \n\ttimezone VARCHAR(80) NOT NULL, \n\tactive BOOLEAN NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (slug)\n)"
    )
    op.execute(
        "CREATE TABLE service_categories (\n\tname VARCHAR(100) NOT NULL, \n\tname_hi VARCHAR(100) NOT NULL, \n\tslug VARCHAR(100) NOT NULL, \n\ticon VARCHAR(60) NOT NULL, \n\tparent_id UUID, \n\tactive BOOLEAN NOT NULL, \n\tsort_order INTEGER NOT NULL, \n\trequirement_schema JSONB DEFAULT '{}'::jsonb NOT NULL, \n\tverification_types JSONB NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (slug), \n\tFOREIGN KEY(parent_id) REFERENCES service_categories (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX ix_service_categories_parent_id ON service_categories (parent_id)")
    op.execute(
        "CREATE TABLE job_offers (\n\tjob_id UUID NOT NULL, \n\tworker_id UUID NOT NULL, \n\tstatus VARCHAR(40) NOT NULL, \n\toffered_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\texpires_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tresponded_at TIMESTAMP WITH TIME ZONE, \n\tagreed_worker_amount_paise BIGINT NOT NULL, \n\treplacement_request_id UUID, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT ck_status_values CHECK (status IN ('PENDING','ACCEPTED','DECLINED','EXPIRED','WITHDRAWN')), \n\tCHECK (agreed_worker_amount_paise >= 0)\n)"
    )
    op.execute("CREATE INDEX ix_job_offers_replacement_request_id ON job_offers (replacement_request_id)")
    op.execute("CREATE INDEX ix_job_offers_job_id ON job_offers (job_id)")
    op.execute("CREATE INDEX ix_job_offers_worker_id ON job_offers (worker_id)")
    op.execute(
        "CREATE UNIQUE INDEX uq_pending_offer ON job_offers (job_id, worker_id) WHERE status = 'PENDING'"
    )
    op.execute("CREATE INDEX ix_job_offers_status ON job_offers (status)")
    op.execute(
        "CREATE TABLE assignments (\n\tjob_id UUID NOT NULL, \n\tworker_id UUID NOT NULL, \n\toffer_id UUID NOT NULL, \n\tslot_number INTEGER NOT NULL, \n\tstatus VARCHAR(40) NOT NULL, \n\tassigned_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\taccepted_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tstarted_at TIMESTAMP WITH TIME ZONE, \n\tcompleted_at TIMESTAMP WITH TIME ZONE, \n\treplacement_of_id UUID, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT ck_status_values CHECK (status IN ('PENDING','ACCEPTED','EN_ROUTE','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW','REPLACED'))\n)"
    )
    op.execute("CREATE INDEX ix_assignments_replacement_of_id ON assignments (replacement_of_id)")
    op.execute("CREATE INDEX ix_assignments_job_id ON assignments (job_id)")
    op.execute("CREATE INDEX ix_assignments_status ON assignments (status)")
    op.execute(
        "CREATE UNIQUE INDEX uq_live_job_slot ON assignments (job_id, slot_number) WHERE status NOT IN ('CANCELLED','NO_SHOW','REPLACED')"
    )
    op.execute("CREATE INDEX ix_assignments_worker_id ON assignments (worker_id)")
    op.execute("CREATE UNIQUE INDEX ix_assignments_offer_id ON assignments (offer_id)")
    op.execute(
        "CREATE TABLE replacement_requests (\n\tjob_id UUID NOT NULL, \n\toriginal_assignment_id UUID NOT NULL, \n\trequester_id UUID NOT NULL, \n\treason VARCHAR(40) NOT NULL, \n\tdetails TEXT NOT NULL, \n\tstatus VARCHAR(40) NOT NULL, \n\treplacement_assignment_id UUID, \n\tresolved_at TIMESTAMP WITH TIME ZONE, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT ck_status_values CHECK (status IN ('REQUESTED','UNDER_REVIEW','MATCHING','OFFERING','ASSIGNED','RESOLVED','REJECTED','CANCELLED'))\n)"
    )
    op.execute(
        "CREATE INDEX ix_replacement_requests_original_assignment_id ON replacement_requests (original_assignment_id)"
    )
    op.execute(
        "CREATE INDEX ix_replacement_requests_replacement_assignment_id ON replacement_requests (replacement_assignment_id)"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_open_replacement ON replacement_requests (original_assignment_id) WHERE status NOT IN ('RESOLVED','REJECTED','CANCELLED')"
    )
    op.execute("CREATE INDEX ix_replacement_requests_status ON replacement_requests (status)")
    op.execute("CREATE INDEX ix_replacement_requests_requester_id ON replacement_requests (requester_id)")
    op.execute("CREATE INDEX ix_replacement_requests_job_id ON replacement_requests (job_id)")
    op.execute(
        "CREATE TABLE domain_events (\n\ttype VARCHAR(80) NOT NULL, \n\taggregate_id UUID NOT NULL, \n\tpayload JSONB DEFAULT '{}'::jsonb NOT NULL, \n\tdelivered_at TIMESTAMP WITH TIME ZONE, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id)\n)"
    )
    op.execute("CREATE INDEX ix_domain_events_aggregate_id ON domain_events (aggregate_id)")
    op.execute(
        "CREATE TABLE auth_attempts (\n\tbucket VARCHAR(64) NOT NULL, \n\tcount INTEGER NOT NULL, \n\twindow_start TIMESTAMP WITH TIME ZONE NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (bucket, window_start)\n)"
    )
    op.execute("CREATE INDEX ix_auth_attempts_bucket ON auth_attempts (bucket)")
    op.execute(
        "CREATE TABLE user_roles (\n\tuser_id UUID NOT NULL, \n\trole VARCHAR(30) NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (user_id, role), \n\tCONSTRAINT ck_role_values CHECK (role IN ('CLIENT','WORKER','SUPER_ADMIN','OPERATIONS','VERIFICATION','FINANCE','SUPPORT')), \n\tFOREIGN KEY(user_id) REFERENCES users (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX ix_user_roles_user_id ON user_roles (user_id)")
    op.execute(
        "CREATE TABLE sessions (\n\tuser_id UUID NOT NULL, \n\tfamily_id UUID NOT NULL, \n\trefresh_hash VARCHAR(64) NOT NULL, \n\texpires_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\trevoked_at TIMESTAMP WITH TIME ZONE, \n\tconsumed_at TIMESTAMP WITH TIME ZONE, \n\tdevice JSONB DEFAULT '{}'::jsonb NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(user_id) REFERENCES users (id) ON DELETE RESTRICT, \n\tUNIQUE (refresh_hash)\n)"
    )
    op.execute("CREATE INDEX ix_sessions_family_id ON sessions (family_id)")
    op.execute("CREATE INDEX ix_sessions_user_id ON sessions (user_id)")
    op.execute(
        "CREATE TABLE password_resets (\n\tuser_id UUID NOT NULL, \n\ttoken_hash VARCHAR(64) NOT NULL, \n\texpires_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tconsumed_at TIMESTAMP WITH TIME ZONE, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(user_id) REFERENCES users (id) ON DELETE RESTRICT, \n\tUNIQUE (token_hash)\n)"
    )
    op.execute("CREATE INDEX ix_password_resets_user_id ON password_resets (user_id)")
    op.execute(
        "CREATE TABLE service_areas (\n\tcity_id UUID NOT NULL, \n\tname VARCHAR(100) NOT NULL, \n\tslug VARCHAR(100) NOT NULL, \n\tcenter geography(POINT,4326) NOT NULL, \n\tradius_m INTEGER NOT NULL, \n\tactive BOOLEAN NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tCHECK (radius_m > 0), \n\tFOREIGN KEY(city_id) REFERENCES cities (id) ON DELETE RESTRICT, \n\tUNIQUE (slug)\n)"
    )
    op.execute("CREATE INDEX ix_service_areas_city_id ON service_areas (city_id)")
    op.execute("CREATE INDEX idx_service_areas_center ON service_areas USING gist (center)")
    op.execute(
        "CREATE TABLE addresses (\n\towner_id UUID NOT NULL, \n\tcity_id UUID NOT NULL, \n\tlabel VARCHAR(80) NOT NULL, \n\tline1 VARCHAR(240) NOT NULL, \n\tlocality VARCHAR(120) NOT NULL, \n\tstate VARCHAR(100) NOT NULL, \n\tpostal_code VARCHAR(12) NOT NULL, \n\tlatitude VARCHAR(30) NOT NULL, \n\tlongitude VARCHAR(30) NOT NULL, \n\tpoint geography(POINT,4326) NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE RESTRICT, \n\tFOREIGN KEY(city_id) REFERENCES cities (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX idx_addresses_point ON addresses USING gist (point)")
    op.execute("CREATE INDEX ix_addresses_city_id ON addresses (city_id)")
    op.execute("CREATE INDEX ix_addresses_owner_id ON addresses (owner_id)")
    op.execute(
        "CREATE TABLE worker_profiles (\n\tuser_id UUID NOT NULL, \n\tonboarding_status VARCHAR(40) NOT NULL, \n\tworker_status VARCHAR(40) NOT NULL, \n\tprogress JSONB DEFAULT '{}'::jsonb NOT NULL, \n\texperience_years INTEGER NOT NULL, \n\tengagement_types JSONB NOT NULL, \n\trate_min_paise BIGINT, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT ck_onboarding_status_values CHECK (onboarding_status IN ('NOT_STARTED','IN_PROGRESS','SUBMITTED','COMPLETE')), \n\tCONSTRAINT ck_worker_status_values CHECK (worker_status IN ('PENDING_VERIFICATION','ACTIVE','SUSPENDED','BLOCKED','INACTIVE')), \n\tFOREIGN KEY(user_id) REFERENCES users (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX ix_worker_profiles_worker_status ON worker_profiles (worker_status)")
    op.execute("CREATE INDEX ix_worker_profiles_onboarding_status ON worker_profiles (onboarding_status)")
    op.execute("CREATE UNIQUE INDEX ix_worker_profiles_user_id ON worker_profiles (user_id)")
    op.execute(
        "CREATE TABLE documents (\n\towner_id UUID NOT NULL, \n\tstorage_key VARCHAR(120) NOT NULL, \n\tpurpose VARCHAR(40) NOT NULL, \n\tmime_type VARCHAR(100) NOT NULL, \n\tsize_bytes INTEGER NOT NULL, \n\tchecksum VARCHAR(64) NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE RESTRICT, \n\tUNIQUE (storage_key)\n)"
    )
    op.execute("CREATE INDEX ix_documents_owner_id ON documents (owner_id)")
    op.execute(
        "CREATE TABLE shifts (\n\tassignment_id UUID NOT NULL, \n\tscheduled_start TIMESTAMP WITH TIME ZONE NOT NULL, \n\tscheduled_end TIMESTAMP WITH TIME ZONE NOT NULL, \n\tstatus VARCHAR(40) NOT NULL, \n\tagreed_earning_paise BIGINT NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT ck_status_values CHECK (status IN ('SCHEDULED','IN_PROGRESS','COMPLETION_PENDING','COMPLETED','DISPUTED','CANCELLED','MISSED')), \n\tUNIQUE (assignment_id, scheduled_start), \n\tCHECK (scheduled_end > scheduled_start AND agreed_earning_paise >= 0), \n\tFOREIGN KEY(assignment_id) REFERENCES assignments (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX ix_shifts_assignment_id ON shifts (assignment_id)")
    op.execute("CREATE INDEX ix_shifts_status ON shifts (status)")
    op.execute(
        "CREATE TABLE incidents (\n\tassignment_id UUID NOT NULL, \n\treporter_id UUID NOT NULL, \n\ttype VARCHAR(40) NOT NULL, \n\tdescription TEXT NOT NULL, \n\tstatus VARCHAR(40) NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT ck_status_values CHECK (status IN ('OPEN','UNDER_REVIEW','RESOLVED','CLOSED')), \n\tFOREIGN KEY(assignment_id) REFERENCES assignments (id) ON DELETE RESTRICT, \n\tFOREIGN KEY(reporter_id) REFERENCES users (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX ix_incidents_assignment_id ON incidents (assignment_id)")
    op.execute("CREATE INDEX ix_incidents_reporter_id ON incidents (reporter_id)")
    op.execute("CREATE INDEX ix_incidents_status ON incidents (status)")
    op.execute(
        "CREATE TABLE reviews (\n\tassignment_id UUID NOT NULL, \n\treviewer_id UUID NOT NULL, \n\treviewee_id UUID NOT NULL, \n\trating INTEGER NOT NULL, \n\ttags JSONB NOT NULL, \n\tcomment TEXT NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (assignment_id, reviewer_id, reviewee_id), \n\tCHECK (rating BETWEEN 1 AND 5), \n\tFOREIGN KEY(assignment_id) REFERENCES assignments (id) ON DELETE RESTRICT, \n\tFOREIGN KEY(reviewer_id) REFERENCES users (id) ON DELETE RESTRICT, \n\tFOREIGN KEY(reviewee_id) REFERENCES users (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX ix_reviews_reviewee_id ON reviews (reviewee_id)")
    op.execute("CREATE INDEX ix_reviews_reviewer_id ON reviews (reviewer_id)")
    op.execute("CREATE INDEX ix_reviews_assignment_id ON reviews (assignment_id)")
    op.execute(
        "CREATE TABLE notifications (\n\trecipient_id UUID NOT NULL, \n\tevent_id UUID NOT NULL, \n\tkind VARCHAR(80) NOT NULL, \n\tpayload JSONB DEFAULT '{}'::jsonb NOT NULL, \n\tread_at TIMESTAMP WITH TIME ZONE, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (recipient_id, event_id), \n\tFOREIGN KEY(recipient_id) REFERENCES users (id) ON DELETE RESTRICT, \n\tFOREIGN KEY(event_id) REFERENCES domain_events (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX ix_notifications_event_id ON notifications (event_id)")
    op.execute("CREATE INDEX ix_notifications_recipient_id ON notifications (recipient_id)")
    op.execute(
        "CREATE TABLE audit_logs (\n\tactor_id UUID NOT NULL, \n\taction VARCHAR(100) NOT NULL, \n\tentity_id UUID NOT NULL, \n\tdetails JSONB DEFAULT '{}'::jsonb NOT NULL, \n\trequest_id VARCHAR(100) NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(actor_id) REFERENCES users (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX ix_audit_logs_actor_id ON audit_logs (actor_id)")
    op.execute(
        "CREATE TABLE idempotency_records (\n\tactor_id UUID NOT NULL, \n\toperation VARCHAR(160) NOT NULL, \n\tkey VARCHAR(120) NOT NULL, \n\trequest_hash VARCHAR(64) NOT NULL, \n\tresponse JSONB DEFAULT '{}'::jsonb NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (actor_id, operation, key), \n\tFOREIGN KEY(actor_id) REFERENCES users (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX ix_idempotency_records_actor_id ON idempotency_records (actor_id)")
    op.execute(
        "CREATE TABLE account_deletion_requests (\n\tuser_id UUID NOT NULL, \n\tstatus VARCHAR(40) NOT NULL, \n\toperational_holds JSONB DEFAULT '{}'::jsonb NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(user_id) REFERENCES users (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX ix_account_deletion_requests_status ON account_deletion_requests (status)")
    op.execute(
        "CREATE UNIQUE INDEX ix_account_deletion_requests_user_id ON account_deletion_requests (user_id)"
    )
    op.execute(
        "CREATE TABLE client_profiles (\n\tuser_id UUID NOT NULL, \n\tclient_type VARCHAR(20) NOT NULL, \n\tprimary_address_id UUID, \n\tonboarding_complete BOOLEAN NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT ck_client_type_values CHECK (client_type IN ('INDIVIDUAL','BUSINESS')), \n\tFOREIGN KEY(user_id) REFERENCES users (id) ON DELETE RESTRICT, \n\tFOREIGN KEY(primary_address_id) REFERENCES addresses (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX ix_client_profiles_primary_address_id ON client_profiles (primary_address_id)")
    op.execute("CREATE UNIQUE INDEX ix_client_profiles_user_id ON client_profiles (user_id)")
    op.execute(
        "CREATE TABLE worker_services (\n\tworker_id UUID NOT NULL, \n\tservice_id UUID NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (worker_id, service_id), \n\tFOREIGN KEY(worker_id) REFERENCES worker_profiles (id) ON DELETE RESTRICT, \n\tFOREIGN KEY(service_id) REFERENCES service_categories (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX ix_worker_services_service_id ON worker_services (service_id)")
    op.execute("CREATE INDEX ix_worker_services_worker_id ON worker_services (worker_id)")
    op.execute(
        "CREATE TABLE worker_languages (\n\tworker_id UUID NOT NULL, \n\tlanguage_code VARCHAR(20) NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (worker_id, language_code), \n\tFOREIGN KEY(worker_id) REFERENCES worker_profiles (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX ix_worker_languages_worker_id ON worker_languages (worker_id)")
    op.execute(
        "CREATE TABLE worker_availability (\n\tworker_id UUID NOT NULL, \n\tonline BOOLEAN NOT NULL, \n\tkind VARCHAR(20) NOT NULL, \n\tservice_area_id UUID, \n\tpoint geography(POINT,4326), \n\tradius_m INTEGER NOT NULL, \n\tschedule JSONB DEFAULT '{}'::jsonb NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT ck_kind_values CHECK (kind IN ('IMMEDIATE','SCHEDULED','RECURRING')), \n\tCHECK (radius_m > 0), \n\tFOREIGN KEY(worker_id) REFERENCES worker_profiles (id) ON DELETE RESTRICT, \n\tFOREIGN KEY(service_area_id) REFERENCES service_areas (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX ix_worker_availability_service_area_id ON worker_availability (service_area_id)")
    op.execute("CREATE INDEX idx_worker_availability_point ON worker_availability USING gist (point)")
    op.execute("CREATE UNIQUE INDEX ix_worker_availability_worker_id ON worker_availability (worker_id)")
    op.execute(
        "CREATE TABLE worker_verifications (\n\tworker_id UUID NOT NULL, \n\tdocument_id UUID NOT NULL, \n\ttype VARCHAR(40) NOT NULL, \n\tstatus VARCHAR(40) NOT NULL, \n\treviewer_id UUID, \n\treviewed_at TIMESTAMP WITH TIME ZONE, \n\texpires_at TIMESTAMP WITH TIME ZONE, \n\treason TEXT, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT ck_type_values CHECK (type IN ('IDENTITY','POLICE','BANK','DRIVING_LICENSE','ADDRESS','SKILL_CERTIFICATE','REFERENCE')), \n\tCONSTRAINT ck_status_values CHECK (status IN ('NOT_SUBMITTED','PENDING','APPROVED','REJECTED','EXPIRED')), \n\tFOREIGN KEY(worker_id) REFERENCES worker_profiles (id) ON DELETE RESTRICT, \n\tFOREIGN KEY(document_id) REFERENCES documents (id) ON DELETE RESTRICT, \n\tFOREIGN KEY(reviewer_id) REFERENCES users (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX ix_worker_verifications_worker_id ON worker_verifications (worker_id)")
    op.execute("CREATE INDEX ix_worker_verifications_document_id ON worker_verifications (document_id)")
    op.execute("CREATE INDEX ix_worker_verifications_status ON worker_verifications (status)")
    op.execute("CREATE INDEX ix_worker_verifications_reviewer_id ON worker_verifications (reviewer_id)")
    op.execute(
        "CREATE TABLE job_requests (\n\tclient_id UUID NOT NULL, \n\tservice_id UUID NOT NULL, \n\tservice_area_id UUID NOT NULL, \n\tengagement_type VARCHAR(20) NOT NULL, \n\tlocation_snapshot JSONB DEFAULT '{}'::jsonb NOT NULL, \n\tpoint geography(POINT,4326) NOT NULL, \n\tstart_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tend_at TIMESTAMP WITH TIME ZONE NOT NULL, \n\tschedule JSONB NOT NULL, \n\trecurring_metadata JSONB DEFAULT '{}'::jsonb NOT NULL, \n\theadcount INTEGER NOT NULL, \n\tbudget_min BIGINT, \n\tbudget_max BIGINT, \n\tcurrency VARCHAR(3) NOT NULL, \n\tnotes TEXT NOT NULL, \n\tstatus VARCHAR(40) NOT NULL, \n\tsubmitted_at TIMESTAMP WITH TIME ZONE, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT ck_engagement_type_values CHECK (engagement_type IN ('HOURLY','DAILY','FIXED_TERM','MONTHLY')), \n\tCONSTRAINT ck_status_values CHECK (status IN ('DRAFT','SUBMITTED','MATCHING','OFFERING','ASSIGNED','ACTIVE','COMPLETED','CANCELLED','EXPIRED','ON_HOLD')), \n\tCHECK (headcount > 0 AND end_at > start_at), \n\tCHECK (budget_min IS NULL OR budget_min >= 0), \n\tCHECK (budget_max IS NULL OR budget_max >= COALESCE(budget_min,0)), \n\tFOREIGN KEY(client_id) REFERENCES users (id) ON DELETE RESTRICT, \n\tFOREIGN KEY(service_id) REFERENCES service_categories (id) ON DELETE RESTRICT, \n\tFOREIGN KEY(service_area_id) REFERENCES service_areas (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX ix_job_requests_service_area_id ON job_requests (service_area_id)")
    op.execute("CREATE INDEX ix_job_requests_service_id ON job_requests (service_id)")
    op.execute("CREATE INDEX ix_job_requests_client_id ON job_requests (client_id)")
    op.execute("CREATE INDEX ix_job_requests_status ON job_requests (status)")
    op.execute("CREATE INDEX idx_job_requests_point ON job_requests USING gist (point)")
    op.execute(
        "CREATE TABLE attendance_events (\n\tworker_id UUID NOT NULL, \n\tshift_id UUID NOT NULL, \n\tactor_id UUID NOT NULL, \n\ttype VARCHAR(40) NOT NULL, \n\tobservation JSONB DEFAULT '{}'::jsonb NOT NULL, \n\tdevice_timestamp TIMESTAMP WITH TIME ZONE, \n\tserver_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\treason TEXT, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(worker_id) REFERENCES worker_profiles (id) ON DELETE RESTRICT, \n\tFOREIGN KEY(shift_id) REFERENCES shifts (id) ON DELETE RESTRICT, \n\tFOREIGN KEY(actor_id) REFERENCES users (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX ix_attendance_events_shift_id ON attendance_events (shift_id)")
    op.execute("CREATE INDEX ix_attendance_events_worker_id ON attendance_events (worker_id)")
    op.execute("CREATE INDEX ix_attendance_events_actor_id ON attendance_events (actor_id)")
    op.execute(
        "CREATE TABLE payouts (\n\tworker_id UUID NOT NULL, \n\tamount_paise BIGINT NOT NULL, \n\tcurrency VARCHAR(3) NOT NULL, \n\tstatus VARCHAR(40) NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT ck_status_values CHECK (status IN ('REQUESTED','APPROVED','PROCESSING','PAID','FAILED','REVERSED')), \n\tCHECK (amount_paise > 0), \n\tFOREIGN KEY(worker_id) REFERENCES worker_profiles (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX ix_payouts_worker_id ON payouts (worker_id)")
    op.execute("CREATE INDEX ix_payouts_status ON payouts (status)")
    op.execute(
        "CREATE TABLE job_requirements (\n\tjob_id UUID NOT NULL, \n\tkey VARCHAR(80) NOT NULL, \n\tvalue JSONB NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (job_id, key), \n\tFOREIGN KEY(job_id) REFERENCES job_requests (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX ix_job_requirements_job_id ON job_requirements (job_id)")
    op.execute(
        "CREATE TABLE candidate_matches (\n\tjob_id UUID NOT NULL, \n\tworker_id UUID NOT NULL, \n\tdistance_m INTEGER NOT NULL, \n\tfinal_score INTEGER NOT NULL, \n\tmetadata JSONB NOT NULL, \n\tstatus VARCHAR(40) NOT NULL, \n\tgenerated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (job_id, worker_id), \n\tFOREIGN KEY(job_id) REFERENCES job_requests (id) ON DELETE RESTRICT, \n\tFOREIGN KEY(worker_id) REFERENCES worker_profiles (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX ix_candidate_matches_status ON candidate_matches (status)")
    op.execute("CREATE INDEX ix_candidate_matches_job_id ON candidate_matches (job_id)")
    op.execute("CREATE INDEX ix_candidate_matches_worker_id ON candidate_matches (worker_id)")
    op.execute(
        "CREATE TABLE cancellations (\n\tjob_id UUID NOT NULL, \n\tactor_id UUID NOT NULL, \n\treason TEXT NOT NULL, \n\tfee_paise BIGINT, \n\trefund_paise BIGINT, \n\tmetadata JSONB NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(job_id) REFERENCES job_requests (id) ON DELETE RESTRICT, \n\tFOREIGN KEY(actor_id) REFERENCES users (id) ON DELETE RESTRICT\n)"
    )
    op.execute("CREATE INDEX ix_cancellations_actor_id ON cancellations (actor_id)")
    op.execute("CREATE INDEX ix_cancellations_job_id ON cancellations (job_id)")
    op.execute(
        "CREATE TABLE payments (\n\tjob_id UUID NOT NULL, \n\tpayer_id UUID NOT NULL, \n\tmethod VARCHAR(30) NOT NULL, \n\tamount_paise BIGINT NOT NULL, \n\tcurrency VARCHAR(3) NOT NULL, \n\tstatus VARCHAR(40) NOT NULL, \n\tprovider_reference VARCHAR(200), \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT ck_status_values CHECK (status IN ('CREATED','PENDING','AUTHORIZED','CAPTURED','FAILED','REFUNDED','PARTIALLY_REFUNDED')), \n\tCONSTRAINT ck_method_values CHECK (method IN ('PAY_LATER','CASH','MANUAL_UPI')), \n\tCHECK (amount_paise >= 0), \n\tFOREIGN KEY(job_id) REFERENCES job_requests (id) ON DELETE RESTRICT, \n\tFOREIGN KEY(payer_id) REFERENCES users (id) ON DELETE RESTRICT, \n\tUNIQUE (provider_reference)\n)"
    )
    op.execute("CREATE INDEX ix_payments_job_id ON payments (job_id)")
    op.execute("CREATE INDEX ix_payments_payer_id ON payments (payer_id)")
    op.execute("CREATE INDEX ix_payments_status ON payments (status)")
    op.execute(
        "CREATE TABLE worker_ledger_entries (\n\tworker_id UUID NOT NULL, \n\ttype VARCHAR(30) NOT NULL, \n\tamount_paise BIGINT NOT NULL, \n\tcurrency VARCHAR(3) NOT NULL, \n\tshift_id UUID, \n\tpayout_id UUID, \n\treversal_of_id UUID, \n\tsource_key VARCHAR(200) NOT NULL, \n\tid UUID NOT NULL, \n\tcreated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT ck_type_values CHECK (type IN ('EARNING','BONUS','INCENTIVE','DEDUCTION','ADJUSTMENT','PAYOUT','REVERSAL')), \n\tFOREIGN KEY(worker_id) REFERENCES worker_profiles (id) ON DELETE RESTRICT, \n\tFOREIGN KEY(shift_id) REFERENCES shifts (id) ON DELETE RESTRICT, \n\tFOREIGN KEY(payout_id) REFERENCES payouts (id) ON DELETE RESTRICT, \n\tFOREIGN KEY(reversal_of_id) REFERENCES worker_ledger_entries (id) ON DELETE RESTRICT, \n\tUNIQUE (source_key)\n)"
    )
    op.execute("CREATE INDEX ix_worker_ledger_entries_worker_id ON worker_ledger_entries (worker_id)")
    op.execute(
        "CREATE INDEX ix_worker_ledger_entries_reversal_of_id ON worker_ledger_entries (reversal_of_id)"
    )
    op.execute("CREATE INDEX ix_worker_ledger_entries_shift_id ON worker_ledger_entries (shift_id)")
    op.execute("CREATE INDEX ix_worker_ledger_entries_payout_id ON worker_ledger_entries (payout_id)")
    op.execute(
        "ALTER TABLE job_offers ADD FOREIGN KEY(replacement_request_id) REFERENCES replacement_requests (id) ON DELETE RESTRICT"
    )
    op.execute(
        "ALTER TABLE replacement_requests ADD FOREIGN KEY(replacement_assignment_id) REFERENCES assignments (id) ON DELETE RESTRICT"
    )
    op.execute(
        "ALTER TABLE assignments ADD FOREIGN KEY(offer_id) REFERENCES job_offers (id) ON DELETE RESTRICT"
    )
    op.execute(
        "ALTER TABLE replacement_requests ADD FOREIGN KEY(requester_id) REFERENCES users (id) ON DELETE RESTRICT"
    )
    op.execute(
        "ALTER TABLE assignments ADD FOREIGN KEY(replacement_of_id) REFERENCES assignments (id) ON DELETE RESTRICT"
    )
    op.execute(
        "ALTER TABLE job_offers ADD FOREIGN KEY(job_id) REFERENCES job_requests (id) ON DELETE RESTRICT"
    )
    op.execute(
        "ALTER TABLE assignments ADD FOREIGN KEY(job_id) REFERENCES job_requests (id) ON DELETE RESTRICT"
    )
    op.execute(
        "ALTER TABLE replacement_requests ADD FOREIGN KEY(original_assignment_id) REFERENCES assignments (id) ON DELETE RESTRICT"
    )
    op.execute(
        "ALTER TABLE replacement_requests ADD FOREIGN KEY(job_id) REFERENCES job_requests (id) ON DELETE RESTRICT"
    )
    op.execute(
        "ALTER TABLE assignments ADD FOREIGN KEY(worker_id) REFERENCES worker_profiles (id) ON DELETE RESTRICT"
    )
    op.execute(
        "ALTER TABLE job_offers ADD FOREIGN KEY(worker_id) REFERENCES worker_profiles (id) ON DELETE RESTRICT"
    )
    op.execute(
        "CREATE FUNCTION prevent_immutable_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'immutable record'; END; $$"
    )
    op.execute(
        "CREATE TRIGGER immutable_worker_ledger_entries BEFORE UPDATE OR DELETE ON worker_ledger_entries FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation()"
    )
    op.execute(
        "CREATE TRIGGER immutable_attendance_events BEFORE UPDATE OR DELETE ON attendance_events FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation()"
    )
    op.execute(
        "CREATE TRIGGER immutable_audit_logs BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation()"
    )
    op.execute(
        "CREATE TRIGGER immutable_cancellations BEFORE UPDATE OR DELETE ON cancellations FOR EACH ROW EXECUTE FUNCTION prevent_immutable_mutation()"
    )


def downgrade():
    raise RuntimeError(
        "Destructive downgrade requires reviewed backup/restore; no automatic deletion of financial or attendance history."
    )
