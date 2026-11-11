from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Dict, List, Optional, Set
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import (
    BusinessRuleViolationError,
    EntityAlreadyExistsError,
    EntityNotFoundError,
    ForbiddenError,
)
from app.modules.bookings.application.dtos import (
    GuestResponseDTO,
    ReservationCreateDTO,
    ReservationResponseDTO,
    ReservationSource,
    ReservationStatus,
    ReservationStatusUpdateDTO,
)
from app.modules.bookings.infrastructure.models import GuestModel, ReservationModel
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import UserRole
from app.modules.identity.infrastructure.models import TeamMemberModel
from app.modules.properties.infrastructure.models import PropertyModel

INACTIVE_RESERVATION_STATUSES = {
    ReservationStatus.CANCELLED.value,
    ReservationStatus.NO_SHOW.value,
}


class BookingService:
    """Serviço de aplicação para Gestão de Hóspedes, Reservas e Calendário (RF-05, RF-06, RF-07)."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def _get_allowed_owner_ids_for_employee(self, employee_id: uuid.UUID) -> Set[uuid.UUID]:
        stmt = select(TeamMemberModel.owner_id).where(
            TeamMemberModel.employee_id == employee_id,
            TeamMemberModel.is_active.is_(True),
        )
        res = await self._session.execute(stmt)
        return set(res.scalars().all())

    async def _check_overlap(
        self,
        property_id: uuid.UUID,
        check_in_date: date,
        check_out_date: date,
        exclude_reservation_id: Optional[uuid.UUID] = None,
    ) -> None:
        stmt = select(ReservationModel).where(
            ReservationModel.property_id == property_id,
            ReservationModel.status.notin_(INACTIVE_RESERVATION_STATUSES),
            ReservationModel.check_in_date < check_out_date,
            ReservationModel.check_out_date > check_in_date,
        )
        if exclude_reservation_id is not None:
            stmt = stmt.where(ReservationModel.id != exclude_reservation_id)

        res = await self._session.execute(stmt)
        existing = res.scalar_one_or_none()
        if existing is not None:
            raise EntityAlreadyExistsError(
                f"Conflito de agenda: o imóvel já possui uma reserva ativa entre "
                f"{existing.check_in_date.isoformat()} e {existing.check_out_date.isoformat()}.",
                details={
                    "conflicting_reservation_id": str(existing.id),
                    "check_in_date": existing.check_in_date.isoformat(),
                    "check_out_date": existing.check_out_date.isoformat(),
                },
            )

    async def _build_dtos(self, reservations: List[ReservationModel]) -> List[ReservationResponseDTO]:
        if not reservations:
            return []

        prop_ids = {r.property_id for r in reservations}
        guest_ids = {r.guest_id for r in reservations}

        prop_res = await self._session.execute(
            select(PropertyModel.id, PropertyModel.name).where(PropertyModel.id.in_(prop_ids))
        )
        prop_names: Dict[uuid.UUID, str] = {row[0]: row[1] for row in prop_res.all()}

        guest_res = await self._session.execute(
            select(GuestModel).where(GuestModel.id.in_(guest_ids))
        )
        guests_by_id: Dict[uuid.UUID, GuestModel] = {g.id: g for g in guest_res.scalars().all()}

        result: List[ReservationResponseDTO] = []
        for r in reservations:
            guest = guests_by_id.get(r.guest_id)
            nights = max((r.check_out_date - r.check_in_date).days, 1)
            total_amt = Decimal(str(r.total_amount))
            fee_amt = Decimal(str(r.platform_fee))
            result.append(
                ReservationResponseDTO(
                    id=r.id,
                    property_id=r.property_id,
                    property_name=prop_names.get(r.property_id, "Imóvel"),
                    guest_id=r.guest_id,
                    guest_name=guest.full_name if guest else "Hóspede",
                    guest_email=guest.email if guest else None,
                    guest_phone=guest.phone if guest else None,
                    source=ReservationSource(r.source),
                    external_reference=r.external_reference,
                    status=ReservationStatus(r.status),
                    check_in_date=r.check_in_date,
                    check_out_date=r.check_out_date,
                    nights=nights,
                    guests_count=r.guests_count,
                    total_amount=total_amt,
                    platform_fee=fee_amt,
                    net_amount=total_amt - fee_amt,
                    notes=r.notes,
                    cancelled_at=r.cancelled_at,
                    cancellation_reason=r.cancellation_reason,
                    created_at=r.created_at,
                )
            )
        return result

    async def list_reservations(
        self,
        current_user: User,
        property_id: Optional[uuid.UUID] = None,
        status: Optional[ReservationStatus] = None,
    ) -> List[ReservationResponseDTO]:
        stmt = (
            select(ReservationModel)
            .join(PropertyModel, PropertyModel.id == ReservationModel.property_id)
            .where(PropertyModel.deleted_at.is_(None))
        )

        if current_user.role == UserRole.OWNER:
            stmt = stmt.where(PropertyModel.owner_id == current_user.id)
        elif current_user.role == UserRole.EMPLOYEE:
            allowed_owners = await self._get_allowed_owner_ids_for_employee(current_user.id)
            if not allowed_owners:
                return []
            stmt = stmt.where(PropertyModel.owner_id.in_(allowed_owners))

        if property_id:
            stmt = stmt.where(ReservationModel.property_id == property_id)
        if status:
            stmt = stmt.where(ReservationModel.status == status.value)

        stmt = stmt.order_by(ReservationModel.check_in_date.asc(), ReservationModel.created_at.desc())
        res = await self._session.execute(stmt)
        items = list(res.scalars().all())
        return await self._build_dtos(items)

    async def create_reservation(
        self,
        current_user: User,
        dto: ReservationCreateDTO,
    ) -> ReservationResponseDTO:
        if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
            raise ForbiddenError("Apenas proprietários ou administradores podem registrar reservas.")

        prop_res = await self._session.execute(
            select(PropertyModel).where(
                PropertyModel.id == dto.property_id,
                PropertyModel.deleted_at.is_(None),
            )
        )
        prop = prop_res.scalar_one_or_none()
        if prop is None:
            raise EntityNotFoundError("Imóvel", dto.property_id)

        if current_user.role == UserRole.OWNER and prop.owner_id != current_user.id:
            raise ForbiddenError("Você só pode registrar reservas para imóveis de sua titularidade.")

        if dto.guests_count > prop.max_guests:
            raise BusinessRuleViolationError(
                f"A quantidade de hóspedes ({dto.guests_count}) excede a capacidade máxima do imóvel ({prop.max_guests}).",
                error_code="GUEST_CAPACITY_EXCEEDED",
            )

        if dto.status.value not in INACTIVE_RESERVATION_STATUSES:
            await self._check_overlap(
                property_id=prop.id,
                check_in_date=dto.check_in_date,
                check_out_date=dto.check_out_date,
            )

        # Resolve ou cria hóspede vinculado ao proprietário do imóvel
        if dto.guest_id is not None:
            guest_res = await self._session.execute(
                select(GuestModel).where(GuestModel.id == dto.guest_id)
            )
            guest = guest_res.scalar_one_or_none()
            if guest is None:
                raise EntityNotFoundError("Hóspede", dto.guest_id)
            if guest.owner_id != prop.owner_id:
                raise ForbiddenError("O hóspede informado não pertence ao proprietário deste imóvel.")
        else:
            guest = GuestModel(
                id=uuid.uuid4(),
                owner_id=prop.owner_id,
                full_name=dto.guest_name.strip(),  # type: ignore[union-attr]
                email=str(dto.guest_email).lower().strip() if dto.guest_email else None,
                phone=dto.guest_phone.strip() if dto.guest_phone else None,
            )
            self._session.add(guest)
            await self._session.flush()

        nights = (dto.check_out_date - dto.check_in_date).days
        if dto.total_amount is not None:
            total_amount = dto.total_amount
        else:
            nightly = prop.base_nightly_rate or Decimal("0.00")
            cleaning = prop.cleaning_fee or Decimal("0.00")
            total_amount = (nightly * Decimal(nights)) + cleaning

        if dto.platform_fee > total_amount:
            raise BusinessRuleViolationError(
                "A taxa da plataforma não pode exceder o valor total da reserva.",
                error_code="INVALID_PLATFORM_FEE",
            )

        now = datetime.now(timezone.utc)
        reservation = ReservationModel(
            id=uuid.uuid4(),
            property_id=prop.id,
            guest_id=guest.id,
            source=dto.source.value,
            external_reference=dto.external_reference.strip() if dto.external_reference else None,
            status=dto.status.value,
            check_in_date=dto.check_in_date,
            check_out_date=dto.check_out_date,
            guests_count=dto.guests_count,
            total_amount=total_amount,
            platform_fee=dto.platform_fee,
            notes=dto.notes.strip() if dto.notes else None,
            cancelled_at=now if dto.status == ReservationStatus.CANCELLED else None,
            created_by=current_user.id,
        )
        self._session.add(reservation)
        await self._session.flush()

        dtos = await self._build_dtos([reservation])
        return dtos[0]

    async def update_reservation_status(
        self,
        current_user: User,
        reservation_id: uuid.UUID,
        dto: ReservationStatusUpdateDTO,
    ) -> ReservationResponseDTO:
        if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
            raise ForbiddenError("Apenas proprietários ou administradores podem alterar o status de reservas.")

        res = await self._session.execute(
            select(ReservationModel).where(ReservationModel.id == reservation_id)
        )
        reservation = res.scalar_one_or_none()
        if reservation is None:
            raise EntityNotFoundError("Reserva", reservation_id)

        prop_res = await self._session.execute(
            select(PropertyModel).where(PropertyModel.id == reservation.property_id)
        )
        prop = prop_res.scalar_one_or_none()
        if prop is None:
            raise EntityNotFoundError("Imóvel", reservation.property_id)

        if current_user.role == UserRole.OWNER and prop.owner_id != current_user.id:
            raise ForbiddenError("Acesso negado: esta reserva pertence a outro proprietário.")

        # Se estiver reativando uma reserva cancelada/no-show, valida ausência de conflito de agenda
        if (
            reservation.status in INACTIVE_RESERVATION_STATUSES
            and dto.status.value not in INACTIVE_RESERVATION_STATUSES
        ):
            await self._check_overlap(
                property_id=reservation.property_id,
                check_in_date=reservation.check_in_date,
                check_out_date=reservation.check_out_date,
                exclude_reservation_id=reservation.id,
            )

        now = datetime.now(timezone.utc)
        reservation.status = dto.status.value
        if dto.status == ReservationStatus.CANCELLED:
            reservation.cancelled_at = reservation.cancelled_at or now
            reservation.cancellation_reason = (
                dto.cancellation_reason.strip() if dto.cancellation_reason else "Cancelada pelo gestor"
            )
        else:
            reservation.cancelled_at = None
            reservation.cancellation_reason = None

        reservation.updated_at = now
        await self._session.flush()

        dtos = await self._build_dtos([reservation])
        return dtos[0]

    async def list_guests(self, current_user: User) -> List[GuestResponseDTO]:
        if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
            raise ForbiddenError("Acesso restrito a proprietários e administradores.")

        stmt = select(GuestModel)
        if current_user.role == UserRole.OWNER:
            stmt = stmt.where(GuestModel.owner_id == current_user.id)
        stmt = stmt.order_by(GuestModel.created_at.desc())

        res = await self._session.execute(stmt)
        return [GuestResponseDTO.model_validate(g) for g in res.scalars().all()]

    async def anonymize_guest(self, current_user: User, guest_id: uuid.UUID) -> GuestResponseDTO:
        """Anonimiza dados pessoais do hóspede em conformidade com o art. 18 da LGPD."""
        if current_user.role not in (UserRole.ADMIN, UserRole.OWNER):
            raise ForbiddenError("Apenas proprietários ou administradores podem anonimizar hóspedes.")

        res = await self._session.execute(select(GuestModel).where(GuestModel.id == guest_id))
        guest = res.scalar_one_or_none()
        if guest is None:
            raise EntityNotFoundError("Hóspede", guest_id)

        if current_user.role == UserRole.OWNER and guest.owner_id != current_user.id:
            raise ForbiddenError("Acesso negado: este hóspede pertence a outro proprietário.")

        now = datetime.now(timezone.utc)
        guest.full_name = "Hóspede anonimizado (LGPD)"
        guest.email = None
        guest.phone = None
        guest.nationality = None
        guest.notes = None
        guest.anonymized_at = now
        guest.updated_at = now

        # Limpa notas em reservas associadas
        res_reservations = await self._session.execute(
            select(ReservationModel).where(ReservationModel.guest_id == guest_id)
        )
        for r in res_reservations.scalars().all():
            r.notes = None

        await self._session.flush()
        return GuestResponseDTO.model_validate(guest)
