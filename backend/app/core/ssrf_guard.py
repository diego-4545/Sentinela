"""
Mitigaciones de riesgo SSRF (Server-Side Request Forgery), conforme a las guías de OWASP.

Documentado en el proyecto: al registrar o chequear un monitor, el backend nunca debe
confiar ciegamente en la URL que el usuario proporcionó, porque podría apuntar a
recursos internos (red privada del servidor, endpoint de metadata de un proveedor cloud,
localhost, etc.) en vez de a un sitio público real.

Controles implementados:
1. Solo se permiten esquemas http:// y https:// (bloquea file://, gopher://, ftp://, etc.)
2. La IP resuelta del dominio se valida contra rangos privados/reservados (RFC 1918,
   loopback, link-local) ANTES de conectar.
3. Esta validación se repite en cada check (no solo al registrar el monitor), para
   prevenir ataques de DNS rebinding.
4. Los redirects se seguyen manualmente, revalidando cada salto contra la misma lista
   de rangos bloqueados, con un límite máximo de saltos.
"""

import ipaddress
import socket
from urllib.parse import urlparse

ESQUEMAS_PERMITIDOS = {"http", "https"}

RANGOS_BLOQUEADOS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),          # red privada
    ipaddress.ip_network("100.64.0.0/10"),       # CGNAT (incluye rango de Tailscale)
    ipaddress.ip_network("127.0.0.0/8"),         # loopback
    ipaddress.ip_network("169.254.0.0/16"),      # link-local (incluye metadata de AWS/GCP/Azure)
    ipaddress.ip_network("172.16.0.0/12"),       # red privada
    ipaddress.ip_network("192.168.0.0/16"),      # red privada
    ipaddress.ip_network("198.18.0.0/15"),       # benchmarking
    ipaddress.ip_network("::1/128"),             # loopback IPv6
    ipaddress.ip_network("fc00::/7"),            # unique local IPv6
    ipaddress.ip_network("fe80::/10"),           # link-local IPv6
]

MAX_REDIRECTS = 5


class SSRFValidationError(Exception):
    """Se lanza cuando una URL no pasa las validaciones anti-SSRF."""
    pass


def validar_esquema(url: str) -> None:
    esquema = urlparse(url).scheme.lower()
    if esquema not in ESQUEMAS_PERMITIDOS:
        raise SSRFValidationError(f"Esquema no permitido: '{esquema}'. Solo se permite http:// o https://")


def resolver_y_validar_ip(hostname: str) -> str:
    """
    Resuelve el hostname a una IP y valida que no esté en un rango bloqueado.
    Regresa la IP resuelta (útil para loguearla en el Check).
    Lanza SSRFValidationError si la IP cae en un rango prohibido o si no resuelve.
    """
    try:
        ip_str = socket.gethostbyname(hostname)
    except socket.gaierror as e:
        raise SSRFValidationError(f"No se pudo resolver el dominio: {e}")

    ip = ipaddress.ip_address(ip_str)

    for rango in RANGOS_BLOQUEADOS:
        if ip in rango:
            raise SSRFValidationError(
                f"La IP resuelta ({ip}) pertenece a un rango privado/reservado ({rango}). "
                "No se permite monitorear recursos internos."
            )

    return ip_str


def validar_url_completa(url: str) -> str:
    """
    Punto de entrada único: valida esquema + resuelve y valida IP.
    Debe llamarse ANTES de cada intento de conexión (registro y cada check individual),
    nunca solo una vez al crear el monitor, para prevenir DNS rebinding.
    """
    validar_esquema(url)
    hostname = urlparse(url).hostname
    if not hostname:
        raise SSRFValidationError("No se pudo determinar el hostname de la URL")
    return resolver_y_validar_ip(hostname)
