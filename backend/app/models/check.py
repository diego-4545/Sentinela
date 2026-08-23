import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Boolean, Integer, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Check(Base):
    __tablename__ = "checks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    monitor_id = Column(UUID(as_uuid=True), ForeignKey("monitors.id"), nullable=False, index=True)

    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    exitoso = Column(Boolean, nullable=False)
    status_code = Column(Integer, nullable=True)  # null si ni siquiera hubo respuesta (timeout/DNS/etc.)
    tiempo_respuesta_ms = Column(Integer, nullable=True)

    # Tipo de error cuando exitoso=False: "timeout", "dns_error", "connection_error", "ssrf_blocked", "http_error"
    tipo_error = Column(String, nullable=True)
    detalle_error = Column(String, nullable=True)

    monitor = relationship("Monitor", backref="checks")
