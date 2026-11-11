from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db_session
from app.core.dependencies import get_current_user, require_roles
from app.modules.bookings.application.dtos import (
    GuestResponseDTO,
    ReservationCreateDTO,
    ReservationResponseDTO,
    ReservationStatus,
    ReservationStatusUpdateDTO,
)
from app.modules.bookings.application.services import BookingService
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole

router = APIRouter(prefix="/bookings", tags=["Reservas, Hóspedes & Calendário (RF-05 a RF-07)"])


def get_booking_service(session: AsyncSession = Depends(get_db_session)) -> BookingService:
    return BookingService(session)


@router.get(
    "",
    response_model=List[ReservationResponseDTO],
    summary="Listar reservas e calendário de estadias",
)
async def list_reservations(
    property_id: Optional[uuid.UUID] = Query(None, description="Filtrar por imóvel"),
    status_filter: Optional[ReservationStatus] = Query(None, alias="status", description="Filtrar por status"),
    current_user: User = Depends(get_current_user),
    service: BookingService = Depends(get_booking_service),
) -> List[ReservationResponseDTO]:
    return await service.list_reservations(
        current_user=current_user,
        property_id=property_id,
        status=status_filter,
    )


@router.post(
    "",
    response_model=ReservationResponseDTO,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar nova reserva (com validação anti-sobreposição e capacidade)",
)
async def create_reservation(
    dto: ReservationCreateDTO,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    service: BookingService = Depends(get_booking_service),
) -> ReservationResponseDTO:
    return await service.create_reservation(current_user=current_user, dto=dto)


@router.patch(
    "/{reservation_id}/status",
    response_model=ReservationResponseDTO,
    summary="Atualizar status da reserva (check-in, check-out, cancelamento)",
)
async def update_reservation_status(
    reservation_id: uuid.UUID,
    dto: ReservationStatusUpdateDTO,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    service: BookingService = Depends(get_booking_service),
) -> ReservationResponseDTO:
    return await service.update_reservation_status(
        current_user=current_user,
        reservation_id=reservation_id,
        dto=dto,
    )


@router.get(
    "/guests",
    response_model=List[GuestResponseDTO],
    summary="Listar hóspedes cadastrados",
)
async def list_guests(
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    service: BookingService = Depends(get_booking_service),
) -> List[GuestResponseDTO]:
    return await service.list_guests(current_user=current_user)


@router.post(
    "/guests/{guest_id}/anonymize",
    response_model=GuestResponseDTO,
    summary="Anonimizar dados pessoais do hóspede (LGPD art. 18)",
)
async def anonymize_guest(
    guest_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.OWNER)),
    service: BookingService = Depends(get_booking_service),
) -> GuestResponseDTO:
    return await service.anonymize_guest(current_user=current_user, guest_id=guest_id)
