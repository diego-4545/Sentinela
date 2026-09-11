import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class NotificationChannelCreate(BaseModel):
    tipo: str = Field(description="'discord' o 'email'")
    destino: str = Field(description="URL del webhook (Discord) o dirección de correo (email)")

    @field_validator("tipo")
    @classmethod
    def validar_tipo(cls, v: str) -> str:
        if v not in ("discord", "email"):
            raise ValueError("tipo debe ser 'discord' o 'email'")
        return v


class NotificationChannelOut(BaseModel):
    id: uuid.UUID
    monitor_id: uuid.UUID
    tipo: str
    destino: str
    activo: bool
    created_at: datetime

    class Config:
        from_attributes = True
