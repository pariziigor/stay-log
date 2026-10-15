from datetime import datetime, timedelta, timezone
import uuid
import pytest
from app.core.exceptions import DomainException
from app.modules.identity.domain.entities import RefreshToken, User
from app.modules.identity.domain.value_objects import ConsentType, Email, UserRole


def test_email_value_object():
    email = Email("  Proprietario@Exemplo.COM  ")
    assert email.value == "proprietario@exemplo.com"
    assert str(email) == "proprietario@exemplo.com"

    with pytest.raises(DomainException):
        Email("invalido-sem-arroba")

    with pytest.raises(DomainException):
        Email("")


def test_user_roles():
    admin = UserRole.ADMIN
    owner = UserRole.OWNER
    employee = UserRole.EMPLOYEE

    assert admin.can_manage_all_properties() is True
    assert owner.can_manage_all_properties() is False

    assert admin.can_manage_own_properties() is True
    assert owner.can_manage_own_properties() is True
    assert employee.can_manage_own_properties() is False

    assert employee.is_operational_staff() is True
    assert owner.is_operational_staff() is False


def test_user_aggregate_lifecycle_and_security():
    user = User(
        full_name="Carlos Gestor",
        email=Email("carlos@gestor.com"),
        password_hash="hashed_secret",
        role=UserRole.OWNER,
    )

    assert user.is_active is True
    assert user.is_locked() is False
    assert user.failed_login_attempts == 0

    # Simular falhas de login sucessivas
    user.record_login_failure(max_attempts=3, lock_minutes=15)
    assert user.failed_login_attempts == 1
    assert user.is_locked() is False

    user.record_login_failure(max_attempts=3, lock_minutes=15)
    assert user.failed_login_attempts == 2
    assert user.is_locked() is False

    user.record_login_failure(max_attempts=3, lock_minutes=15)
    assert user.failed_login_attempts == 3
    assert user.is_locked() is True
    assert user.locked_until is not None

    # Desbloqueio e sucesso
    user.unlock()
    assert user.is_locked() is False
    assert user.failed_login_attempts == 0

    user.record_login_success()
    assert user.last_login_at is not None

    # Soft delete
    user.deactivate()
    assert user.is_active is False
    assert user.deleted_at is not None


def test_refresh_token_lifecycle():
    token_id = uuid.uuid4()
    user_id = uuid.uuid4()
    future_exp = datetime.now(timezone.utc) + timedelta(days=7)
    past_exp = datetime.now(timezone.utc) - timedelta(days=1)

    active_token = RefreshToken(
        id=token_id,
        user_id=user_id,
        token_hash="fake_hash",
        family_id=uuid.uuid4(),
        expires_at=future_exp,
    )
    assert active_token.is_active() is True
    assert active_token.is_expired() is False

    new_token_id = uuid.uuid4()
    active_token.revoke(replaced_by=new_token_id)
    assert active_token.is_active() is False
    assert active_token.revoked_at is not None
    assert active_token.replaced_by == new_token_id

    expired_token = RefreshToken(
        id=uuid.uuid4(),
        user_id=user_id,
        token_hash="fake_hash_exp",
        family_id=uuid.uuid4(),
        expires_at=past_exp,
    )
    assert expired_token.is_expired() is True
    assert expired_token.is_active() is False
