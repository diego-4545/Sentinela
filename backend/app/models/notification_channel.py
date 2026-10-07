import uuid
from datetime import datetime

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class NotificationChannel(Base):
    __tablename__ = "notification_channels"
    __table_args__ = (
        UniqueConstraint(
            "monitor_id",
            "tipo",
            "destino",
            name="uq_notification_channels_monitor_type_destination",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    monitor_id = Column(UUID(as_uuid=True), ForeignKey("monitors.id", ondelete="CASCADE"), nullable=False, index=True)

    tipo = Column(String, nullable=False)

    destino = Column(String, nullable=False)

    activo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    monitor = relationship("Monitor", back_populates="notification_channels")
