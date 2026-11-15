from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_backend_dir = Path(__file__).resolve().parent.parent
_env_file = _backend_dir.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_env_file), extra="ignore")
    app_name: str = "India Investment Intelligence"
    database_url: str = f"sqlite:///{_backend_dir / 'stockintel.db'}"
    redis_url: str = "redis://localhost:6379/0"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    gemini_api_key1: str | None = None
    gemini_model1: str = "gemini-flash-latest"
    fyers_client_id: str | None = None
    fyers_client_secret: str | None = None
    fyers_redirect_uri: str | None = None
    serper_api_key: str | None = None
    tavily_api_key: str | None = None
    gmail_address: str | None = None
    gmail_app_password: str | None = None
    notification_email: str | None = None
    market_data_max_age_minutes: int = 20

    @property
    def resolved_database_url(self) -> str:
        if self.database_url.startswith("sqlite:///./"):
            rel_name = self.database_url[12:]
            return f"sqlite:///{(_backend_dir / rel_name).resolve()}"
        return self.database_url


@lru_cache
def get_settings() -> Settings:
    return Settings()
