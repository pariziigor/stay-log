from datetime import time
from decimal import Decimal
import uuid
import pytest
from app.core.exceptions import DomainException
from app.modules.properties.domain.entities import Property
from app.modules.properties.domain.exceptions import UnauthorizedPropertyAccessError
from app.modules.properties.domain.value_objects import (
    Address,
    PropertyPricing,
    PropertyStatus,
    PropertyType,
)


def test_address_value_object():
    addr = Address(
        street="Rua das Palmeiras",
        number="100",
        city="Florianópolis",
        state="sc",
        postal_code="88015100",
    )
    assert addr.state == "SC"
    assert addr.postal_code == "88015-100"

    with pytest.raises(DomainException):
        Address(street="", city="Florianópolis", state="SC")

    with pytest.raises(DomainException):
        Address(street="Rua A", city="Florianópolis", state="SANTA_CATARINA")


def test_pricing_value_object():
    pricing = PropertyPricing(
        base_nightly_rate=Decimal("250.00"),
        cleaning_fee=Decimal("80.00"),
    )
    assert pricing.base_nightly_rate == Decimal("250.00")
    assert pricing.cleaning_fee == Decimal("80.00")

    with pytest.raises(DomainException):
        PropertyPricing(base_nightly_rate=Decimal("-10.00"))


def test_property_aggregate_behavior():
    owner_id = uuid.uuid4()
    other_user_id = uuid.uuid4()

    addr = Address(
        street="Avenida Beira Mar",
        city="Florianópolis",
        state="SC",
    )

    prop = Property(
        owner_id=owner_id,
        name="Apartamento Beira Mar",
        address=addr,
        max_guests=4,
        bedrooms=2,
        bathrooms=2,
        beds=3,
        property_type=PropertyType.APARTMENT,
        status=PropertyStatus.ACTIVE,
        amenity_ids={1, 2},
    )

    assert prop.is_active is True
    assert prop.max_guests == 4
    assert 1 in prop.amenity_ids
    assert 2 in prop.amenity_ids

    # Sincronização de comodidades
    prop.sync_amenities({2, 3})
    assert 1 not in prop.amenity_ids
    assert 3 in prop.amenity_ids

    # Validação de capacidade
    with pytest.raises(DomainException):
        prop.update_details(
            name="Novo",
            description=None,
            property_type=PropertyType.APARTMENT,
            address=addr,
            max_guests=0,  # Inválido!
            bedrooms=1,
            bathrooms=1,
            beds=1,
            area_m2=None,
            pricing=PropertyPricing(),
            check_in_time=time(15, 0),
            check_out_time=time(11, 0),
        )

    # Verificação de propriedade e permissões
    prop.assert_owned_by(owner_id)  # OK
    with pytest.raises(UnauthorizedPropertyAccessError):
        prop.assert_owned_by(other_user_id)  # Falha!

    # Soft delete
    prop.soft_delete()
    assert prop.is_active is False
    assert prop.deleted_at is not None
