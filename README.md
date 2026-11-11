# Sistema de Gestão Inteligente para Locação por Temporada (HospedaAI)

Plataforma web full-stack para pessoas físicas e gestores de temporada gerenciarem imóveis, calendário de reservas, tarefas operacionais com checklists obrigatórios, controle de estoque, fluxo de caixa e um copiloto operacional de IA fundamentado em dados reais.

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| **Frontend** | React 18 · TypeScript · Vite · Tailwind CSS · Framer Motion · React Router v6 (Code Splitting) |
| **Backend** | Python · FastAPI · SQLAlchemy 2.0 Async · Pydantic v2 · Arquitetura DDD |
| **Banco de Dados** | PostgreSQL 15+ (Produção) / SQLite Async via `aiosqlite` (Desenvolvimento Local & Testes) |
| **Segurança & Auth** | JWT (`HS256`) + Refresh Token Rotativo com Detecção de Reuso · Hash `bcrypt` · RBAC · Headers OWASP · LGPD |

## Perfis de Acesso (RBAC)

- **Administrador (`admin`)** — governança global da plataforma, gestão de usuários, auditoria de imóveis e indicadores macro. Criado exclusivamente via CLI administrativa.
- **Proprietário / Gestor (`owner`)** — gestão de imóveis próprios, reservas, tarefas, equipe, estoque, financeiro e assistente de IA com isolamento estrito multi-tenant.
- **Funcionário (`employee`)** — acesso restrito às tarefas atribuídas e imóveis dos proprietários aos quais está vinculado (`team_members`), execução de checklists e registro de movimentação de suprimentos.

## Módulos da API (`/api/v1`)

Documentação interativa OpenAPI/Swagger disponível em `http://localhost:8000/docs` (e ReDoc em `http://localhost:8000/redoc`):

- **Autenticação & LGPD (`/api/v1/auth`)**: Registro público (`owner`), login com bloqueio contra força bruta (`423 Locked`), refresh rotativo, logout, perfil (`/me`), troca de senha e registro de consentimentos LGPD.
- **Usuários & Equipe (`/api/v1/users`)**: Listagem de usuários (`admin`), gestão de equipe operacional (`/team`) e ativação/desativação de acesso.
- **Imóveis (`/api/v1/properties`)**: CRUD completo de propriedades, filtros avançados, soft delete e catálogo de comodidades (`/catalog/amenities`).
- **Tarefas & Checklists (`/api/v1/tasks`)**: Criação de tarefas por imóvel/responsável, marcação de itens de checklist e trava de domínio que impede a conclusão com itens obrigatórios pendentes (**RF-11**).
- **Reservas & Hóspedes (`/api/v1/bookings`)**: Registro de estadias com validação de capacidade máxima, bloqueio de conflito de datas (`409 Conflict`) e anonimização de hóspedes conforme art. 18 da LGPD (`/guests/{id}/anonymize`).
- **Suprimentos & Estoque (`/api/v1/inventory`)**: Cadastro de itens por imóvel, alertas de estoque crítico e livro-razão de movimentações (`in`, `out`, `adjustment`) com bloqueio de saldo negativo (**RF-12**).
- **Financeiro (`/api/v1/finance`)**: Categorias de receitas/despesas, lançamentos validados por tipo de categoria (**RF-13**) e resumo consolidado de fluxo de caixa e margem líquida (`/summary`).
- **Dashboard & Copiloto IA (`/api/v1/dashboard/summary`, `/api/v1/ai`)**: Indicadores reais por perfil e assistente conversacional/insights fundamentados nos dados reais do banco (sem PII de hóspedes).

## Executando Localmente (Desenvolvimento)

### 1. Backend (FastAPI)

```bash
cd backend
python -m venv ../.venv
# Windows PowerShell:
..\.venv\Scripts\pip install -r requirements.txt
..\.venv\Scripts\python -m app.cli init-db
..\.venv\Scripts\python -m app.cli create-user --name "Admin" --email "admin@locacao.com" --password "AdminPassword123!" --role admin
..\.venv\Scripts\uvicorn app.main:app --reload --port 8000
```

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

### 3. Produção com Docker Compose

```bash
cp .env.example .env
# Defina POSTGRES_PASSWORD e SECRET_KEY (mínimo 32 caracteres) no arquivo .env
docker compose up -d --build
```

## Executando os Testes Automatizados

```bash
# Backend (31 testes: unitários, integração, RBAC/IDOR, regras de negócio e concorrência)
cd backend
..\.venv\Scripts\pytest -v

# Frontend (23 testes Vitest + verificação de tipos TypeScript e build de produção)
cd frontend
npm test
npm run build
```

## Roadmap & Documentação por Etapa

| Etapa | Entrega | Status |
|---|---|---|
| 1 | Modelagem de dados e script SQL | ✅ [docs/etapa-1-modelagem-de-dados.md](docs/etapa-1-modelagem-de-dados.md) |
| 2 | Backend FastAPI (DDD): Autenticação, Imóveis e Módulos Operacionais | ✅ [docs/etapa-2-setup-backend.md](docs/etapa-2-setup-backend.md) |
| 3 | Frontend React + Vite: Telas Reais, RBAC e Integração | ✅ [docs/etapa-3-setup-frontend.md](docs/etapa-3-setup-frontend.md) |
| 4 | Integração e Assistente de IA Fundamentado em Dados Reais | ✅ [docs/etapa-4-integracao-e-ia.md](docs/etapa-4-integracao-e-ia.md) |
| 5 | Testes do Sistema (Automatizados e Manuais) | ✅ [docs/etapa-5-testes-do-sistema.md](docs/etapa-5-testes-do-sistema.md) |
