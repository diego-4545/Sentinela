"""
Tareas ejecutadas por el worker de RQ (rq worker --url redis://redis:6379 default).
"""

import uuid

from app.core.database import SessionLocal
from app.models.check import Check
from app.models.monitor import Monitor
from app.services.checker import ejecutar_check
from app.services.incident_detector import evaluar_incidente


def tarea_check_monitor(monitor_id: str) -> None:
    """
    Job de RQ: ejecuta un check para el monitor dado, guarda el resultado
    (incluyendo postura de seguridad), y evalúa si esto abre o cierra un incidente.
    Recibe el id como string (RQ serializa los argumentos, UUID no siempre viaja bien).
    """
    db = SessionLocal()
    try:
        monitor = db.query(Monitor).filter(Monitor.id == uuid.UUID(monitor_id)).first()
        if not monitor:
            return

        resultado = ejecutar_check(monitor.url)

        check = Check(
            monitor_id=monitor.id,
            exitoso=resultado.exitoso,
            status_code=resultado.status_code,
            tiempo_respuesta_ms=resultado.tiempo_respuesta_ms,
            tipo_error=resultado.tipo_error,
            detalle_error=resultado.detalle_error,
            ssl_dias_restantes=resultado.ssl_dias_restantes,
            ssl_dominio_coincide=resultado.ssl_dominio_coincide,
            ssl_emisor=resultado.ssl_emisor,
            ssl_autofirmado=resultado.ssl_autofirmado,
            headers_seguridad=resultado.headers_seguridad,
        )
        db.add(check)
        db.commit()
        db.refresh(check)

        evaluar_incidente(monitor, check, db)
    finally:
        db.close()
