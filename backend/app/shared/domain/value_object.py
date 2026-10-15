from abc import ABC
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ValueObject(ABC):
    """Classe base para Value Objects no padrão DDD.

    Value Objects são imutáveis e definidos exclusivamente por seus atributos.
    Dois Value Objects com os mesmos valores são considerados idênticos.
    """

    def __eq__(self, other: Any) -> bool:
        if other is None or other.__class__ != self.__class__:
            return False
        return self.__dict__ == other.__dict__

    def __ne__(self, other: Any) -> bool:
        return not self.__eq__(other)
