from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:password@localhost:5432/fitconnect"
    redis_url: str = "redis://localhost:6379/0"
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    ollama_base_url: str = "http://localhost:11434"
    ollama_chat_model: str = "gemma4:e4b"
    ollama_embed_model: str = "nomic-embed-text"
    ollama_vision_model: str = "llava:7b"
    jwt_secret: str = "fitconnect-secret"
    admin_api_key: str = ""
    environment: str = "development"
    allowed_origins: str = "http://localhost:3000,http://localhost:5173"
    enable_demo_fallback: bool = True

    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        extra="ignore",
        case_sensitive=False,
    )

    @property
    def cors_origins(self) -> list[str]:
        origins = [
            origin.strip()
            for origin in self.allowed_origins.split(",")
            if origin.strip()
        ]
        return origins or ["http://localhost:3000", "http://localhost:5173"]

    @property
    def demo_fallback_enabled(self) -> bool:
        return self.enable_demo_fallback and not self.is_production

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() in {"production", "prod"}

    @staticmethod
    def is_placeholder(value: str) -> bool:
        value = (value or "").strip().lower()
        return (
            not value
            or value.startswith("your_")
            or value.startswith("your-")
            or value.startswith("dev-placeholder")
            or value in {"replace-with-a-strong-local-secret", "fitconnect-secret"}
            or "your-project" in value
            or "change-me" in value
        )

    def production_config_errors(self) -> list[str]:
        if not self.is_production:
            return []

        errors: list[str] = []
        required = {
            "SUPABASE_URL": self.supabase_url,
            "SUPABASE_SERVICE_ROLE_KEY": self.supabase_service_role_key,
            "JWT_SECRET": self.jwt_secret,
            "DATABASE_URL": self.database_url,
            "REDIS_URL": self.redis_url,
        }
        for name, value in required.items():
            if self.is_placeholder(value):
                errors.append(f"{name} is missing or still uses a placeholder")

        if self.enable_demo_fallback:
            errors.append("ENABLE_DEMO_FALLBACK must be false in production")
        if self.supabase_url and not self.supabase_url.strip().lower().startswith("https://"):
            errors.append("SUPABASE_URL must use https:// in production")
        database_url = self.database_url.lower()
        redis_url = self.redis_url.lower()
        if "localhost" in database_url or "127.0.0.1" in database_url:
            errors.append("DATABASE_URL must not point at localhost in production")
        if "localhost" in redis_url or "127.0.0.1" in redis_url:
            errors.append("REDIS_URL must not point at localhost in production")
        if "*" in self.cors_origins:
            errors.append("ALLOWED_ORIGINS must not contain '*' in production")
        if any("localhost" in origin or "127.0.0.1" in origin for origin in self.cors_origins):
            errors.append("ALLOWED_ORIGINS must not contain localhost origins in production")

        return errors

    def assert_production_ready(self) -> None:
        errors = self.production_config_errors()
        if errors:
            raise RuntimeError("Production configuration is invalid: " + "; ".join(errors))


settings = Settings()
