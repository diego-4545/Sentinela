from pydantic import BaseModel


class StatusItemOut(BaseModel):
    nombre: str | None = None  # null en la global (varios usuarios pueden nombrarlo distinto)
    url: str
    estado: str  # "operativo" | "caido" | "sin_datos"
