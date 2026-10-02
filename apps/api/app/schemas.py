from itertools import pairwise
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field, model_validator


class Schema(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Register(Schema):
    full_name: str = Field(min_length=2, max_length=160)
    email: EmailStr
    phone_number: str = Field(min_length=10, max_length=30)
    password: str = Field(min_length=12, max_length=128)
    confirm_password: str

    @model_validator(mode="after")
    def matching(self):
        if self.password != self.confirm_password:
            raise ValueError("PASSWORD_MISMATCH")
        return self


class Login(Schema):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class Refresh(Schema):
    refresh_token: str = Field(min_length=20, max_length=200)


class EmailInput(Schema):
    email: EmailStr


class Reset(Schema):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=12, max_length=128)
    confirm_password: str

    @model_validator(mode="after")
    def matching(self):
        if self.password != self.confirm_password:
            raise ValueError("PASSWORD_MISMATCH")
        return self


class RoleInput(Schema):
    role: Literal["CLIENT", "WORKER"]


class Preferences(Schema):
    last_active_mode: Literal["CLIENT", "WORKER"]
    locale: Literal["en", "hi"] = "en"


class DeleteInput(Schema):
    password: str = Field(max_length=128)
    confirm: Literal[True]


class AddressInput(Schema):
    city_id: UUID
    label: str = Field(min_length=1, max_length=80)
    line1: str = Field(min_length=3, max_length=240)
    locality: str = Field(min_length=1, max_length=120)
    state: str = Field(min_length=2, max_length=100)
    postal_code: str = Field(pattern=r"^\d{6}$")
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)


class ClientInput(Schema):
    full_name: str = Field(min_length=2, max_length=160)
    client_type: Literal["INDIVIDUAL", "BUSINESS"] = "INDIVIDUAL"
    primary_address_id: UUID


class Window(Schema):
    start_at: AwareDatetime
    end_at: AwareDatetime

    @model_validator(mode="after")
    def valid(self):
        if self.end_at <= self.start_at:
            raise ValueError("SCHEDULE_INVALID")
        if (self.end_at - self.start_at).total_seconds() > 86400:
            raise ValueError("SHIFT_TOO_LONG")
        return self


class JobInput(Schema):
    service_id: UUID
    service_area_id: UUID
    address_id: UUID
    engagement_type: Literal["HOURLY", "DAILY", "FIXED_TERM", "MONTHLY"]
    schedule: list[Window] = Field(min_length=1, max_length=62)
    headcount: int = Field(ge=1, le=100)
    budget_min: int | None = Field(default=None, ge=0, le=100000000)
    budget_max: int | None = Field(default=None, ge=0, le=100000000)
    currency: Literal["INR"] = "INR"
    notes: str = Field(default="", max_length=2000)
    requirements: dict = Field(default_factory=dict)
    recurring_metadata: dict = Field(default_factory=dict)

    @model_validator(mode="after")
    def valid(self):
        windows = sorted(self.schedule, key=lambda x: x.start_at)
        if any(a.end_at > b.start_at for a, b in pairwise(windows)):
            raise ValueError("SCHEDULE_OVERLAP")
        if self.engagement_type in ("HOURLY", "DAILY") and len(windows) != 1:
            raise ValueError("SCHEDULE_INVALID")
        if self.engagement_type in ("FIXED_TERM", "MONTHLY") and len(windows) < 2:
            raise ValueError("MULTIPLE_SHIFTS_REQUIRED")
        if self.budget_max is not None and self.budget_max < (self.budget_min or 0):
            raise ValueError("BUDGET_INVALID")
        self.schedule = windows
        return self


class AvailabilityInput(Schema):
    online: bool
    service_area_id: UUID
    latitude: float | None = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    longitude: float | None = Field(default=None, ge=-180, le=180, allow_inf_nan=False)
    radius_m: int = Field(default=15000, ge=100, le=50000)

    @model_validator(mode="after")
    def online_requires_location(self):
        if self.online and (self.latitude is None or self.longitude is None):
            raise ValueError("LOCATION_REQUIRED")
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("LOCATION_REQUIRED")
        return self


class VerificationInput(Schema):
    type: Literal[
        "IDENTITY", "POLICE", "BANK", "DRIVING_LICENSE", "ADDRESS", "SKILL_CERTIFICATE", "REFERENCE"
    ]
    document_id: UUID


class ReasonInput(Schema):
    reason: str = Field(min_length=3, max_length=1000)


class OfferInput(Schema):
    worker_id: UUID
    expires_at: AwareDatetime
    agreed_worker_amount_paise: int = Field(ge=0, le=100000000)
    replacement_request_id: UUID | None = None


class PaymentCreate(Schema):
    job_id: UUID
    method: Literal["PAY_LATER", "CASH", "MANUAL_UPI"]
    amount_paise: int = Field(gt=0, le=100000000)


class PaymentReconcile(Schema):
    amount_paise: int = Field(gt=0, le=100000000)
    reference: str = Field(min_length=4, max_length=200)


class CheckInInput(Schema):
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)
    accuracy_m: float = Field(gt=0, le=10000, allow_inf_nan=False)
    device_timestamp: AwareDatetime


class ReplacementInput(Schema):
    assignment_id: UUID
    reason: Literal[
        "NO_SHOW", "UNAVAILABLE", "QUALITY_ISSUE", "CLIENT_REQUEST", "WORKER_REQUEST", "EMERGENCY", "OTHER"
    ]
    details: str = Field(default="", max_length=2000)


class IncidentInput(Schema):
    assignment_id: UUID
    type: Literal["NO_SHOW", "BEHAVIOUR", "PAYMENT", "SAFETY", "QUALITY", "LOCATION", "ATTENDANCE", "OTHER"]
    description: str = Field(min_length=3, max_length=4000)


class ReviewInput(Schema):
    assignment_id: UUID
    rating: int = Field(ge=1, le=5)
    tags: list[str] = Field(default_factory=list, max_length=10)
    comment: str = Field(default="", max_length=2000)


class QuickJobInput(Schema):
    service_id: UUID
    service_area_id: UUID
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    locality: str = Field(default="", max_length=120)
    start_at: AwareDatetime
    hours: int = Field(default=8, ge=1, le=16)
    headcount: int = Field(ge=1, le=100)
    wage_per_day_paise: int = Field(gt=0, le=100000000)
    notes: str = Field(default="", max_length=500)
