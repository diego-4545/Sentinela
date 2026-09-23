import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.check import Check
from app.models.monitor import Monitor
from app.models.user import User
from app.models.incident import Incident
from app.models.notification_channel import NotificationChannel
from app.schemas.monitor import MonitorCreate, MonitorOut, MonitorUpdate
from app.schemas.incident import IncidentOut
from app.schemas.notification_channel import NotificationChannelCreate, NotificationChannelOut, NotificationChannelUpdate
from app.services.checker import ejecutar_check
from app.services.incident_detector import evaluar_incidente
from app.services.domain_verifier import verificar_propiedad_dominio

router = APIRouter(prefix="/monitors", tags=["monitors"])


def _get_monitor_or_404(monitor_id: uuid.UUID, user: User, db: Session) -> Monitor:
    """
    Busca el monitor filtrando también por user_id, no solo por id.
    Esto es lo que garantiza que un usuario nunca pueda ver/editar/borrar
    monitores de otra cuenta, incluso si adivina un UUID válido.
    """
    monitor = (
        db.query(Monitor)
        .filter(Monitor.id == monitor_id, Monitor.user_id == user.id)
        .first()
    )
    if not monitor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monitor no encontrado")
    return monitor


@router.post("", response_model=MonitorOut, status_code=status.HTTP_201_CREATED)
def crear_monitor(
    payload: MonitorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    monitor = Monitor(
        user_id=current_user.id,
        nombre=payload.nombre,
        url=payload.url,
        intervalo_segundos=payload.intervalo_segundos,
    )
    db.add(monitor)
    db.commit()
    db.refresh(monitor)
    return monitor


@router.get("", response_model=list[MonitorOut])
def listar_monitores(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Monitor).filter(Monitor.user_id == current_user.id).order_by(Monitor.created_at.desc()).all()


@router.get("/{monitor_id}", response_model=MonitorOut)
def obtener_monitor(
    monitor_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_monitor_or_404(monitor_id, current_user, db)


@router.patch("/{monitor_id}", response_model=MonitorOut)
def actualizar_monitor(
    monitor_id: uuid.UUID,
    payload: MonitorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    monitor = _get_monitor_or_404(monitor_id, current_user, db)

    datos = payload.model_dump(exclude_unset=True)
    for campo, valor in datos.items():
        setattr(monitor, campo, valor)

    db.commit()
    db.refresh(monitor)
    return monitor


@router.delete("/{monitor_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_monitor(
    monitor_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    monitor = _get_monitor_or_404(monitor_id, current_user, db)
    db.delete(monitor)
    db.commit()
    return None


@router.post("/{monitor_id}/check-now", status_code=status.HTTP_201_CREATED)
def forzar_check_inmediato(
    monitor_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Ejecuta un check de forma SÍNCRONA (bloqueante, no pasa por la cola de RQ) para
    pruebas manuales rápidas desde Swagger. El scheduler automático (worker/scheduler.py)
    es el que usa la cola de forma asíncrona en producción normal.
    """
    monitor = _get_monitor_or_404(monitor_id, current_user, db)

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

    return {
        "check_id": check.id,
        "exitoso": check.exitoso,
        "status_code": check.status_code,
        "tiempo_respuesta_ms": check.tiempo_respuesta_ms,
        "tipo_error": check.tipo_error,
        "detalle_error": check.detalle_error,
        "ssl_dias_restantes": check.ssl_dias_restantes,
        "ssl_dominio_coincide": check.ssl_dominio_coincide,
        "ssl_emisor": check.ssl_emisor,
        "ssl_autofirmado": check.ssl_autofirmado,
        "headers_seguridad": check.headers_seguridad,
    }


@router.get("/{monitor_id}/incidents", response_model=list[IncidentOut])
def listar_incidentes(
    monitor_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    monitor = _get_monitor_or_404(monitor_id, current_user, db)
    return (
        db.query(Incident)
        .filter(Incident.monitor_id == monitor.id)
        .order_by(Incident.fecha_inicio.desc())
        .all()
    )


@router.post("/{monitor_id}/verify")
def verificar_dominio(
    monitor_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Verifica propiedad del dominio consultando https://<dominio>/sentinela-verify-<token>.txt
    Si el contenido coincide con el token del monitor, marca verified=True y las
    notificaciones quedan habilitadas para este monitor a partir de ahora.
    """
    monitor = _get_monitor_or_404(monitor_id, current_user, db)

    resultado = verificar_propiedad_dominio(monitor.url, monitor.verification_token)

    if resultado.verificado:
        monitor.verified = True
        db.commit()

    return {
        "verified": monitor.verified,
        "detalle": resultado.detalle,
        "archivo_esperado": f"sentinela-verify-{monitor.verification_token}.txt",
    }


# ── Canales de notificación (sesión 6) ──────────────────────────────

@router.post("/{monitor_id}/channels", response_model=NotificationChannelOut, status_code=status.HTTP_201_CREATED)
def crear_canal_notificacion(
    monitor_id: uuid.UUID,
    payload: NotificationChannelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    monitor = _get_monitor_or_404(monitor_id, current_user, db)

    canal = NotificationChannel(
        monitor_id=monitor.id,
        tipo=payload.tipo,
        destino=payload.destino,
    )
    db.add(canal)
    db.commit()
    db.refresh(canal)
    return canal


@router.get("/{monitor_id}/channels", response_model=list[NotificationChannelOut])
def listar_canales_notificacion(
    monitor_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    monitor = _get_monitor_or_404(monitor_id, current_user, db)
    return (
        db.query(NotificationChannel)
        .filter(NotificationChannel.monitor_id == monitor.id)
        .order_by(NotificationChannel.created_at.desc())
        .all()
    )


@router.delete("/{monitor_id}/channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_canal_notificacion(
    monitor_id: uuid.UUID,
    channel_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    monitor = _get_monitor_or_404(monitor_id, current_user, db)
    canal = (
        db.query(NotificationChannel)
        .filter(NotificationChannel.id == channel_id, NotificationChannel.monitor_id == monitor.id)
        .first()
    )
    if not canal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canal no encontrado")
    db.delete(canal)
    db.commit()
    return None


@router.patch("/{monitor_id}/channels/{channel_id}", response_model=NotificationChannelOut)
def actualizar_canal_notificacion(
    monitor_id: uuid.UUID,
    channel_id: uuid.UUID,
    payload: NotificationChannelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    monitor = _get_monitor_or_404(monitor_id, current_user, db)
    canal = (
        db.query(NotificationChannel)
        .filter(NotificationChannel.id == channel_id, NotificationChannel.monitor_id == monitor.id)
        .first()
    )
    if not canal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canal no encontrado")

    canal.activo = payload.activo
    db.commit()
    db.refresh(canal)
    return canal
