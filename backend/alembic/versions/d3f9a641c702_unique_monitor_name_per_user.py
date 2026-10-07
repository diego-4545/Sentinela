"""Require monitor names to be unique per user.

Revision ID: d3f9a641c702
Revises: b71d9eaec284
Create Date: 2026-10-02
"""
from typing import Sequence, Union

from alembic import op


revision: str = "d3f9a641c702"
down_revision: Union[str, None] = "b71d9eaec284"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        WITH ranked_monitors AS (
            SELECT id, nombre,
                   row_number() OVER (
                       PARTITION BY user_id, nombre
                       ORDER BY created_at, id
                   ) AS duplicate_number
            FROM monitors
        )
        UPDATE monitors AS monitor
        SET nombre = left(ranked_monitors.nombre, 55) || ' [' || ranked_monitors.id::text || ']'
        FROM ranked_monitors
        WHERE monitor.id = ranked_monitors.id
          AND ranked_monitors.duplicate_number > 1
        """
    )
    op.create_unique_constraint(
        "uq_monitors_user_id_nombre",
        "monitors",
        ["user_id", "nombre"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_monitors_user_id_nombre", "monitors", type_="unique")