import secrets
import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, Boolean, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Monitor(Base):
    __tablename__ = "monitors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    nombre = Column(String, nullable=False)
    url = Column(String, nullable=False)

    # Intervalo entre checks, en segundos. Mínimo 60s (ver justificación de riesgo DoS/SSRF en el documento del proyecto).
    intervalo_segundos = Column(Integer, default=300, nullable=False)

    activo = Column(Boolean, default=True, nullable=False)

    # Verificación de propiedad de dominio (mecanismo de archivo, ver Entregable 1)
    verification_token = Column(String, default=lambda: secrets.token_hex(8), nullable=False)
    verified = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", backref="monitors")
