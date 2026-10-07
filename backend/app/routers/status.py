import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.status import StatusItemOut, StatusMonitorOut
from app.services.status_aggregator import obtener_status_monitor, obtener_status_global

router = APIRouter(prefix="/status", tags=["status"])


@router.get("/global", response_model=list[StatusItemOut])
def status_global(db: Session = Depends(get_db)):
    """
    Pública, sin autenticación. Junta los monitores verificados de todos los
    usuarios marcados para la status page global, agrupados por URL.
    """
    return obtener_status_global(db)


@router.get("/{monitor_id}", response_model=StatusMonitorOut)
def status_personal(monitor_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Pública, sin autenticación. Muestra exclusivamente el monitor solicitado,
    si está activo y marcado para aparecer en un estado personal.
    """
    monitor = obtener_status_monitor(monitor_id, db)
    if monitor is None:
        raise HTTPException(status_code=404, detail="Estado del monitor no encontrado")
    return monitor
