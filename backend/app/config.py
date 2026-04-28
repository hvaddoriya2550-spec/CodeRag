from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    groq_api_key: str
    environment: str = "development"
    log_level: str = "INFO"
    chroma_db_path: str = "./data/chroma"
    repos_path: str = "./data/repos"
    max_repo_size_mb: int = 500
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
