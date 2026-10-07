import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    monitor_id = Column(UUID(as_uuid=True), ForeignKey("monitors.id", ondelete="CASCADE"), nullable=False, index=True)

    fecha_inicio = Column(DateTime, default=datetime.utcnow, nullable=False)
    fecha_fin = Column(DateTime, nullable=True)

    causa = Column(String, nullable=False)

    resuelto = Column(Boolean, default=False, nullable=False)

    ultima_notificacion_enviada = Column(DateTime, nullable=True)

    monitor = relationship("Monitor", back_populates="incidents")
