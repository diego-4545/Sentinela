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

    intervalo_segundos = Column(Integer, default=300, nullable=False)
    umbral_fallos_consecutivos = Column(Integer, default=2, nullable=False)
    periodo_enfriamiento_segundos = Column(Integer, default=1800, nullable=False)

    activo = Column(Boolean, default=True, nullable=False)

    verification_token = Column(String, default=lambda: secrets.token_hex(8), nullable=False)
    verified = Column(Boolean, default=False, nullable=False)

    # --- Status pages (nuevo) ---
    # Personal: aparece en la status page propia del usuario (GET /status/{user_id})
    incluido_en_status_personal = Column(Boolean, default=False, nullable=False)
    # Global: aparece en la status page agregada de todos los usuarios (GET /status/global).
    # Solo tiene efecto si, además, verified=True (misma regla que ya aplica a notificaciones).
    incluido_en_status_global = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", backref="monitors")
