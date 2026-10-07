import uuid

from pydantic import BaseModel

from app.schemas.monitor import CheckResumen


class StatusItemOut(BaseModel):
    nombre: str | None = None
    url: str
    estado: str


class StatusMonitorOut(BaseModel):
    id: uuid.UUID
    nombre: str
    url: str
    verified: bool
    estado: str
    ultimo_check: CheckResumen | None = None
