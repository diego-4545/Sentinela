"""
Actuadores virtuales de notificación (ver Entregable 2, sección 9): envían un
efecto observable hacia afuera del sistema en respuesta a un cambio de estado
(apertura o cierre de un incidente).
"""

import os
import smtplib
from email.mime.text import MIMEText

import httpx

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER or "")


def enviar_discord(webhook_url: str, mensaje: str) -> bool:
    """Envía un mensaje a un canal de Discord vía webhook. Regresa True si se envió bien."""
    try:
        with httpx.Client(timeout=10) as client:
            response = client.post(webhook_url, json={"content": mensaje})
            return response.status_code in (200, 204)
    except httpx.RequestError:
        return False


def enviar_email(destino: str, asunto: str, cuerpo: str) -> bool:
    """Envía un correo vía SMTP. Regresa True si se envió bien."""
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASSWORD:
        return False  # SMTP no configurado (ver .env.example)

    mensaje = MIMEText(cuerpo)
    mensaje["Subject"] = asunto
    mensaje["From"] = SMTP_FROM
    mensaje["To"] = destino

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, [destino], mensaje.as_string())
        return True
    except (smtplib.SMTPException, OSError):
        return False


def construir_mensaje_apertura(monitor_nombre: str, monitor_url: str, causa: str) -> str:
    return (
        f"🔴 Sentinela detectó una caída\n"
        f"Monitor: {monitor_nombre}\n"
        f"URL: {monitor_url}\n"
        f"Causa: {causa}"
    )


def construir_mensaje_cierre(monitor_nombre: str, monitor_url: str) -> str:
    return (
        f"✅ Sentinela confirma la recuperación\n"
        f"Monitor: {monitor_nombre}\n"
        f"URL: {monitor_url}\n"
        f"El servicio volvió a responder correctamente."
    )
