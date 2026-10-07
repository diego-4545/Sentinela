import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

INTERVALO_MINIMO_SEGUNDOS = 60
INTERVALO_MAXIMO_SEGUNDOS = 86_400


class MonitorCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    url: str = Field(description="Debe iniciar con http:// o https://")
    intervalo_segundos: int = Field(
        default=300,
        ge=INTERVALO_MINIMO_SEGUNDOS,
        le=INTERVALO_MAXIMO_SEGUNDOS,
    )

    @field_validator("url")
    @classmethod
    def validar_esquema(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("La URL debe iniciar con http:// o https://")
        return v


class MonitorUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=100)
    intervalo_segundos: int | None = Field(
        default=None,
        ge=INTERVALO_MINIMO_SEGUNDOS,
        le=INTERVALO_MAXIMO_SEGUNDOS,
    )
    activo: bool | None = None
    incluido_en_status_personal: bool | None = None
    incluido_en_status_global: bool | None = None


class CheckResumen(BaseModel):
    id: uuid.UUID
    timestamp: datetime
    exitoso: bool
    status_code: int | None
    tiempo_respuesta_ms: int | None
    tipo_error: str | None
    detalle_error: str | None = None
    ssl_dias_restantes: int | None = None
    ssl_dominio_coincide: bool | None = None
    ssl_emisor: str | None = None
    ssl_autofirmado: bool | None = None
    headers_seguridad: dict[str, Any] | None = None

    class Config:
        from_attributes = True


class MonitorOut(BaseModel):
    id: uuid.UUID
    nombre: str
    url: str
    intervalo_segundos: int
    activo: bool
    verified: bool
    verification_token: str
    incluido_en_status_personal: bool
    incluido_en_status_global: bool
    created_at: datetime
    ultimo_check: CheckResumen | None = None

    class Config:
        from_attributes = True
