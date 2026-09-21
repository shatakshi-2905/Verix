from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    # Comma-separated list of allowed browser origins, e.g.
    # "http://localhost:5173,http://127.0.0.1:5173"
    frontend_origin: str = "http://localhost:5173"
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    aws_region: str = "ap-south-1"
    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    s3_bucket: str
    # In regions such as ap-south-1, Bedrock Nova models are usually only
    # reachable through a cross-region inference profile ID (for example
    # "apac.amazon.nova-pro-v1:0"), not the bare foundation-model ID below.
    # Check the Bedrock console for the exact profile ID available to your
    # account before deploying.
    bedrock_main_model: str = "amazon.nova-pro-v1:0"
    bedrock_fast_model: str = "amazon.nova-lite-v1:0"
    bedrock_micro_model: str = "amazon.nova-micro-v1:0"
    bedrock_embed_model: str = "amazon.titan-embed-text-v2:0"
    max_source_chars: int = 50000
    max_output_tokens: int = 5000
    # Hard cap on bytes read from a fetched URL, to bound /api/ingest-url.
    max_url_fetch_bytes: int = 2_000_000
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    @property
    def frontend_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_origin.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
