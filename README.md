# Sistema de Gestão Inteligente para Locação por Temporada

Plataforma web para pessoas físicas e pequenos empreendedores gerenciarem imóveis de locação por temporada com autonomia — reservas, tarefas operacionais, estoque, finanças e um assistente de IA que gera insights a partir dos dados da operação.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React · TypeScript · Vite · Tailwind CSS |
| Backend | Python · FastAPI · arquitetura DDD |
| Banco de dados | PostgreSQL 15+ |
| Autenticação | JWT (access token curto + refresh token rotativo) |

## Perfis de acesso

- **Administrador** — gestão da plataforma, usuários e visão macro de todos os imóveis.
- **Proprietário/Gestor** — imóveis, reservas, tarefas, finanças, estoque e assistente de IA.
- **Funcionário** — somente as tarefas atribuídas: execução, checklists e status.

## Roadmap

| Etapa | Entrega | Status |
|---|---|---|
| 1 | Modelagem de dados e script SQL | ✅ [docs](docs/etapa-1-modelagem-de-dados.md) |
| 2 | Backend FastAPI (DDD): Autenticação e Imóveis | ✅ [docs](docs/etapa-2-setup-backend.md) |
| 3 | Frontend React + Vite: autenticação JWT e layout base | ⏳ |
| 4 | Integração e Assistente de IA | ⏳ |

## Estrutura

```
.
├── backend/             # API Python + FastAPI estruturada em Domain-Driven Design (DDD)
│   ├── app/             # Core, Shared Kernel e Módulos (Identity, Properties)
│   └── tests/           # Suíte de testes unitários e de integração
├── database/
│   └── init/            # DDL e seed (executados automaticamente pelo docker compose)
├── docs/                # Documentação técnica por etapa
├── docker-compose.yml
└── .env.example
```

## Executando o banco localmente

```bash
cp .env.example .env     # ajuste POSTGRES_PASSWORD
docker compose up -d db
```

## Convenções

Commits seguem o padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/) (`feat`, `fix`, `docs`, `chore`, `refactor`, `test`…) com escopo por módulo, ex.: `feat(database): …`.
