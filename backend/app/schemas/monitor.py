import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

INTERVALO_MINIMO_SEGUNDOS = 60  # ver justificación de riesgo DoS/SSRF en la documentación del proyecto


class MonitorCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    url: str = Field(description="Debe iniciar con http:// o https://")
    intervalo_segundos: int = Field(default=300, ge=INTERVALO_MINIMO_SEGUNDOS)

    @field_validator("url")
    @classmethod
    def validar_esquema(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("La URL debe iniciar con http:// o https://")
        return v


class MonitorUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=100)
    intervalo_segundos: int | None = Field(default=None, ge=INTERVALO_MINIMO_SEGUNDOS)
    activo: bool | None = None


class MonitorOut(BaseModel):
    id: uuid.UUID
    nombre: str
    url: str
    intervalo_segundos: int
    activo: bool
    verified: bool
    verification_token: str
    created_at: datetime

    class Config:
        from_attributes = True
