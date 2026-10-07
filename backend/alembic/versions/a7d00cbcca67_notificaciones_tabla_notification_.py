"""Notificaciones: tabla notification_channels y campos de enfriamiento

Revision ID: a7d00cbcca67
Revises: 1cef3a500f92
Create Date: 2026-09-11 03:24:33.704224

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7d00cbcca67'
down_revision: Union[str, None] = '1cef3a500f92'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('notification_channels',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('monitor_id', sa.UUID(), nullable=False),
    sa.Column('tipo', sa.String(), nullable=False),
    sa.Column('destino', sa.String(), nullable=False),
    sa.Column('activo', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['monitor_id'], ['monitors.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_notification_channels_monitor_id'), 'notification_channels', ['monitor_id'], unique=False)
    op.add_column('incidents', sa.Column('ultima_notificacion_enviada', sa.DateTime(), nullable=True))
    op.add_column('monitors', sa.Column('periodo_enfriamiento_segundos', sa.Integer(), nullable=False, server_default='1800'))


def downgrade() -> None:
    op.drop_column('monitors', 'periodo_enfriamiento_segundos')
    op.drop_column('incidents', 'ultima_notificacion_enviada')
    op.drop_index(op.f('ix_notification_channels_monitor_id'), table_name='notification_channels')
    op.drop_table('notification_channels')
