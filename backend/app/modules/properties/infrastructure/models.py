from datetime import datetime, time, timezone
from decimal import Decimal
import uuid
from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    Time,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class AmenityModel(Base):
    __tablename__ = "amenities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    category: Mapped[str] = mapped_column(String(40), nullable=False)


class PropertyAmenityModel(Base):
    __tablename__ = "property_amenities"

    property_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("properties.id", ondelete="CASCADE"),
        primary_key=True,
    )
    amenity_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("amenities.id", ondelete="RESTRICT"),
        primary_key=True,
    )
    notes: Mapped[str | None] = mapped_column(String(150), nullable=True)

    amenity: Mapped["AmenityModel"] = relationship("AmenityModel")


class PropertyModel(Base):
    __tablename__ = "properties"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    property_type: Mapped[str] = mapped_column(String(30), default="apartment", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="active", nullable=False, index=True)

    # Endereço
    address_street: Mapped[str] = mapped_column(String(150), nullable=False)
    address_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address_complement: Mapped[str | None] = mapped_column(String(80), nullable=True)
    address_neighborhood: Mapped[str | None] = mapped_column(String(80), nullable=True)
    address_city: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    address_state: Mapped[str] = mapped_column(String(2), nullable=False)
    address_postal_code: Mapped[str | None] = mapped_column(String(9), nullable=True)
    address_country: Mapped[str] = mapped_column(String(2), default="BR", nullable=False)

    # Capacidade e Cômodos
    max_guests: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    bedrooms: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)
    bathrooms: Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)
    beds: Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)
    area_m2: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)

    # Tarifas e Horários
    base_nightly_rate: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    cleaning_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    check_in_time: Mapped[time] = mapped_column(Time, default=time(15, 0), nullable=False)
    check_out_time: Mapped[time] = mapped_column(Time, default=time(11, 0), nullable=False)

    # Auditoria e Ciclo de Vida
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relacionamento de comodidades
    property_amenities: Mapped[list["PropertyAmenityModel"]] = relationship(
        "PropertyAmenityModel",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
