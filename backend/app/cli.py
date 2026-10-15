import argparse
import asyncio
from app.core.database import AsyncSessionFactory, Base, engine
from app.core.security import get_password_hash
from app.modules.identity.domain.entities import User
from app.modules.identity.domain.value_objects import Email, UserRole
from app.modules.identity.infrastructure.models import (
    RefreshTokenModel,
    TeamMemberModel,
    UserConsentModel,
    UserModel,
)
from app.modules.identity.infrastructure.repositories import SQLAlchemyUserRepository
from app.modules.properties.infrastructure.models import (
    AmenityModel,
    PropertyAmenityModel,
    PropertyModel,
)


async def init_db_command():
    """Cria tabelas no banco de dados (útil para desenvolvimento local ou testes)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tabelas inicializadas com sucesso.")


async def create_user_command(full_name: str, email_str: str, password: str, role_str: str):
    # Assegura que o schema existe antes de inserir
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionFactory() as session:
        repo = SQLAlchemyUserRepository(session)
        email_vo = Email(email_str)

        existing = await repo.get_by_email(email_vo)
        if existing:
            print(f"Erro: Já existe um usuário com o e-mail '{email_str}'.")
            return

        role = UserRole(role_str)
        password_hash = get_password_hash(password)

        new_user = User(
            full_name=full_name,
            email=email_vo,
            password_hash=password_hash,
            role=role,
        )
        saved = await repo.save(new_user)
        await session.commit()
        print(f"Usuário criado com sucesso!")
        print(f"  ID: {saved.id}")
        print(f"  Nome: {saved.full_name}")
        print(f"  E-mail: {saved.email.value}")
        print(f"  Perfil: {saved.role.value}")


def main():
    parser = argparse.ArgumentParser(description="CLI de Administração da Plataforma")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Subcomando: init-db
    subparsers.add_parser("init-db", help="Inicializar schema do banco de dados")

    # Subcomando: create-user
    create_user_parser = subparsers.add_parser("create-user", help="Criar um usuário")
    create_user_parser.add_argument("--name", required=True, help="Nome completo")
    create_user_parser.add_argument("--email", required=True, help="E-mail")
    create_user_parser.add_argument("--password", required=True, help="Senha")
    create_user_parser.add_argument(
        "--role",
        choices=["admin", "owner", "employee"],
        default="admin",
        help="Perfil do usuário",
    )

    args = parser.parse_args()
    if args.command == "init-db":
        asyncio.run(init_db_command())
    elif args.command == "create-user":
        asyncio.run(create_user_command(args.name, args.email, args.password, args.role))


if __name__ == "__main__":
    main()
