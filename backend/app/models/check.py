import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Boolean, Integer, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.core.database import Base


class Check(Base):
    __tablename__ = "checks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    monitor_id = Column(UUID(as_uuid=True), ForeignKey("monitors.id", ondelete="CASCADE"), nullable=False, index=True)

    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    exitoso = Column(Boolean, nullable=False)
    status_code = Column(Integer, nullable=True)
    tiempo_respuesta_ms = Column(Integer, nullable=True)

    tipo_error = Column(String, nullable=True)
    detalle_error = Column(String, nullable=True)

    ssl_dias_restantes = Column(Integer, nullable=True)
    ssl_dominio_coincide = Column(Boolean, nullable=True)
    ssl_emisor = Column(String, nullable=True)
    ssl_autofirmado = Column(Boolean, nullable=True)

    headers_seguridad = Column(JSONB, nullable=True)

    monitor = relationship("Monitor", back_populates="checks")
