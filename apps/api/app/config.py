from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../../.env", ".env"), extra="ignore")
    app_env: str = "development"
    database_url: str
    jwt_secret: str
    jwt_issuer: str = "labour-youth"
    jwt_audience: str = "labour-youth-app"
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    reset_token_minutes: int = 30
    email_verification_required: bool = False
    allowed_origins: str = "http://localhost:3000"
    private_storage_path: str = "./private-uploads"
    max_upload_bytes: int = 10_485_760
    geofence_radius_meters: int = 150
    max_location_accuracy_meters: int = 50
    max_location_age_seconds: int = 120
    check_in_early_minutes: int = 30
    check_in_late_minutes: int = 120
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = ""
    password_reset_url: str = ""

    @model_validator(mode="after")
    def secure_config(self):
        if len(self.jwt_secret) < 48 or "REPLACE" in self.jwt_secret:
            raise ValueError("JWT_SECRET must be a random secret of at least 48 characters")
        if self.app_env == "production" and (
            not self.smtp_host or not self.password_reset_url.startswith("https://")
        ):
            raise ValueError("Production requires password-reset email and HTTPS reset URL")
        return self


@lru_cache
def settings():
    return Settings()
