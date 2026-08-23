"""
Motor de checks: ejecuta una verificación de disponibilidad para un monitor,
aplicando las mitigaciones SSRF en cada intento (incluyendo cada redirect).
"""

import time
import socket
from urllib.parse import urlparse

import httpx

from app.core.ssrf_guard import validar_url_completa, SSRFValidationError, MAX_REDIRECTS

TIMEOUT_SEGUNDOS = 10


class ResultadoCheck:
    def __init__(self, exitoso: bool, status_code: int | None, tiempo_respuesta_ms: int | None,
                 tipo_error: str | None = None, detalle_error: str | None = None):
        self.exitoso = exitoso
        self.status_code = status_code
        self.tiempo_respuesta_ms = tiempo_respuesta_ms
        self.tipo_error = tipo_error
        self.detalle_error = detalle_error


def ejecutar_check(url: str) -> ResultadoCheck:
    """
    Ejecuta un check HTTP/HEAD contra la URL dada, con:
    - Validación SSRF antes de la petición inicial
    - Revalidación SSRF en cada redirect (no se sigue automáticamente con httpx,
      se controla manualmente salto por salto)
    - Medición de tiempo de respuesta
    - Clasificación del tipo de error si algo falla
    """
    url_actual = url
    saltos = 0

    while saltos <= MAX_REDIRECTS:
        # 1. Validación SSRF: esquema + resolución de IP contra rangos bloqueados.
        #    Se hace en CADA salto, no solo en la URL original (previene DNS rebinding
        #    y redirects maliciosos hacia recursos internos).
        try:
            validar_url_completa(url_actual)
        except SSRFValidationError as e:
            return ResultadoCheck(
                exitoso=False, status_code=None, tiempo_respuesta_ms=None,
                tipo_error="ssrf_blocked", detalle_error=str(e),
            )

        # 2. Ejecutar la petición SIN seguir redirects automáticamente
        #    (follow_redirects=False), para poder revalidar cada salto nosotros mismos.
        inicio = time.monotonic()
        try:
            with httpx.Client(timeout=TIMEOUT_SEGUNDOS, follow_redirects=False) as client:
                response = client.head(url_actual)
                # Algunos servidores no soportan HEAD correctamente (405/501): reintenta con GET
                if response.status_code in (405, 501):
                    response = client.get(url_actual)
        except httpx.ConnectTimeout:
            return ResultadoCheck(
                exitoso=False, status_code=None, tiempo_respuesta_ms=None,
                tipo_error="timeout", detalle_error="Tiempo de espera agotado al conectar",
            )
        except httpx.ConnectError as e:
            return ResultadoCheck(
                exitoso=False, status_code=None, tiempo_respuesta_ms=None,
                tipo_error="connection_error", detalle_error=str(e),
            )
        except socket.gaierror as e:
            return ResultadoCheck(
                exitoso=False, status_code=None, tiempo_respuesta_ms=None,
                tipo_error="dns_error", detalle_error=str(e),
            )
        except httpx.RequestError as e:
            return ResultadoCheck(
                exitoso=False, status_code=None, tiempo_respuesta_ms=None,
                tipo_error="request_error", detalle_error=str(e),
            )

        tiempo_ms = int((time.monotonic() - inicio) * 1000)

        # 3. Si es un redirect (3xx con Location), seguirlo manualmente y revalidar
        if response.status_code in (301, 302, 303, 307, 308) and "location" in response.headers:
            saltos += 1
            nueva_url = httpx.URL(url_actual).join(response.headers["location"])
            url_actual = str(nueva_url)
            continue

        # 4. Cualquier otra respuesta: clasificar como éxito (2xx/3xx sin location) o error de cliente/servidor
        exitoso = response.status_code < 500
        return ResultadoCheck(
            exitoso=exitoso,
            status_code=response.status_code,
            tiempo_respuesta_ms=tiempo_ms,
            tipo_error=None if exitoso else "http_error",
            detalle_error=None if exitoso else f"HTTP {response.status_code}",
        )

    # Se agotaron los redirects permitidos sin llegar a una respuesta final
    return ResultadoCheck(
        exitoso=False, status_code=None, tiempo_respuesta_ms=None,
        tipo_error="too_many_redirects", detalle_error=f"Se excedió el límite de {MAX_REDIRECTS} redirecciones",
    )
