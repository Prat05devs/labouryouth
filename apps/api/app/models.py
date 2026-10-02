import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Entity:
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))


def fk(table, **kw):
    return mapped_column(UUID(as_uuid=True), ForeignKey(table + ".id", ondelete="RESTRICT"), index=True, **kw)


def js():
    return mapped_column(JSONB, default=dict, server_default=text("'{}'::jsonb"))


def status(default):
    return mapped_column(String(40), default=default, index=True)


def timecol(**kw):
    return mapped_column(DateTime(timezone=True), **kw)


def choices(column, values):
    return CheckConstraint(
        column + " IN (" + ",".join("'" + v + "'" for v in values.split()) + ")",
        name="ck_" + column + "_values",
    )


class User(Entity, Base):
    __tablename__ = "users"
    full_name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(254), unique=True)
    phone_number: Mapped[str] = mapped_column(String(20), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = status("ACTIVE")
    email_verified_at: Mapped[datetime | None] = timecol()
    phone_verified_at: Mapped[datetime | None] = timecol()
    preferences: Mapped[dict] = js()
    __table_args__ = (choices("status", "ACTIVE DISABLED DELETION_REQUESTED"),)


class UserRole(Entity, Base):
    __tablename__ = "user_roles"
    user_id: Mapped[uuid.UUID] = fk("users")
    role: Mapped[str] = mapped_column(String(30))
    __table_args__ = (
        UniqueConstraint("user_id", "role"),
        choices("role", "CLIENT WORKER SUPER_ADMIN OPERATIONS VERIFICATION FINANCE SUPPORT"),
    )


class Session(Entity, Base):
    __tablename__ = "sessions"
    user_id: Mapped[uuid.UUID] = fk("users")
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    refresh_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = timecol()
    revoked_at: Mapped[datetime | None] = timecol()
    consumed_at: Mapped[datetime | None] = timecol()
    device: Mapped[dict] = js()


class PasswordReset(Entity, Base):
    __tablename__ = "password_resets"
    user_id: Mapped[uuid.UUID] = fk("users")
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = timecol()
    consumed_at: Mapped[datetime | None] = timecol()


class City(Entity, Base):
    __tablename__ = "cities"
    name: Mapped[str] = mapped_column(String(100))
    state: Mapped[str] = mapped_column(String(100))
    country: Mapped[str] = mapped_column(String(2), default="IN")
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    timezone: Mapped[str] = mapped_column(String(80), default="Asia/Kolkata")
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class ServiceArea(Entity, Base):
    __tablename__ = "service_areas"
    city_id: Mapped[uuid.UUID] = fk("cities")
    name: Mapped[str] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    center: Mapped[str] = mapped_column(Geography("POINT", srid=4326))
    radius_m: Mapped[int] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (CheckConstraint("radius_m > 0"),)


class ServiceCategory(Entity, Base):
    __tablename__ = "service_categories"
    name: Mapped[str] = mapped_column(String(100))
    name_hi: Mapped[str] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    icon: Mapped[str] = mapped_column(String(60))
    parent_id: Mapped[uuid.UUID | None] = fk("service_categories")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    requirement_schema: Mapped[dict] = js()
    verification_types: Mapped[list] = mapped_column(JSONB, default=lambda: ["IDENTITY", "POLICE"])


class Address(Entity, Base):
    __tablename__ = "addresses"
    owner_id: Mapped[uuid.UUID] = fk("users")
    city_id: Mapped[uuid.UUID] = fk("cities")
    label: Mapped[str] = mapped_column(String(80))
    line1: Mapped[str] = mapped_column(String(240))
    locality: Mapped[str] = mapped_column(String(120))
    state: Mapped[str] = mapped_column(String(100))
    postal_code: Mapped[str] = mapped_column(String(12))
    latitude: Mapped[str] = mapped_column(String(30))
    longitude: Mapped[str] = mapped_column(String(30))
    point: Mapped[str] = mapped_column(Geography("POINT", srid=4326))


class ClientProfile(Entity, Base):
    __tablename__ = "client_profiles"
    user_id: Mapped[uuid.UUID] = fk("users", unique=True)
    client_type: Mapped[str] = mapped_column(String(20), default="INDIVIDUAL")
    primary_address_id: Mapped[uuid.UUID | None] = fk("addresses")
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    __table_args__ = (choices("client_type", "INDIVIDUAL BUSINESS"),)


class WorkerProfile(Entity, Base):
    __tablename__ = "worker_profiles"
    user_id: Mapped[uuid.UUID] = fk("users", unique=True)
    onboarding_status: Mapped[str] = status("NOT_STARTED")
    worker_status: Mapped[str] = status("PENDING_VERIFICATION")
    progress: Mapped[dict] = js()
    experience_years: Mapped[int] = mapped_column(Integer, default=0)
    engagement_types: Mapped[list] = mapped_column(
        JSONB, default=lambda: ["HOURLY", "DAILY", "FIXED_TERM", "MONTHLY"]
    )
    rate_min_paise: Mapped[int | None] = mapped_column(BigInteger)
    __table_args__ = (
        choices("onboarding_status", "NOT_STARTED IN_PROGRESS SUBMITTED COMPLETE"),
        choices("worker_status", "PENDING_VERIFICATION ACTIVE SUSPENDED BLOCKED INACTIVE"),
    )


class WorkerService(Entity, Base):
    __tablename__ = "worker_services"
    worker_id: Mapped[uuid.UUID] = fk("worker_profiles")
    service_id: Mapped[uuid.UUID] = fk("service_categories")
    __table_args__ = (UniqueConstraint("worker_id", "service_id"),)


class WorkerLanguage(Entity, Base):
    __tablename__ = "worker_languages"
    worker_id: Mapped[uuid.UUID] = fk("worker_profiles")
    language_code: Mapped[str] = mapped_column(String(20))
    __table_args__ = (UniqueConstraint("worker_id", "language_code"),)


class WorkerAvailability(Entity, Base):
    __tablename__ = "worker_availability"
    worker_id: Mapped[uuid.UUID] = fk("worker_profiles", unique=True)
    online: Mapped[bool] = mapped_column(Boolean, default=False)
    kind: Mapped[str] = mapped_column(String(20), default="IMMEDIATE")
    service_area_id: Mapped[uuid.UUID | None] = fk("service_areas")
    point: Mapped[str | None] = mapped_column(Geography("POINT", srid=4326))
    radius_m: Mapped[int] = mapped_column(Integer, default=15000)
    schedule: Mapped[dict] = js()
    __table_args__ = (choices("kind", "IMMEDIATE SCHEDULED RECURRING"), CheckConstraint("radius_m > 0"))


class Document(Entity, Base):
    __tablename__ = "documents"
    owner_id: Mapped[uuid.UUID] = fk("users")
    storage_key: Mapped[str] = mapped_column(String(120), unique=True)
    purpose: Mapped[str] = mapped_column(String(40))
    mime_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    checksum: Mapped[str] = mapped_column(String(64))


class WorkerVerification(Entity, Base):
    __tablename__ = "worker_verifications"
    worker_id: Mapped[uuid.UUID] = fk("worker_profiles")
    document_id: Mapped[uuid.UUID] = fk("documents")
    type: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = status("PENDING")
    reviewer_id: Mapped[uuid.UUID | None] = fk("users")
    reviewed_at: Mapped[datetime | None] = timecol()
    expires_at: Mapped[datetime | None] = timecol()
    reason: Mapped[str | None] = mapped_column(Text)
    __table_args__ = (
        choices("type", "IDENTITY POLICE BANK DRIVING_LICENSE ADDRESS SKILL_CERTIFICATE REFERENCE"),
        choices("status", "NOT_SUBMITTED PENDING APPROVED REJECTED EXPIRED"),
    )


class JobRequest(Entity, Base):
    __tablename__ = "job_requests"
    client_id: Mapped[uuid.UUID] = fk("users")
    service_id: Mapped[uuid.UUID] = fk("service_categories")
    service_area_id: Mapped[uuid.UUID] = fk("service_areas")
    engagement_type: Mapped[str] = mapped_column(String(20))
    location_snapshot: Mapped[dict] = js()
    point: Mapped[str] = mapped_column(Geography("POINT", srid=4326))
    start_at: Mapped[datetime] = timecol()
    end_at: Mapped[datetime] = timecol()
    schedule: Mapped[list] = mapped_column(JSONB)
    recurring_metadata: Mapped[dict] = js()
    headcount: Mapped[int] = mapped_column(Integer, default=1)
    budget_min: Mapped[int | None] = mapped_column(BigInteger)
    budget_max: Mapped[int | None] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    notes: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = status("DRAFT")
    submitted_at: Mapped[datetime | None] = timecol()
    __table_args__ = (
        choices("engagement_type", "HOURLY DAILY FIXED_TERM MONTHLY"),
        choices(
            "status", "DRAFT SUBMITTED MATCHING OFFERING ASSIGNED ACTIVE COMPLETED CANCELLED EXPIRED ON_HOLD"
        ),
        CheckConstraint("headcount > 0 AND end_at > start_at"),
        CheckConstraint("budget_min IS NULL OR budget_min >= 0"),
        CheckConstraint("budget_max IS NULL OR budget_max >= COALESCE(budget_min,0)"),
    )


class JobRequirement(Entity, Base):
    __tablename__ = "job_requirements"
    job_id: Mapped[uuid.UUID] = fk("job_requests")
    key: Mapped[str] = mapped_column(String(80))
    value: Mapped[dict] = mapped_column(JSONB)
    __table_args__ = (UniqueConstraint("job_id", "key"),)


class CandidateMatch(Entity, Base):
    __tablename__ = "candidate_matches"
    job_id: Mapped[uuid.UUID] = fk("job_requests")
    worker_id: Mapped[uuid.UUID] = fk("worker_profiles")
    distance_m: Mapped[int] = mapped_column(Integer)
    final_score: Mapped[int] = mapped_column(Integer)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    status: Mapped[str] = status("ELIGIBLE")
    generated_at: Mapped[datetime] = timecol(server_default=text("now()"))
    __table_args__ = (UniqueConstraint("job_id", "worker_id"),)


class JobOffer(Entity, Base):
    __tablename__ = "job_offers"
    job_id: Mapped[uuid.UUID] = fk("job_requests")
    worker_id: Mapped[uuid.UUID] = fk("worker_profiles")
    status: Mapped[str] = status("PENDING")
    offered_at: Mapped[datetime] = timecol(server_default=text("now()"))
    expires_at: Mapped[datetime] = timecol()
    responded_at: Mapped[datetime | None] = timecol()
    agreed_worker_amount_paise: Mapped[int] = mapped_column(BigInteger)
    replacement_request_id: Mapped[uuid.UUID | None] = fk("replacement_requests")
    __table_args__ = (
        choices("status", "PENDING ACCEPTED DECLINED EXPIRED WITHDRAWN"),
        CheckConstraint("agreed_worker_amount_paise >= 0"),
        Index(
            "uq_pending_offer",
            "job_id",
            "worker_id",
            unique=True,
            postgresql_where=text("status = 'PENDING'"),
        ),
    )


class Assignment(Entity, Base):
    __tablename__ = "assignments"
    job_id: Mapped[uuid.UUID] = fk("job_requests")
    worker_id: Mapped[uuid.UUID] = fk("worker_profiles")
    offer_id: Mapped[uuid.UUID] = fk("job_offers", unique=True)
    slot_number: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = status("ACCEPTED")
    assigned_at: Mapped[datetime] = timecol(server_default=text("now()"))
    accepted_at: Mapped[datetime] = timecol(server_default=text("now()"))
    started_at: Mapped[datetime | None] = timecol()
    completed_at: Mapped[datetime | None] = timecol()
    replacement_of_id: Mapped[uuid.UUID | None] = fk("assignments")
    __table_args__ = (
        choices(
            "status", "PENDING ACCEPTED EN_ROUTE ARRIVED IN_PROGRESS COMPLETED CANCELLED NO_SHOW REPLACED"
        ),
        Index(
            "uq_live_job_slot",
            "job_id",
            "slot_number",
            unique=True,
            postgresql_where=text("status NOT IN ('CANCELLED','NO_SHOW','REPLACED')"),
        ),
    )


class Shift(Entity, Base):
    __tablename__ = "shifts"
    assignment_id: Mapped[uuid.UUID] = fk("assignments")
    scheduled_start: Mapped[datetime] = timecol()
    scheduled_end: Mapped[datetime] = timecol()
    status: Mapped[str] = status("SCHEDULED")
    agreed_earning_paise: Mapped[int] = mapped_column(BigInteger)
    __table_args__ = (
        choices("status", "SCHEDULED IN_PROGRESS COMPLETION_PENDING COMPLETED DISPUTED CANCELLED MISSED"),
        UniqueConstraint("assignment_id", "scheduled_start"),
        CheckConstraint("scheduled_end > scheduled_start AND agreed_earning_paise >= 0"),
    )


class AttendanceEvent(Entity, Base):
    __tablename__ = "attendance_events"
    worker_id: Mapped[uuid.UUID] = fk("worker_profiles")
    shift_id: Mapped[uuid.UUID] = fk("shifts")
    actor_id: Mapped[uuid.UUID] = fk("users")
    type: Mapped[str] = mapped_column(String(40))
    observation: Mapped[dict] = js()
    device_timestamp: Mapped[datetime | None] = timecol()
    server_timestamp: Mapped[datetime] = timecol(server_default=text("now()"))
    reason: Mapped[str | None] = mapped_column(Text)


class ReplacementRequest(Entity, Base):
    __tablename__ = "replacement_requests"
    job_id: Mapped[uuid.UUID] = fk("job_requests")
    original_assignment_id: Mapped[uuid.UUID] = fk("assignments")
    requester_id: Mapped[uuid.UUID] = fk("users")
    reason: Mapped[str] = mapped_column(String(40))
    details: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = status("REQUESTED")
    replacement_assignment_id: Mapped[uuid.UUID | None] = fk("assignments")
    resolved_at: Mapped[datetime | None] = timecol()
    __table_args__ = (
        choices("status", "REQUESTED UNDER_REVIEW MATCHING OFFERING ASSIGNED RESOLVED REJECTED CANCELLED"),
        Index(
            "uq_open_replacement",
            "original_assignment_id",
            unique=True,
            postgresql_where=text("status NOT IN ('RESOLVED','REJECTED','CANCELLED')"),
        ),
    )


class Cancellation(Entity, Base):
    __tablename__ = "cancellations"
    job_id: Mapped[uuid.UUID] = fk("job_requests")
    actor_id: Mapped[uuid.UUID] = fk("users")
    reason: Mapped[str] = mapped_column(Text)
    fee_paise: Mapped[int | None] = mapped_column(BigInteger)
    refund_paise: Mapped[int | None] = mapped_column(BigInteger)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)


class Incident(Entity, Base):
    __tablename__ = "incidents"
    assignment_id: Mapped[uuid.UUID] = fk("assignments")
    reporter_id: Mapped[uuid.UUID] = fk("users")
    type: Mapped[str] = mapped_column(String(40))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = status("OPEN")
    __table_args__ = (choices("status", "OPEN UNDER_REVIEW RESOLVED CLOSED"),)


class Review(Entity, Base):
    __tablename__ = "reviews"
    assignment_id: Mapped[uuid.UUID] = fk("assignments")
    reviewer_id: Mapped[uuid.UUID] = fk("users")
    reviewee_id: Mapped[uuid.UUID] = fk("users")
    rating: Mapped[int] = mapped_column(Integer)
    tags: Mapped[list] = mapped_column(JSONB, default=list)
    comment: Mapped[str] = mapped_column(Text, default="")
    __table_args__ = (
        UniqueConstraint("assignment_id", "reviewer_id", "reviewee_id"),
        CheckConstraint("rating BETWEEN 1 AND 5"),
    )


class Payment(Entity, Base):
    __tablename__ = "payments"
    job_id: Mapped[uuid.UUID] = fk("job_requests")
    payer_id: Mapped[uuid.UUID] = fk("users")
    method: Mapped[str] = mapped_column(String(30), default="PAY_LATER")
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    status: Mapped[str] = status("CREATED")
    provider_reference: Mapped[str | None] = mapped_column(String(200), unique=True)
    __table_args__ = (
        choices("status", "CREATED PENDING AUTHORIZED CAPTURED FAILED REFUNDED PARTIALLY_REFUNDED"),
        choices("method", "PAY_LATER CASH MANUAL_UPI"),
        CheckConstraint("amount_paise >= 0"),
    )


class Payout(Entity, Base):
    __tablename__ = "payouts"
    worker_id: Mapped[uuid.UUID] = fk("worker_profiles")
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    status: Mapped[str] = status("REQUESTED")
    __table_args__ = (
        choices("status", "REQUESTED APPROVED PROCESSING PAID FAILED REVERSED"),
        CheckConstraint("amount_paise > 0"),
    )


class WorkerLedgerEntry(Entity, Base):
    __tablename__ = "worker_ledger_entries"
    worker_id: Mapped[uuid.UUID] = fk("worker_profiles")
    type: Mapped[str] = mapped_column(String(30))
    amount_paise: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    shift_id: Mapped[uuid.UUID | None] = fk("shifts")
    payout_id: Mapped[uuid.UUID | None] = fk("payouts")
    reversal_of_id: Mapped[uuid.UUID | None] = fk("worker_ledger_entries")
    source_key: Mapped[str] = mapped_column(String(200), unique=True)
    __table_args__ = (choices("type", "EARNING BONUS INCENTIVE DEDUCTION ADJUSTMENT PAYOUT REVERSAL"),)


class DomainEvent(Entity, Base):
    __tablename__ = "domain_events"
    type: Mapped[str] = mapped_column(String(80))
    aggregate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    payload: Mapped[dict] = js()
    delivered_at: Mapped[datetime | None] = timecol()


class Notification(Entity, Base):
    __tablename__ = "notifications"
    recipient_id: Mapped[uuid.UUID] = fk("users")
    event_id: Mapped[uuid.UUID] = fk("domain_events")
    kind: Mapped[str] = mapped_column(String(80))
    payload: Mapped[dict] = js()
    read_at: Mapped[datetime | None] = timecol()
    __table_args__ = (UniqueConstraint("recipient_id", "event_id"),)


class AuditLog(Entity, Base):
    __tablename__ = "audit_logs"
    actor_id: Mapped[uuid.UUID] = fk("users")
    action: Mapped[str] = mapped_column(String(100))
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    details: Mapped[dict] = js()
    request_id: Mapped[str] = mapped_column(String(100))


class IdempotencyRecord(Entity, Base):
    __tablename__ = "idempotency_records"
    actor_id: Mapped[uuid.UUID] = fk("users")
    operation: Mapped[str] = mapped_column(String(160))
    key: Mapped[str] = mapped_column(String(120))
    request_hash: Mapped[str] = mapped_column(String(64))
    response: Mapped[dict] = js()
    __table_args__ = (UniqueConstraint("actor_id", "operation", "key"),)


class AccountDeletionRequest(Entity, Base):
    __tablename__ = "account_deletion_requests"
    user_id: Mapped[uuid.UUID] = fk("users", unique=True)
    status: Mapped[str] = status("REQUESTED")
    operational_holds: Mapped[dict] = js()


class AuthAttempt(Entity, Base):
    __tablename__ = "auth_attempts"
    bucket: Mapped[str] = mapped_column(String(64), index=True)
    count: Mapped[int] = mapped_column(Integer, default=1)
    window_start: Mapped[datetime] = timecol()
    __table_args__ = (UniqueConstraint("bucket", "window_start"),)
