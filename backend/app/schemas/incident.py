import uuid
from datetime import datetime

from pydantic import BaseModel


class IncidentOut(BaseModel):
    id: uuid.UUID
    monitor_id: uuid.UUID
    fecha_inicio: datetime
    fecha_fin: datetime | None = None
    causa: str
    resuelto: bool

    class Config:
        from_attributes = True
