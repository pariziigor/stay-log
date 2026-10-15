from typing import Any
from app.core.exceptions import AppException


class PropertyNotFoundError(AppException):
    def __init__(self, property_id: Any):
        super().__init__(
            message=f"Imóvel com identificador '{property_id}' não foi encontrado.",
            status_code=404,
            error_code="PROPERTY_NOT_FOUND",
        )


class UnauthorizedPropertyAccessError(AppException):
    def __init__(self, message: str = "Você não tem permissão para visualizar ou gerenciar este imóvel."):
        super().__init__(
            message=message,
            status_code=403,
            error_code="FORBIDDEN_PROPERTY_ACCESS",
        )


class AmenityNotFoundError(AppException):
    def __init__(self, amenity_id: int):
        super().__init__(
            message=f"Comodidade com código/id '{amenity_id}' não encontrada.",
            status_code=404,
            error_code="AMENITY_NOT_FOUND",
        )
