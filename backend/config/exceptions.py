"""
Custom exception handler that wraps all DRF errors into a consistent shape:
  {"detail": "...", "errors": {...}}
"""
from rest_framework.views import exception_handler
from rest_framework.response import Response


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is None:
        return response

    data = response.data

    # Normalise to {"detail": "...", "errors": {...}}
    if isinstance(data, dict):
        detail = data.get("detail", "")
        errors = {k: v for k, v in data.items() if k != "detail"}
        if not detail and errors:
            # e.g. field-level validation errors have no top-level detail
            detail = "Validation error."
        normalised = {"detail": str(detail) if detail else "An error occurred.", "errors": errors}
    elif isinstance(data, list):
        msg = str(data[0]) if data else "An error occurred."
        normalised = {"detail": msg, "errors": {"non_field_errors": [str(x) for x in data]}}
    else:
        normalised = {"detail": str(data), "errors": {}}

    response.data = normalised
    return response
