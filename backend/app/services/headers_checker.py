"""
Sensor virtual de headers de seguridad HTTP (ver Entregable 2, sección 8, y la
respuesta al comité sobre "presencia vs. configuración correcta").
No basta con que el header exista: se evalúa también si su valor es razonable,
usando como referencia las reglas públicas de Mozilla Observatory.
"""

import httpx


def evaluar_hsts(valor: str | None) -> dict:
    if not valor:
        return {"presente": False, "fuerte": False, "detalle": "Header ausente"}

    max_age = None
    for parte in valor.split(";"):
        parte = parte.strip()
        if parte.startswith("max-age="):
            try:
                max_age = int(parte.split("=", 1)[1])
            except ValueError:
                pass

    incluye_subdominios = "includesubdomains" in valor.lower()
    fuerte = max_age is not None and max_age >= 15_552_000

    return {
        "presente": True,
        "fuerte": fuerte,
        "max_age": max_age,
        "incluye_subdominios": incluye_subdominios,
    }


def evaluar_csp(valor: str | None) -> dict:
    if not valor:
        return {"presente": False, "fuerte": False, "detalle": "Header ausente"}

    valor_lower = valor.lower()
    usa_unsafe = "unsafe-inline" in valor_lower or "unsafe-eval" in valor_lower
    fuerte = not usa_unsafe

    return {
        "presente": True,
        "fuerte": fuerte,
        "usa_unsafe_inline_o_eval": usa_unsafe,
    }


def evaluar_x_frame_options(valor: str | None) -> dict:
    if not valor:
        return {"presente": False, "fuerte": False, "detalle": "Header ausente"}

    valor_normalizado = valor.strip().upper()
    fuerte = valor_normalizado in ("DENY", "SAMEORIGIN")

    return {
        "presente": True,
        "fuerte": fuerte,
        "valor": valor,
    }


def evaluar_headers_seguridad(headers: httpx.Headers) -> dict:
    """Recibe los headers ya obtenidos de una respuesta HTTP y los evalúa."""
    return {
        "hsts": evaluar_hsts(headers.get("strict-transport-security")),
        "csp": evaluar_csp(headers.get("content-security-policy")),
        "x_frame_options": evaluar_x_frame_options(headers.get("x-frame-options")),
    }
