"""Prevent duplicate notification destinations for a monitor.

Revision ID: ef7b8c219a31
Revises: d3f9a641c702
Create Date: 2026-10-02
"""
from typing import Sequence, Union

from alembic import op


revision: str = "ef7b8c219a31"
down_revision: Union[str, None] = "d3f9a641c702"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE notification_channels
        SET tipo = lower(trim(tipo)),
            destino = CASE
                WHEN lower(trim(tipo)) = 'email' THEN lower(trim(destino))
                ELSE trim(destino)
            END
        """
    )
    op.create_unique_constraint(
        "uq_notification_channels_monitor_type_destination",
        "notification_channels",
        ["monitor_id", "tipo", "destino"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_notification_channels_monitor_type_destination",
        "notification_channels",
        type_="unique",
    )