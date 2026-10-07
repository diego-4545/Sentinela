from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, monitors, status

app = FastAPI(
    title="Sentinela API",
    description="Monitoreo de disponibilidad y postura de seguridad para proyectos web",
    version="0.1.0",
)

origins = [
    "https://app.sentinela.my",
    "https://status.sentinela.my",
    "http://localhost:5173",  
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(monitors.router)
app.include_router(status.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "sentinela-api"}


@app.get("/health")
def health():
    """Endpoint simple para verificar que la API está viva."""
    return {"status": "healthy"}