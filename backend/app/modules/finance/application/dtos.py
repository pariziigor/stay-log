from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field


class TransactionType(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class PaymentMethod(str, Enum):
    PIX = "pix"
    CREDIT_CARD = "credit_card"
    DEBIT_CARD = "debit_card"
    BANK_TRANSFER = "bank_transfer"
    CASH = "cash"
    PLATFORM_PAYOUT = "platform_payout"
    OTHER = "other"


class FinancialCategoryCreateDTO(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    type: TransactionType


class FinancialCategoryResponseDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: Optional[uuid.UUID] = None
    name: str
    type: TransactionType
    is_active: bool


class FinancialTransactionCreateDTO(BaseModel):
    property_id: uuid.UUID
    category_id: int
    type: TransactionType
    amount: Decimal = Field(..., gt=Decimal("0.00"))
    description: str = Field(..., min_length=2, max_length=255)
    transaction_date: date
    due_date: Optional[date] = None
    paid_date: Optional[date] = None
    payment_status: PaymentStatus = PaymentStatus.PAID
    payment_method: Optional[PaymentMethod] = PaymentMethod.PIX
    reservation_id: Optional[uuid.UUID] = None


class FinancialTransactionResponseDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    property_id: uuid.UUID
    property_name: str
    category_id: int
    category_name: str
    type: TransactionType
    amount: Decimal
    description: str
    transaction_date: date
    due_date: Optional[date] = None
    paid_date: Optional[date] = None
    payment_status: PaymentStatus
    payment_method: Optional[PaymentMethod] = None
    reservation_id: Optional[uuid.UUID] = None
    created_at: datetime


class CashFlowSummaryDTO(BaseModel):
    total_income: Decimal
    total_expense: Decimal
    net_result: Decimal
    margin_pct: float
    pending_income: Decimal
    pending_expense: Decimal
    transactions_count: int
