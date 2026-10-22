from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days; must match the frontend cookie lifetime
    gemini_api_key: str = ""
    tmdb_api_key: str = ""
    # Development only: return the password-reset token in the API response (and log it)
    # so the reset flow can be tested without email. Must stay False in production,
    # where it would let anyone who knows an email address take over that account.
    expose_reset_token_in_response: bool = False
    # Shared secret between the frontend's server (Vercel) and this API. Only requests
    # carrying it get the reset token back, so the frontend can email the link without
    # the token ever reaching a browser. Empty = never return tokens.
    internal_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
