"""
Comparador de umbral (Proceso 5 documentado): lógica de decisión discreta que
determina si una serie de checks fallidos consecutivos constituye un incidente,
y si un incidente abierto ya debe cerrarse.

Este proceso NO tiene transformada de Laplace asociada (es una regla "sí/no"
sobre un contador discreto), a diferencia del Proceso 1 (estado_monitor) que
sí se modela como un escalón.
"""

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.check import Check
from app.models.incident import Incident
from app.models.monitor import Monitor


def _incidente_abierto(monitor_id, db: Session) -> Incident | None:
    return (
        db.query(Incident)
        .filter(Incident.monitor_id == monitor_id, Incident.resuelto.is_(False))
        .order_by(Incident.fecha_inicio.desc())
        .first()
    )


def evaluar_incidente(monitor: Monitor, check_actual: Check, db: Session) -> None:
    """
    Se llama justo después de guardar cada Check. Decide si:
    - Se debe ABRIR un nuevo incidente (se alcanzó umbral_fallos_consecutivos), o
    - Se debe CERRAR un incidente ya abierto (el check actual fue exitoso), o
    - No hay cambio de estado (todavía no se alcanza el umbral, o ya estaba operativo)
    """
    incidente_actual = _incidente_abierto(monitor.id, db)

    if check_actual.exitoso:
        # El servicio respondió bien: si había un incidente abierto, se cierra aquí.
        if incidente_actual:
            incidente_actual.fecha_fin = datetime.utcnow()
            incidente_actual.resuelto = True
            db.commit()
        return

    # El check actual falló. Si ya hay un incidente abierto, no se abre uno nuevo
    # (el incidente ya está siendo registrado, esto evita duplicados).
    if incidente_actual:
        return

    # No hay incidente abierto: revisamos si ya se acumulan suficientes fallos
    # consecutivos para abrir uno nuevo.
    ultimos_checks = (
        db.query(Check)
        .filter(Check.monitor_id == monitor.id)
        .order_by(Check.timestamp.desc())
        .limit(monitor.umbral_fallos_consecutivos)
        .all()
    )

    if len(ultimos_checks) < monitor.umbral_fallos_consecutivos:
        return  # todavía no hay suficiente historial para decidir

    todos_fallidos = all(not c.exitoso for c in ultimos_checks)
    if not todos_fallidos:
        return  # hay al menos un éxito reciente dentro de la ventana, no se abre incidente

    nuevo_incidente = Incident(
        monitor_id=monitor.id,
        causa=check_actual.tipo_error or "desconocido",
        resuelto=False,
    )
    db.add(nuevo_incidente)
    db.commit()
