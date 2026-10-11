from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    ALGORITHM: str = "HS256"

    # Dia de operação (numeração de pedidos / quadro do dia).
    # Pedidos finalizados antes de BUSINESS_DAY_CUTOFF_HOUR (no fuso
    # BUSINESS_TIMEZONE) pertencem ao dia anterior. Alterar apenas com a loja fechada.
    BUSINESS_TIMEZONE: str = "America/Sao_Paulo"
    BUSINESS_DAY_CUTOFF_HOUR: int = 0

    @field_validator("BUSINESS_DAY_CUTOFF_HOUR")
    @classmethod
    def validate_cutoff_hour(cls, v: int) -> int:
        if not 0 <= v <= 23:
            raise ValueError("BUSINESS_DAY_CUTOFF_HOUR deve estar entre 0 e 23")
        return v

    class Config:
        env_file = ".env"


settings = Settings()
