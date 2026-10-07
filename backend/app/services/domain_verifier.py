"""
Verificación de propiedad de dominio (ver Entregable 1, mecanismo de archivo):
antes de activar un monitor con alertas, el usuario debe demostrar control real
sobre el dominio subiendo un archivo específico a su raíz.

Este mecanismo es intencionalmente pasivo: una simple petición GET a una URL
conocida de antemano, igual que hace cualquier visitante — no es distinto,
en naturaleza, de los checks normales de disponibilidad. La diferencia es
que aquí la respuesta se compara contra un valor esperado, no solo se mide
si el sitio responde.
"""

from urllib.parse import urlparse

import httpx

from app.core.ssrf_guard import validar_url_completa, SSRFValidationError

TIMEOUT_SEGUNDOS = 10


class ResultadoVerificacion:
    def __init__(self, verificado: bool, detalle: str):
        self.verificado = verificado
        self.detalle = detalle


def verificar_propiedad_dominio(url_monitor: str, token: str) -> ResultadoVerificacion:
    """
    Construye la URL esperada del archivo de verificación a partir del dominio
    del monitor, la consulta, y compara el contenido contra el token esperado.
    """
    parsed = urlparse(url_monitor)
    base = f"{parsed.scheme}://{parsed.netloc}"
    url_archivo = f"{base}/sentinela-verify-{token}.txt"

    try:
        validar_url_completa(url_archivo)
    except SSRFValidationError as e:
        return ResultadoVerificacion(verificado=False, detalle=f"URL no permitida: {e}")

    try:
        with httpx.Client(timeout=TIMEOUT_SEGUNDOS, follow_redirects=True) as client:
            response = client.get(url_archivo)
    except httpx.RequestError as e:
        return ResultadoVerificacion(
            verificado=False,
            detalle=f"No se pudo acceder a {url_archivo}: {e}",
        )

    if response.status_code != 200:
        return ResultadoVerificacion(
            verificado=False,
            detalle=f"El archivo no existe o no es accesible (HTTP {response.status_code}) en {url_archivo}",
        )

    contenido = response.text.strip()
    if contenido != token:
        return ResultadoVerificacion(
            verificado=False,
            detalle="El archivo existe pero su contenido no coincide con el token esperado",
        )

    return ResultadoVerificacion(verificado=True, detalle="Verificación exitosa")
