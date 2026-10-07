"""
Sensor virtual de certificado SSL/TLS (ver Entregable 2, sección 8).
Captura vigencia, coincidencia de dominio, emisor, y si el certificado es autofirmado.
"""

import socket
import ssl
from datetime import datetime
from urllib.parse import urlparse


class ResultadoSSL:
    def __init__(
        self,
        dias_restantes: int | None = None,
        dominio_coincide: bool | None = None,
        emisor: str | None = None,
        autofirmado: bool | None = None,
        error: str | None = None,
    ):
        self.dias_restantes = dias_restantes
        self.dominio_coincide = dominio_coincide
        self.emisor = emisor
        self.autofirmado = autofirmado
        self.error = error


def verificar_ssl(url: str, timeout: int = 10) -> ResultadoSSL | None:
    """
    Regresa None si la URL es http:// (no aplica TLS, no es un error).
    Regresa ResultadoSSL con error=<mensaje> si es https:// pero algo falló al obtener el certificado
    (esto en sí mismo es información valiosa: un sitio https:// que no entrega certificado válido
    es una señal de mala configuración de seguridad).
    """
    parsed = urlparse(url)
    if parsed.scheme != "https":
        return None

    hostname = parsed.hostname
    puerto = parsed.port or 443

    try:
        contexto = ssl.create_default_context()
        contexto.check_hostname = False
        contexto.verify_mode = ssl.CERT_NONE

        with socket.create_connection((hostname, puerto), timeout=timeout) as sock:
            with contexto.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert_bin = ssock.getpeercert(binary_form=True)
                cert = ssock.getpeercert(binary_form=False)

        contexto_verificador = ssl.create_default_context()
        try:
            with socket.create_connection((hostname, puerto), timeout=timeout) as sock:
                with contexto_verificador.wrap_socket(sock, server_hostname=hostname) as ssock:
                    cert = ssock.getpeercert()
            autofirmado = False
        except ssl.SSLCertVerificationError as e:
            contexto_sin_verificar = ssl._create_unverified_context()
            with socket.create_connection((hostname, puerto), timeout=timeout) as sock:
                with contexto_sin_verificar.wrap_socket(sock, server_hostname=hostname) as ssock:
                    cert = ssock.getpeercert()
            autofirmado = True

        if not cert:
            return ResultadoSSL(error="No se pudo leer el certificado")

        vencimiento = datetime.strptime(cert["notAfter"], "%b %d %H:%M:%S %Y %Z")
        dias_restantes = (vencimiento - datetime.utcnow()).days

        dominios_cubiertos = [v for k, v in cert.get("subjectAltName", []) if k == "DNS"]
        dominio_coincide = hostname in dominios_cubiertos or any(
            d.startswith("*.") and hostname.endswith(d[1:]) for d in dominios_cubiertos
        )

        emisor_dict = dict(x[0] for x in cert.get("issuer", []))
        emisor = emisor_dict.get("organizationName", emisor_dict.get("commonName", "Desconocido"))

        return ResultadoSSL(
            dias_restantes=dias_restantes,
            dominio_coincide=dominio_coincide,
            emisor=emisor,
            autofirmado=autofirmado,
        )

    except (socket.timeout, socket.gaierror, ConnectionRefusedError, ssl.SSLError, OSError) as e:
        return ResultadoSSL(error=f"{type(e).__name__}: {e}")
