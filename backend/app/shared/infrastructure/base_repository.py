from abc import ABC, abstractmethod
from typing import Generic, List, Optional, TypeVar
import uuid

T = TypeVar("T")


class BaseRepository(ABC, Generic[T]):
    """Interface abstrata base para repositórios (Porta no padrão Hexagonal / DDD)."""

    @abstractmethod
    async def get_by_id(self, entity_id: uuid.UUID) -> Optional[T]:
        """Recupera entidade pelo seu identificador único."""
        raise NotImplementedError

    @abstractmethod
    async def save(self, entity: T) -> T:
        """Persiste ou atualiza uma entidade."""
        raise NotImplementedError

    @abstractmethod
    async def delete(self, entity_id: uuid.UUID) -> None:
        """Remove a entidade (física ou logicamente via soft-delete)."""
        raise NotImplementedError
