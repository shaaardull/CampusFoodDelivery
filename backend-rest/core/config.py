from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", extra="ignore")

    dev_mode: bool = True  # Set to False in production to require JWT auth
    supabase_url: str = ""
    supabase_service_key: str = ""
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24 hours
    resend_api_key: str = ""
    otp_ttl_seconds: int = 300  # 5 minutes
    owm_api_key: str = ""  # OpenWeatherMap, optional
    vapid_private_key: str = ""
    vapid_public_key: str = ""
    vapid_email: str = "mailto:admin@campusconnect.dev"
    dev_user_uid: str = ""  # Auto-populated on first request in dev mode


settings = Settings()
