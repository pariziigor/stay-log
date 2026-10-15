from typing import Any, Dict, Optional


class AppException(Exception):
    """Exceção base da aplicação."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        error_code: str = "INTERNAL_SERVER_ERROR",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or {}


class DomainException(AppException):
    """Exceção de violação de regra de negócio do domínio."""

    def __init__(self, message: str, error_code: str = "DOMAIN_RULE_VIOLATION"):
        super().__init__(message=message, status_code=400, error_code=error_code)


class EntityNotFoundError(AppException):
    """Entidade não encontrada no repositório."""

    def __init__(self, entity_name: str, identifier: Any):
        super().__init__(
            message=f"{entity_name} com identificador '{identifier}' não foi encontrado(a).",
            status_code=404,
            error_code="NOT_FOUND",
            details={"entity": entity_name, "identifier": str(identifier)},
        )


class EntityAlreadyExistsError(AppException):
    """Entidade duplicada ou conflito de chave única."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=409,
            error_code="ALREADY_EXISTS",
            details=details,
        )


class InvalidCredentialsError(AppException):
    """Credenciais inválidas de autenticação."""

    def __init__(self, message: str = "E-mail ou senha incorretos."):
        super().__init__(
            message=message,
            status_code=401,
            error_code="INVALID_CREDENTIALS",
        )


class AccountLockedError(AppException):
    """Conta temporariamente bloqueada por tentativas sucessivas falhas."""

    def __init__(self, minutes: int):
        super().__init__(
            message=f"Conta bloqueada por excesso de tentativas. Tente novamente em {minutes} minutos.",
            status_code=423,
            error_code="ACCOUNT_LOCKED",
            details={"locked_duration_minutes": minutes},
        )


class UnauthorizedError(AppException):
    """Token ausente, inválido ou expirado."""

    def __init__(self, message: str = "Não autenticado ou token inválido."):
        super().__init__(
            message=message,
            status_code=401,
            error_code="UNAUTHORIZED",
        )


class ForbiddenError(AppException):
    """Usuário não possui privilégios para executar a ação ou acessar o recurso."""

    def __init__(self, message: str = "Acesso negado para este recurso."):
        super().__init__(
            message=message,
            status_code=403,
            error_code="FORBIDDEN",
        )


class BusinessRuleViolationError(AppException):
    """Violação de regra operacional."""

    def __init__(self, message: str, error_code: str = "BUSINESS_RULE_VIOLATION"):
        super().__init__(
            message=message,
            status_code=422,
            error_code=error_code,
        )
