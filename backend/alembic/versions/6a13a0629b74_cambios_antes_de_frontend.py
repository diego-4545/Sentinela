"""Cambios antes de frontend

Revision ID: 6a13a0629b74
Revises: 4665f8a1b264
Create Date: 2026-10-02 02:52:35.297536

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '6a13a0629b74'
down_revision: Union[str, None] = '4665f8a1b264'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('monitors', sa.Column('incluido_en_status_personal', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('monitors', sa.Column('incluido_en_status_global', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column('monitors', 'incluido_en_status_global')
    op.drop_column('monitors', 'incluido_en_status_personal')
