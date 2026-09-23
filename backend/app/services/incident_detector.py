"""
Comparador de umbral (Proceso 5 documentado): lógica de decisión discreta que
determina si una serie de checks fallidos consecutivos constituye un incidente,
y si un incidente abierto ya debe cerrarse. A partir de la sesión 6, también
dispara las notificaciones correspondientes (actuadores virtuales), respetando
el periodo de enfriamiento configurado por el usuario.

Este proceso NO tiene transformada de Laplace asociada (es una regla "sí/no"
sobre un contador discreto), a diferencia del Proceso 1 (estado_monitor) que
sí se modela como un escalón.
"""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.check import Check
from app.models.incident import Incident
from app.models.monitor import Monitor
from app.models.notification_channel import NotificationChannel
from app.services.notifier import (
    enviar_discord,
    enviar_email,
    construir_mensaje_apertura,
    construir_mensaje_cierre,
)


def _incidente_abierto(monitor_id, db: Session) -> Incident | None:
    return (
        db.query(Incident)
        .filter(Incident.monitor_id == monitor_id, Incident.resuelto.is_(False))
        .order_by(Incident.fecha_inicio.desc())
        .first()
    )


def _notificar(monitor: Monitor, mensaje: str, db: Session) -> None:
    """
    Envía el mensaje a todos los canales activos configurados para este monitor.
    Solo se ejecuta si el monitor ya pasó la verificación de propiedad de dominio
    (ver app/services/domain_verifier.py) — el scheduler sigue chequeando monitores
    no verificados con normalidad, pero no se les envían notificaciones hasta que
    el usuario demuestre control real sobre el dominio.
    """
    if not monitor.verified:
        return

    canales = (
        db.query(NotificationChannel)
        .filter(NotificationChannel.monitor_id == monitor.id, NotificationChannel.activo.is_(True))
        .all()
    )
    for canal in canales:
        if canal.tipo == "discord":
            enviar_discord(canal.destino, mensaje)
        elif canal.tipo == "email":
            asunto = "Sentinela — actualización de monitor"
            enviar_email(canal.destino, asunto, mensaje)


def _puede_notificar(incidente: Incident, monitor: Monitor) -> bool:
    """
    Aplica el periodo de enfriamiento: solo permite notificar de nuevo si
    ha pasado suficiente tiempo desde la última notificación de ESTE incidente,
    o si nunca se ha notificado todavía.
    """
    if incidente.ultima_notificacion_enviada is None:
        return True
    limite = incidente.ultima_notificacion_enviada + timedelta(seconds=monitor.periodo_enfriamiento_segundos)
    return datetime.utcnow() >= limite


def evaluar_incidente(monitor: Monitor, check_actual: Check, db: Session) -> None:
    """
    Se llama justo después de guardar cada Check. Decide si:
    - Se debe ABRIR un nuevo incidente (se alcanzó umbral_fallos_consecutivos), o
    - Se debe CERRAR un incidente ya abierto (el check actual fue exitoso), o
    - No hay cambio de estado (todavía no se alcanza el umbral, o ya estaba operativo)
    En los dos primeros casos, dispara la notificación correspondiente (sujeta a
    enfriamiento en el caso de reintentos del mismo incidente).
    """
    incidente_actual = _incidente_abierto(monitor.id, db)

    if check_actual.exitoso:
        # El servicio respondió bien: si había un incidente abierto, se cierra aquí.
        if incidente_actual:
            incidente_actual.fecha_fin = datetime.utcnow()
            incidente_actual.resuelto = True
            db.commit()

            mensaje = construir_mensaje_cierre(monitor.nombre, monitor.url)
            _notificar(monitor, mensaje, db)
        return

    # El check actual falló. Si ya hay un incidente abierto, evaluamos si toca
    # reenviar la notificación (respetando el enfriamiento) en vez de abrir uno nuevo.
    if incidente_actual:
        if _puede_notificar(incidente_actual, monitor):
            mensaje = construir_mensaje_apertura(monitor.nombre, monitor.url, check_actual.tipo_error or "desconocido")
            _notificar(monitor, mensaje, db)
            incidente_actual.ultima_notificacion_enviada = datetime.utcnow()
            db.commit()
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
        ultima_notificacion_enviada=datetime.utcnow(),
    )
    db.add(nuevo_incidente)
    db.commit()

    mensaje = construir_mensaje_apertura(monitor.nombre, monitor.url, check_actual.tipo_error or "desconocido")
    _notificar(monitor, mensaje, db)
