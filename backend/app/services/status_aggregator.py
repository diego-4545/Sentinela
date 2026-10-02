"""
Cálculo del estado visible de un monitor, y agregación para las dos
modalidades de status page: personal (por usuario) y global (todos los
usuarios, agrupado por URL para no repetir el mismo sitio dos veces).
"""

from sqlalchemy.orm import Session

from app.models.check import Check
from app.models.incident import Incident
from app.models.monitor import Monitor


def calcular_estado(monitor: Monitor, db: Session) -> str:
    """
    "caido"      si hay un incidente abierto ahora mismo
    "operativo"  si ya hay al menos un check y no hay incidente abierto
    "sin_datos"  si el monitor es nuevo y el scheduler aún no lo ha revisado
    """
    incidente_abierto = (
        db.query(Incident)
        .filter(Incident.monitor_id == monitor.id, Incident.resuelto.is_(False))
        .first()
    )
    if incidente_abierto:
        return "caido"

    ultimo_check = (
        db.query(Check)
        .filter(Check.monitor_id == monitor.id)
        .order_by(Check.timestamp.desc())
        .first()
    )
    if not ultimo_check:
        return "sin_datos"

    return "operativo"


def obtener_status_personal(user_id, db: Session) -> list[dict]:
    monitores = (
        db.query(Monitor)
        .filter(
            Monitor.user_id == user_id,
            Monitor.incluido_en_status_personal.is_(True),
            Monitor.activo.is_(True),
        )
        .all()
    )
    return [
        {"nombre": m.nombre, "url": m.url, "estado": calcular_estado(m, db)}
        for m in monitores
    ]


def obtener_status_global(db: Session) -> list[dict]:
    """
    Junta los monitores de TODOS los usuarios marcados para la status page
    global, agrupando por URL para no mostrar el mismo sitio repetido si
    varios usuarios lo monitorean. Si cualquiera de las copias está caída,
    se muestra como caído (la lectura más conservadora).
    Solo entran monitores ya verificados (misma regla que las notificaciones).
    """
    monitores = (
        db.query(Monitor)
        .filter(
            Monitor.verified.is_(True),
            Monitor.incluido_en_status_global.is_(True),
            Monitor.activo.is_(True),
        )
        .all()
    )

    prioridad = {"caido": 2, "sin_datos": 1, "operativo": 0}
    grupos: dict[str, dict] = {}

    for m in monitores:
        estado = calcular_estado(m, db)
        if m.url not in grupos:
            grupos[m.url] = {"url": m.url, "estado": estado}
        elif prioridad[estado] > prioridad[grupos[m.url]["estado"]]:
            grupos[m.url]["estado"] = estado

    return list(grupos.values())
