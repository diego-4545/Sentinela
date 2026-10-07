"""Agregar campos de SSL y headers a checks

Revision ID: 4665f8a1b264
Revises: a7d00cbcca67
Create Date: 2026-09-14 18:04:25.895049

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '4665f8a1b264'
down_revision: Union[str, None] = 'a7d00cbcca67'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('checks', sa.Column('ssl_dias_restantes', sa.Integer(), nullable=True))
    op.add_column('checks', sa.Column('ssl_dominio_coincide', sa.Boolean(), nullable=True))
    op.add_column('checks', sa.Column('ssl_emisor', sa.String(), nullable=True))
    op.add_column('checks', sa.Column('ssl_autofirmado', sa.Boolean(), nullable=True))
    op.add_column('checks', sa.Column('headers_seguridad', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('checks', 'headers_seguridad')
    op.drop_column('checks', 'ssl_autofirmado')
    op.drop_column('checks', 'ssl_emisor')
    op.drop_column('checks', 'ssl_dominio_coincide')
    op.drop_column('checks', 'ssl_dias_restantes')
