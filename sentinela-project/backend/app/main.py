from fastapi import FastAPI

app = FastAPI(
    title="Sentinela API",
    description="Monitoreo de disponibilidad y postura de seguridad para proyectos web",
    version="0.1.0",
)


@app.get("/")
def root():
    return {"status": "ok", "service": "sentinela-api"}


@app.get("/health")
def health():
    """Endpoint simple para verificar que la API está viva (útil para healthchecks propios más adelante)."""
    return {"status": "healthy"}
