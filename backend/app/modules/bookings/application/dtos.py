from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class ReservationSource(str, Enum):
    DIRECT = "direct"
    AIRBNB = "airbnb"
    BOOKING = "booking"
    VRBO = "vrbo"
    OTHER = "other"


class ReservationStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CHECKED_IN = "checked_in"
    CHECKED_OUT = "checked_out"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class GuestResponseDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    nationality: Optional[str] = None
    notes: Optional[str] = None
    anonymized_at: Optional[datetime] = None
    created_at: datetime


class ReservationCreateDTO(BaseModel):
    property_id: uuid.UUID
    guest_id: Optional[uuid.UUID] = None
    guest_name: Optional[str] = Field(None, min_length=2, max_length=150)
    guest_email: Optional[EmailStr] = None
    guest_phone: Optional[str] = Field(None, max_length=20)
    source: ReservationSource = ReservationSource.DIRECT
    external_reference: Optional[str] = Field(None, max_length=80)
    status: ReservationStatus = ReservationStatus.CONFIRMED
    check_in_date: date
    check_out_date: date
    guests_count: int = Field(..., ge=1, le=100)
    total_amount: Optional[Decimal] = Field(None, ge=Decimal("0.00"))
    platform_fee: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    notes: Optional[str] = Field(None, max_length=1000)

    @model_validator(mode="after")
    def validate_dates_and_guest(self) -> "ReservationCreateDTO":
        if self.check_out_date <= self.check_in_date:
            raise ValueError("A data de check-out deve ser posterior à data de check-in.")
        if self.guest_id is None and (not self.guest_name or not self.guest_name.strip()):
            raise ValueError("Informe o nome do hóspede ou selecione um hóspede já cadastrado.")
        if self.total_amount is not None and self.platform_fee > self.total_amount:
            raise ValueError("A taxa da plataforma não pode exceder o valor total da reserva.")
        return self


class ReservationStatusUpdateDTO(BaseModel):
    status: ReservationStatus
    cancellation_reason: Optional[str] = Field(None, max_length=255)


class ReservationResponseDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    property_id: uuid.UUID
    property_name: str
    guest_id: uuid.UUID
    guest_name: str
    guest_email: Optional[str] = None
    guest_phone: Optional[str] = None
    source: ReservationSource
    external_reference: Optional[str] = None
    status: ReservationStatus
    check_in_date: date
    check_out_date: date
    nights: int
    guests_count: int
    total_amount: Decimal
    platform_fee: Decimal
    net_amount: Decimal
    notes: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    created_at: datetime
