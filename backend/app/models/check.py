import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Boolean, Integer, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID, JSONB
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

    # --- Postura de seguridad (sesión 7) ---
    # Certificado SSL/TLS: null si el sitio es http:// (sin TLS) o si no se pudo obtener el certificado
    ssl_dias_restantes = Column(Integer, nullable=True)
    ssl_dominio_coincide = Column(Boolean, nullable=True)
    ssl_emisor = Column(String, nullable=True)
    ssl_autofirmado = Column(Boolean, nullable=True)

    # Headers de seguridad, guardados como JSON: presencia + si la config es "fuerte" o "débil"
    # Ejemplo: {"hsts": {"presente": true, "fuerte": true}, "csp": {...}, "x_frame_options": {...}}
    headers_seguridad = Column(JSONB, nullable=True)

    monitor = relationship("Monitor", backref="checks")
