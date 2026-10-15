from datetime import datetime, time
from decimal import Decimal
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field
from app.modules.properties.domain.value_objects import PropertyStatus, PropertyType


class AddressDTO(BaseModel):
    street: str = Field(..., min_length=3, max_length=150, description="Logradouro")
    number: Optional[str] = Field(None, max_length=20, description="Número")
    complement: Optional[str] = Field(None, max_length=80, description="Complemento")
    neighborhood: Optional[str] = Field(None, max_length=80, description="Bairro")
    city: str = Field(..., min_length=2, max_length=80, description="Cidade")
    state: str = Field(..., min_length=2, max_length=2, description="UF do estado (ex: SP, SC)")
    postal_code: Optional[str] = Field(None, max_length=9, description="CEP")
    country: str = Field(default="BR", max_length=2, description="País (código ISO 2)")


class AmenityResponseDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    category: str


class PropertyCreateDTO(BaseModel):
    name: str = Field(..., min_length=2, max_length=120, description="Nome de identificação do imóvel")
    description: Optional[str] = Field(None, description="Descrição detalhada para hóspedes e operação")
    property_type: PropertyType = Field(default=PropertyType.APARTMENT, description="Tipo do imóvel")
    address: AddressDTO
    max_guests: int = Field(..., ge=1, le=100, description="Capacidade máxima de hóspedes")
    bedrooms: int = Field(default=1, ge=0, description="Número de quartos")
    bathrooms: int = Field(default=1, ge=0, description="Número de banheiros")
    beds: int = Field(default=1, ge=0, description="Número de camas disponíveis")
    area_m2: Optional[Decimal] = Field(None, gt=0, description="Área útil em metros quadrados")
    base_nightly_rate: Optional[Decimal] = Field(None, ge=0, description="Valor base da diária")
    cleaning_fee: Decimal = Field(default=Decimal("0.00"), ge=0, description="Taxa de limpeza padrão")
    check_in_time: time = Field(default=time(15, 0), description="Horário padrão de entrada")
    check_out_time: time = Field(default=time(11, 0), description="Horário padrão de saída")
    amenity_ids: List[int] = Field(default_factory=list, description="IDs das comodidades associadas")


class PropertyUpdateDTO(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    description: Optional[str] = None
    property_type: Optional[PropertyType] = None
    status: Optional[PropertyStatus] = None
    address: Optional[AddressDTO] = None
    max_guests: Optional[int] = Field(None, ge=1, le=100)
    bedrooms: Optional[int] = Field(None, ge=0)
    bathrooms: Optional[int] = Field(None, ge=0)
    beds: Optional[int] = Field(None, ge=0)
    area_m2: Optional[Decimal] = Field(None, gt=0)
    base_nightly_rate: Optional[Decimal] = Field(None, ge=0)
    cleaning_fee: Optional[Decimal] = Field(None, ge=0)
    check_in_time: Optional[time] = None
    check_out_time: Optional[time] = None
    amenity_ids: Optional[List[int]] = None


class PropertyResponseDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    description: Optional[str] = None
    property_type: PropertyType
    status: PropertyStatus
    address: AddressDTO
    max_guests: int
    bedrooms: int
    bathrooms: int
    beds: int
    area_m2: Optional[Decimal] = None
    base_nightly_rate: Optional[Decimal] = None
    cleaning_fee: Decimal
    check_in_time: time
    check_out_time: time
    amenities: List[AmenityResponseDTO] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class PropertyListResponseDTO(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[PropertyResponseDTO]
