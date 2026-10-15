from app.core.exceptions import AppException


class UserNotFoundError(AppException):
    def __init__(self, identifier: str):
        super().__init__(
            message=f"Usuário '{identifier}' não foi encontrado.",
            status_code=404,
            error_code="USER_NOT_FOUND",
        )


class UserAlreadyExistsError(AppException):
    def __init__(self, email: str):
        super().__init__(
            message=f"Já existe um usuário cadastrado com o e-mail '{email}'.",
            status_code=409,
            error_code="USER_ALREADY_EXISTS",
        )


class RefreshTokenRevokedOrReusedError(AppException):
    def __init__(self, message: str = "Token de atualização revogado ou tentativa de reuso detectada."):
        super().__init__(
            message=message,
            status_code=401,
            error_code="TOKEN_REUSE_DETECTED",
        )


class RefreshTokenExpiredError(AppException):
    def __init__(self, message: str = "Token de atualização expirado. Por favor, autentique-se novamente."):
        super().__init__(
            message=message,
            status_code=401,
            error_code="REFRESH_TOKEN_EXPIRED",
        )
