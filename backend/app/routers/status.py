import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.status import StatusItemOut
from app.services.status_aggregator import obtener_status_personal, obtener_status_global

router = APIRouter(prefix="/status", tags=["status"])


@router.get("/global", response_model=list[StatusItemOut])
def status_global(db: Session = Depends(get_db)):
    """
    Pública, sin autenticación. Junta los monitores verificados de todos los
    usuarios marcados para la status page global, agrupados por URL.
    """
    return obtener_status_global(db)


@router.get("/{user_id}", response_model=list[StatusItemOut])
def status_personal(user_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Pública, sin autenticación. Muestra solo los monitores que ESE usuario
    marcó explícitamente como incluido_en_status_personal=True.
    """
    return obtener_status_personal(user_id, db)
