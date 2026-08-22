import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.monitor import Monitor
from app.models.user import User
from app.schemas.monitor import MonitorCreate, MonitorOut, MonitorUpdate

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
