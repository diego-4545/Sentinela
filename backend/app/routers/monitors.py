import uuid
from collections import Counter
from datetime import datetime, timedelta
from math import ceil
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, get_optional_current_user
from app.models.check import Check
from app.models.monitor import Monitor
from app.models.user import User
from app.models.incident import Incident
from app.models.notification_channel import NotificationChannel
from app.schemas.monitor import CheckResumen, MonitorCreate, MonitorOut, MonitorUpdate
from app.schemas.incident import IncidentOut
from app.schemas.notification_channel import NotificationChannelCreate, NotificationChannelOut, NotificationChannelUpdate
from app.services.checker import ejecutar_check
from app.services.incident_detector import evaluar_incidente
from app.services.domain_verifier import verificar_propiedad_dominio

router = APIRouter(prefix="/monitors", tags=["monitors"])
NOMBRE_MONITOR_DUPLICADO = "Ya existe un monitor con este nombre en tu cuenta"


def _validar_nombre_disponible(
    nombre: str,
    user: User,
    db: Session,
    monitor_id: uuid.UUID | None = None,
) -> None:
    query = db.query(Monitor).filter(Monitor.user_id == user.id, Monitor.nombre == nombre)
    if monitor_id is not None:
        query = query.filter(Monitor.id != monitor_id)
    if query.first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=NOMBRE_MONITOR_DUPLICADO)


def _commit_monitor(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        constraint_name = getattr(getattr(error.orig, "diag", None), "constraint_name", None)
        if constraint_name == "uq_monitors_user_id_nombre":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=NOMBRE_MONITOR_DUPLICADO,
            ) from error
        raise


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
    monitor_existente = (
        db.query(Monitor)
        .filter(Monitor.user_id == current_user.id, Monitor.url == payload.url)
        .first()
    )
    if monitor_existente:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un monitor para esta URL en tu cuenta",
        )
    _validar_nombre_disponible(payload.nombre, current_user, db)

    monitor = Monitor(
        user_id=current_user.id,
        nombre=payload.nombre,
        url=payload.url,
        intervalo_segundos=payload.intervalo_segundos,
    )
    db.add(monitor)
    _commit_monitor(db)
    db.refresh(monitor)
    return monitor


@router.get("", response_model=list[MonitorOut])
def listar_monitores(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    monitores = (
        db.query(Monitor)
        .filter(Monitor.user_id == current_user.id)
        .order_by(Monitor.created_at.desc())
        .all()
    )
    if not monitores:
        return []

    ultimo_check_por_monitor = (
        db.query(
            Check.id.label("check_id"),
            func.row_number()
            .over(
                partition_by=Check.monitor_id,
                order_by=(Check.timestamp.desc(), Check.id.desc()),
            )
            .label("posicion"),
        )
        .join(Monitor, Monitor.id == Check.monitor_id)
        .filter(Monitor.user_id == current_user.id)
        .subquery()
    )
    checks = (
        db.query(Check)
        .join(ultimo_check_por_monitor, Check.id == ultimo_check_por_monitor.c.check_id)
        .filter(ultimo_check_por_monitor.c.posicion == 1)
        .all()
    )
    checks_por_monitor = {check.monitor_id: CheckResumen.model_validate(check) for check in checks}

    return [
        {
            **MonitorOut.model_validate(monitor).model_dump(),
            "ultimo_check": checks_por_monitor.get(monitor.id),
        }
        for monitor in monitores
    ]


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
    if "nombre" in datos:
        _validar_nombre_disponible(datos["nombre"], current_user, db, monitor.id)
    if datos.get("incluido_en_status_global") is True and not monitor.verified:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Debes verificar el dominio antes de incluir el monitor en el Estado Global.",
        )
    for campo, valor in datos.items():
        setattr(monitor, campo, valor)

    _commit_monitor(db)
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



@router.post("/{monitor_id}/channels", response_model=NotificationChannelOut, status_code=status.HTTP_201_CREATED)
def crear_canal_notificacion(
    monitor_id: uuid.UUID,
    payload: NotificationChannelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    monitor = _get_monitor_or_404(monitor_id, current_user, db)
    destino = payload.destino.strip()
    if payload.tipo == "email":
        destino = destino.lower()
    if not destino:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="El destino no puede estar vacío")

    canal_existente = (
        db.query(NotificationChannel.id)
        .filter(
            NotificationChannel.monitor_id == monitor.id,
            NotificationChannel.tipo == payload.tipo,
            NotificationChannel.destino == destino,
        )
        .first()
    )
    if canal_existente:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este destino ya está configurado para el monitor",
        )

    canal = NotificationChannel(
        monitor_id=monitor.id,
        tipo=payload.tipo,
        destino=destino,
    )
    db.add(canal)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        constraint_name = getattr(getattr(error.orig, "diag", None), "constraint_name", None)
        if constraint_name == "uq_notification_channels_monitor_type_destination":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este destino ya está configurado para el monitor",
            ) from error
        raise
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

@router.get("/{monitor_id}/checks")
def listar_checks_monitor(
    monitor_id: uuid.UUID,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retorna el historial de checks de un monitor específico, ordenados del más reciente al más antiguo.
    """
    monitor = _get_monitor_or_404(monitor_id, current_user, db)
    return (
        db.query(Check)
        .filter(Check.monitor_id == monitor.id)
        .order_by(Check.created_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/{monitor_id}/checks/paginated")
def listar_checks_monitor_paginados(
    monitor_id: uuid.UUID,
    periodo: Literal["24h", "7d", "30d"] = "24h",
    estado: Literal["todos", "exitosos", "fallidos"] = "todos",
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    monitor = _get_monitor_or_404(monitor_id, current_user, db)
    ahora = datetime.utcnow()
    duracion = {"24h": timedelta(hours=24), "7d": timedelta(days=7), "30d": timedelta(days=30)}[periodo]
    query = db.query(Check).filter(
        Check.monitor_id == monitor.id,
        Check.timestamp >= ahora - duracion,
        Check.timestamp <= ahora,
    )
    if estado == "exitosos":
        query = query.filter(Check.exitoso.is_(True))
    elif estado == "fallidos":
        query = query.filter(Check.exitoso.is_(False))

    total = query.count()
    checks = (
        query.order_by(Check.timestamp.desc(), Check.id.desc())
        .offset((pagina - 1) * por_pagina)
        .limit(por_pagina)
        .all()
    )
    return {
        "items": [
            {
                "id": str(check.id),
                "timestamp": check.timestamp,
                "exitoso": check.exitoso,
                "status_code": check.status_code,
                "tiempo_respuesta_ms": check.tiempo_respuesta_ms,
                "tipo_error": check.tipo_error,
            }
            for check in checks
        ],
        "total": total,
        "pagina": pagina,
        "por_pagina": por_pagina,
        "total_paginas": ceil(total / por_pagina) if total else 0,
    }


@router.get("/{monitor_id}/stats")
def obtener_estadisticas_monitor(
    monitor_id: uuid.UUID,
    periodo: Literal["24h", "7d", "30d"] = "24h",
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    monitor_query = db.query(Monitor).filter(Monitor.id == monitor_id)
    if current_user is None:
        monitor_query = monitor_query.filter(
            Monitor.incluido_en_status_personal.is_(True),
            Monitor.activo.is_(True),
        )
    else:
        monitor_query = monitor_query.filter(
            or_(
                Monitor.user_id == current_user.id,
                and_(
                    Monitor.incluido_en_status_personal.is_(True),
                    Monitor.activo.is_(True),
                ),
            )
        )
    monitor = monitor_query.first()
    if not monitor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monitor no encontrado")
    ahora = datetime.utcnow()
    duracion = {"24h": timedelta(hours=24), "7d": timedelta(days=7), "30d": timedelta(days=30)}[periodo]
    desde = ahora - duracion
    cantidad_buckets = {"24h": 24, "7d": 56, "30d": 60}[periodo]
    duracion_bucket = duracion.total_seconds() / cantidad_buckets

    checks = (
        db.query(Check)
        .filter(Check.monitor_id == monitor.id, Check.timestamp >= desde, Check.timestamp <= ahora)
        .order_by(Check.timestamp.asc())
        .all()
    )
    incidentes = (
        db.query(Incident)
        .filter(
            Incident.monitor_id == monitor.id,
            Incident.fecha_inicio < ahora,
            or_(Incident.fecha_fin.is_(None), Incident.fecha_fin > desde),
        )
        .all()
    )
    ultimo_check = (
        db.query(Check)
        .filter(Check.monitor_id == monitor.id)
        .order_by(Check.timestamp.desc())
        .first()
    )

    checks_exitosos = sum(1 for check in checks if check.exitoso)
    latencias = sorted(
        check.tiempo_respuesta_ms
        for check in checks
        if check.tiempo_respuesta_ms is not None
    )

    def percentil(valor: float) -> int | None:
        if not latencias:
            return None
        return latencias[max(0, ceil(valor * len(latencias)) - 1)]

    buckets = [
        {"checks": 0, "exitosos": 0, "latencia_total_ms": 0, "latencias": 0}
        for _ in range(cantidad_buckets)
    ]
    for check in checks:
        indice = min(int((check.timestamp - desde).total_seconds() / duracion_bucket), cantidad_buckets - 1)
        bucket = buckets[indice]
        bucket["checks"] += 1
        bucket["exitosos"] += int(check.exitoso)
        if check.tiempo_respuesta_ms is not None:
            bucket["latencia_total_ms"] += check.tiempo_respuesta_ms
            bucket["latencias"] += 1

    timeline = []
    for indice, bucket in enumerate(buckets):
        inicio_bucket = desde + timedelta(seconds=duracion_bucket * indice)
        timeline.append({
            "timestamp": inicio_bucket.isoformat() + "Z",
            "checks": bucket["checks"],
            "exitosos": bucket["exitosos"],
            "latencia_promedio_ms": (
                round(bucket["latencia_total_ms"] / bucket["latencias"])
                if bucket["latencias"] else None
            ),
        })

    codigos_http = Counter(check.status_code for check in checks if check.status_code is not None)
    errores = Counter(check.tipo_error or "desconocido" for check in checks if not check.exitoso)
    tiempo_caido_segundos = 0
    for incidente in incidentes:
        inicio_incidente = max(incidente.fecha_inicio, desde)
        fin_incidente = min(incidente.fecha_fin or ahora, ahora)
        tiempo_caido_segundos += max(0, int((fin_incidente - inicio_incidente).total_seconds()))

    return {
        "periodo": periodo,
        "desde": desde.isoformat() + "Z",
        "hasta": ahora.isoformat() + "Z",
        "checks_total": len(checks),
        "checks_exitosos": checks_exitosos,
        "checks_fallidos": len(checks) - checks_exitosos,
        "porcentaje_exitosos": round(checks_exitosos * 100 / len(checks), 2) if checks else None,
        "latencia_promedio_ms": round(sum(latencias) / len(latencias)) if latencias else None,
        "latencia_p50_ms": percentil(0.50),
        "latencia_p95_ms": percentil(0.95),
        "codigos_http": [
            {"codigo": codigo, "cantidad": cantidad}
            for codigo, cantidad in sorted(codigos_http.items())
        ],
        "errores": [
            {"tipo": tipo, "cantidad": cantidad}
            for tipo, cantidad in errores.most_common()
        ],
        "incidentes_iniciados": sum(1 for incidente in incidentes if incidente.fecha_inicio >= desde),
        "incidentes_abiertos": sum(1 for incidente in incidentes if not incidente.resuelto),
        "tiempo_caido_segundos": tiempo_caido_segundos,
        "ssl": {
            "dias_restantes": ultimo_check.ssl_dias_restantes if ultimo_check else None,
            "emisor": ultimo_check.ssl_emisor if ultimo_check else None,
            "dominio_coincide": ultimo_check.ssl_dominio_coincide if ultimo_check else None,
            "autofirmado": ultimo_check.ssl_autofirmado if ultimo_check else None,
        },
        "timeline": timeline,
    }