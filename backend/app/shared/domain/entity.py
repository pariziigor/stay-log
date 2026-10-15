from datetime import datetime, timezone
from typing import Any, Optional
import uuid


class BaseEntity:
    """Classe base para Entidades e Agregados no padrão DDD.

    Entidades possuem identidade própria persistente e são distinguidas
    pelo seu ID e não por seus atributos transitórios.
    """

    def __init__(
        self,
        id: Optional[uuid.UUID] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
    ):
        self._id: uuid.UUID = id or uuid.uuid4()
        now = datetime.now(timezone.utc)
        self._created_at: datetime = created_at or now
        self._updated_at: datetime = updated_at or now

    @property
    def id(self) -> uuid.UUID:
        return self._id

    @property
    def created_at(self) -> datetime:
        return self._created_at

    @property
    def updated_at(self) -> datetime:
        return self._updated_at

    def touch(self) -> None:
        """Atualiza a estampa de data/hora da última alteração."""
        self._updated_at = datetime.now(timezone.utc)

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, BaseEntity):
            return False
        return self.id == other.id

    def __hash__(self) -> int:
        return hash(self.id)

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} id={self.id}>"
