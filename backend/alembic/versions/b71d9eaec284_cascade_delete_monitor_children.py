"""Cascade monitor deletion to dependent records.

Revision ID: b71d9eaec284
Revises: ca934af04301
Create Date: 2026-10-02
"""
from typing import Sequence, Union

from alembic import op


revision: str = "b71d9eaec284"
down_revision: Union[str, None] = "ca934af04301"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table in ("checks", "incidents", "notification_channels"):
        constraint = f"{table}_monitor_id_fkey"
        op.drop_constraint(constraint, table, type_="foreignkey")
        op.create_foreign_key(
            constraint,
            table,
            "monitors",
            ["monitor_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    for table in ("notification_channels", "incidents", "checks"):
        constraint = f"{table}_monitor_id_fkey"
        op.drop_constraint(constraint, table, type_="foreignkey")
        op.create_foreign_key(
            constraint,
            table,
            "monitors",
            ["monitor_id"],
            ["id"],
        )