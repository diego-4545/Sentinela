"""
Scheduler simple: corre en un loop dentro del contenedor worker, revisa cada pocos
segundos qué monitores ya cumplieron su intervalo configurado desde su último check,
y encola un job de RQ para cada uno.

Esto es, en términos del modelo de sistemas de control ya documentado en el proyecto,
el "muestreador" (δT) que dispara la observación periódica de cada monitor según su
propio periodo de muestreo T (intervalo_segundos).
"""

import time
from datetime import datetime, timedelta

from redis import Redis
from rq import Queue
from sqlalchemy import func

from app.core.database import SessionLocal
from app.models.check import Check
from app.models.monitor import Monitor
from app.workers.tasks import tarea_check_monitor

TICK_SEGUNDOS = 15  # cada cuánto revisa el scheduler qué monitores están vencidos

redis_conn = Redis.from_url("redis://redis:6379")
queue = Queue("default", connection=redis_conn)


def monitores_pendientes(db) -> list[Monitor]:
    """
    Regresa los monitores activos cuyo último check fue hace más tiempo que su
    intervalo configurado (o que nunca han tenido un check).
    """
    ahora = datetime.utcnow()

    subquery = (
        db.query(Check.monitor_id, func.max(Check.timestamp).label("ultimo_check"))
        .group_by(Check.monitor_id)
        .subquery()
    )

    monitores = (
        db.query(Monitor)
        .outerjoin(subquery, Monitor.id == subquery.c.monitor_id)
        .filter(Monitor.activo.is_(True))
        .filter(
            (subquery.c.ultimo_check.is_(None))
            | (subquery.c.ultimo_check <= ahora - timedelta(seconds=1) * Monitor.intervalo_segundos)
        )
        .all()
    )
    return monitores


def loop_scheduler():
    print(f"[scheduler] Iniciado. Revisando monitores vencidos cada {TICK_SEGUNDOS}s...", flush=True)
    while True:
        db = SessionLocal()
        try:
            pendientes = monitores_pendientes(db)
            for monitor in pendientes:
                queue.enqueue(tarea_check_monitor, str(monitor.id))
                print(f"[scheduler] Encolado check para monitor {monitor.id} ({monitor.nombre})", flush=True)
        except Exception as e:
            print(f"[scheduler] Error en el ciclo: {e}", flush=True)
        finally:
            db.close()
        time.sleep(TICK_SEGUNDOS)


if __name__ == "__main__":
    loop_scheduler()
