# Etapa 2 — Setup Backend (Python / FastAPI / DDD)

> **Status:** Concluído com 100% dos testes unitários e de integração aprovados.
> **Padrão Arquitetural:** Domain-Driven Design (DDD) + Clean Architecture + Princípios Avançados de OOP.

---

## 1. Estrutura de Pastas e Bounded Contexts

O backend foi organizado em camadas concêntricas respeitando rigorosamente a Regra de Dependência do DDD: a camada de **Domínio** é pura (não depende de frameworks web nem de ORM), a camada de **Aplicação** orquestra casos de uso e DTOs, a de **Infraestrutura** implementa os adaptadores técnicos (SQLAlchemy, hashing, JWT) e a de **Apresentação** expõe os Controllers/Routers HTTP do FastAPI.

```
backend/
├── app/
│   ├── main.py                          # Entrypoint FastAPI, CORS, handlers globais de erro e lifespan
│   ├── cli.py                           # CLI administrativa para criação segura de administradores
│   ├── core/                            # Kernel transversal compartilhado
│   │   ├── config.py                    # Configurações de ambiente (pydantic-settings)
│   │   ├── database.py                  # Engine assíncrono e sessão do SQLAlchemy 2.0
│   │   ├── security.py                  # Hashing bcrypt, emissão e decodificação JWT com JTI
│   │   ├── exceptions.py                # Hierarquia de exceções de domínio e aplicação mapeadas para HTTP
│   │   └── dependencies.py              # Injeção de dependências: get_current_user e require_roles (RBAC)
│   │
│   ├── shared/                          # Shared Kernel DDD
│   │   ├── domain/
│   │   │   ├── entity.py                # BaseEntity com identidade (UUID) e timestamps
│   │   │   └── value_object.py          # ValueObject imutável (dataclass frozen)
│   │   └── infrastructure/
│   │       └── base_repository.py       # Porta genérica BaseRepository[T]
│   │
│   └── modules/                         # Bounded Contexts (Subdomínios)
│       ├── identity/                    # Domínio: Identidade, Autenticação e LGPD (RF-01, RF-02, RNF-01/02)
│       │   ├── domain/
│       │   │   ├── entities.py          # User (Agregado Raiz), RefreshToken, UserConsent
│       │   │   ├── value_objects.py     # UserRole (Enum), ConsentType, Email (Validação e normalização)
│       │   │   ├── exceptions.py        # UserNotFoundError, UserAlreadyExistsError, TokenReusedError
│       │   │   └── repository.py        # Porta abstrata UserRepository
│       │   ├── application/
│       │   │   ├── dtos.py              # DTOs de registro, login, refresh, perfil e consentimento
│       │   │   └── services.py          # AuthService: casos de uso de autenticação e ciclo de tokens
│       │   ├── infrastructure/
│       │   │   ├── models.py            # Modelos ORM (users, refresh_tokens, user_consents, team_members)
│       │   │   └── repositories.py      # Adaptador concreto SQLAlchemyUserRepository
│       │   └── presentation/
│       │       └── routes.py            # Controllers /api/v1/auth/*
│       │
│       └── properties/                  # Domínio: Imóveis e Comodidades (RF-03, RF-04)
│           ├── domain/
│           │   ├── entities.py          # Property (Agregado Raiz), Amenity
│           │   ├── value_objects.py     # Address, PropertyPricing, PropertyType, PropertyStatus
│           │   ├── exceptions.py        # PropertyNotFoundError, UnauthorizedPropertyAccessError
│           │   └── repository.py        # Porta abstrata PropertyRepository
│           │   ├── dtos.py              # DTOs de criação, atualização, listagem e comodidades
│           │   └── services.py          # PropertyService: regras operacionais e isolamento de tenant
│           ├── infrastructure/
│           │   ├── models.py            # Modelos ORM (properties, amenities, property_amenities)
│           │   └── repositories.py      # Adaptador concreto SQLAlchemyPropertyRepository
│           └── presentation/
│               └── routes.py            # Controllers /api/v1/properties/*
│
├── tests/
│   ├── conftest.py                      # Fixtures do pytest (Async SQLite in-memory, cliente HTTP, seed)
│   ├── unit/
│   │   ├── test_identity_domain.py      # Testes unitários de regras de autenticação e agregados
│   │   └── test_properties_domain.py    # Testes unitários do agregado de imóveis e value objects
│   └── integration/
│       ├── test_auth_api.py             # Testes de integração da API de autenticação
│       └── test_properties_api.py       # Testes de integração de CRUD, RBAC e isolamento de tenant
│
├── requirements.txt
└── .env.example
```

---

## 2. Princípios de Orientação a Objetos (OOP) e DDD Aplicados

1. **Agregados Ricos (vs. Modelos Anêmicos):**
   - `User`: Encapsula a lógica de falhas consecutivas de login (`record_login_failure`), bloqueio temporal contra força bruta (`is_locked`), desbloqueio administrativo (`unlock`), registro de consentimento LGPD e desativação com rastreabilidade (`deactivate`).
   - `Property`: Centraliza a sincronização atômica de comodidades (`sync_amenities`), aplicação de regras de capacidade (`update_details`), conferência de propriedade do imóvel (`assert_owned_by`) e soft delete seguro (`soft_delete`).
2. **Value Objects Imutáveis (`frozen=True`):**
   - `Email`: Garante formato válido e normalização em minúsculas (case-insensitive).
   - `Address`: Valida tamanho de logradouro, formato de UF com 2 caracteres e formatação padrão de CEP (`XXXXX-XXX`).
   - `PropertyPricing`: Garante que valores de diária e taxa de limpeza nunca assumam valores negativos.
3. **Inversão de Dependência (DIP / Portas e Adaptadores):**
   - Os serviços da camada de aplicação (`AuthService`, `PropertyService`) dependem exclusivamente das interfaces abstratas de repositório (`UserRepository`, `PropertyRepository`).
   - As implementações concretas (`SQLAlchemyUserRepository`, `SQLAlchemyPropertyRepository`) são injetadas em tempo de execução via sistema de injeção de dependências do FastAPI (`Depends`).

---

## 3. Segurança e Perfis de Acesso (RBAC)

Os 3 perfis de usuários previstos nos requisitos funcionais (RF-01, RF-02) estão integrados tanto no domínio quanto nos controllers:

| Perfil | Escopo de Acesso a Imóveis | Permissão de Criação / Edição | Acesso a Relatórios Macro |
|---|---|---|---|
| **Administrador (`admin`)** | Visualiza todos os imóveis da plataforma | Sim | Sim (visão consolidada de todos os usuários) |
| **Proprietário/Gestor (`owner`)** | Visualiza apenas os imóveis dos quais é dono (isolamento estrito de tenant) | Sim (somente de seus próprios imóveis) | Sim (restrito aos seus dados operacionais) |
| **Funcionário (`employee`)** | Acesso restrito de leitura (somente aos imóveis vinculados onde atua) | Não (tentativas retornam `403 Forbidden`) | Não |

### Estratégia de Tokens JWT e Defesa em Profundidade
- **Access Token:** Vida curta (30 minutos por padrão), assinado com `HS256`, contendo identificador único de token (`jti` - JWT ID) para evitar ataques de repetição e colisão.
- **Refresh Token com Rotação Automática:** Tokens opacos armazenados em banco apenas através do seu hash SHA-256. A cada renovação, o token antigo é revogado e um novo é emitido. Caso um token revogado seja reutilizado, o sistema detecta a violação e revoga imediatamente toda a família de tokens do usuário.
- **Proteção contra Força Bruta:** 5 tentativas incorretas consecutivas bloqueiam a conta temporariamente por 15 minutos (HTTP `423 Locked`).

---

## 4. Endpoints Desenvolvidos

### Módulo de Autenticação & Identidade (`/api/v1/auth`)
- `POST /register`: Cadastro de usuários com gravação de consentimento LGPD.
- `POST /login`: Autenticação e emissão de Access Token + Refresh Token.
- `POST /refresh`: Rotação segura de tokens JWT.
- `POST /logout`: Revogação do refresh token ativo.
- `GET /me`: Consulta dos dados do perfil autenticado.
- `POST /change-password`: Alteração de senha autenticada.
- `POST /consent`: Registro explícito de consentimentos de termos/políticas (LGPD Art. 8º).

### Módulo de Imóveis & Comodidades (`/api/v1/properties`)
- `GET /catalog/amenities`: Catálogo público/operacional de comodidades disponíveis.
- `POST /`: Cadastro de imóvel (restrito a Admin e Proprietário).
- `GET /`: Listagem com filtros (cidade, UF, tipo, status, capacidade mínima) com isolamento automático por proprietário.
- `GET /{property_id}`: Detalhes de um imóvel com validação de titularidade.
- `PUT /{property_id}`: Atualização de dados, comodidades e status operacional.
- `DELETE /{property_id}`: Soft delete do imóvel para resguardo contábil.

---

## 5. Como Executar e Testar

### Instalação de dependências
```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r backend/requirements.txt
```

### Executar a suíte de testes automatizados
```bash
$env:PYTHONPATH = "backend"
pytest backend/tests -v
```

### Criar o primeiro usuário Administrador (sem expor senhas no código)
```bash
python backend/app/cli.py create-user --name "Administrador Geral" --email "admin@locacao.com" --password "SenhaForte123!" --role "admin"
```

### Iniciar o servidor de desenvolvimento
```bash
uvicorn app.main:app --app-dir backend --reload --port 8000
```
- Documentação interativa Swagger: [http://localhost:8000/docs](http://localhost:8000/docs)
- Documentação ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)
