from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field, model_validator


class StockMovementType(str, Enum):
    IN = "in"
    OUT = "out"
    ADJUSTMENT = "adjustment"


class InventoryItemCreateDTO(BaseModel):
    property_id: uuid.UUID
    name: str = Field(..., min_length=2, max_length=100)
    category: str = Field(default="higiene", min_length=2, max_length=50)
    unit: str = Field(default="un", min_length=1, max_length=20)
    initial_quantity: Decimal = Field(default=Decimal("0"), ge=Decimal("0"))
    minimum_quantity: Decimal = Field(default=Decimal("1"), ge=Decimal("0"))


class InventoryItemResponseDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    property_id: uuid.UUID
    property_name: str
    name: str
    category: str
    unit: str
    current_quantity: Decimal
    minimum_quantity: Decimal
    is_low_stock: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime


class InventoryMovementCreateDTO(BaseModel):
    item_id: uuid.UUID
    movement_type: StockMovementType
    quantity: Decimal
    unit_cost: Optional[Decimal] = Field(None, ge=Decimal("0.00"))
    reason: Optional[str] = Field(None, max_length=255)
    task_id: Optional[uuid.UUID] = None

    @model_validator(mode="after")
    def validate_quantity(self) -> "InventoryMovementCreateDTO":
        if self.movement_type in (StockMovementType.IN, StockMovementType.OUT) and self.quantity <= 0:
            raise ValueError("A quantidade para entrada ou saída deve ser maior que zero.")
        if self.movement_type == StockMovementType.ADJUSTMENT and self.quantity == 0:
            raise ValueError("O delta de ajuste de estoque não pode ser zero.")
        return self


class InventoryMovementResponseDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    item_id: uuid.UUID
    item_name: str
    property_name: str
    movement_type: StockMovementType
    quantity: Decimal
    balance_after: Decimal
    unit_cost: Optional[Decimal] = None
    reason: Optional[str] = None
    performed_by: Optional[uuid.UUID] = None
    occurred_at: datetime
