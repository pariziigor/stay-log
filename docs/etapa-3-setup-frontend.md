# Etapa 3 — Setup Frontend (React, TypeScript, Vite e Tailwind CSS)

> **Status:** Concluído com compilação e empacotamento de produção 100% verificados (`vite build` aprovado).
> **Tecnologias:** React 18 · TypeScript 5.7 · Vite 6 · Tailwind CSS 3.4 · Framer Motion 11 · Lucide Icons.

---

## 1. Arquitetura de Componentes e Estrutura de Pastas

A aplicação frontend foi estruturada com separação limpa de responsabilidades, tipagem estrita com TypeScript e modularização por contextos e funcionalidades:

```
frontend/
├── index.html                           # Entrypoint HTML com fontes Inter e Plus Jakarta Sans
├── package.json                         # Dependências de UI, animação e roteamento
├── vite.config.ts                       # Configuração do Vite, alias '@' e proxy reverso para backend
├── tailwind.config.js                   # Paleta 'brand', animações customizadas e efeitos de brilho
├── postcss.config.js
├── tsconfig.json
└── src/
    ├── main.tsx                         # Entrypoint React 18 com StrictMode
    ├── App.tsx                          # Rotas protegidas (React Router 6) e AuthProvider
    ├── index.css                        # Diretivas do Tailwind, scrollbars modernas e utilitários glass
    ├── vite-env.d.ts                    # Tipos de ambiente do Vite
    │
    ├── types/                           # Contratos TypeScript de domínio
    │   ├── auth.ts                      # User, UserRole ('admin' | 'owner' | 'employee'), AuthTokens
    │   └── property.ts                  # Property, Amenity, PropertyType, PropertyStatus, Address
    │
    ├── utils/
    │   └── cn.ts                        # Utilitário clsx + tailwind-merge para composição de classes
    │
    ├── services/                        # Camada de Integração HTTP
    │   ├── api.ts                       # Instância Axios com injeção Bearer e rotação automática de JWT
    │   ├── authService.ts               # Chamadas à API de login, registro, logout e LGPD
    │   └── propertyService.ts           # CRUD de imóveis, filtros e catálogo de comodidades
    │
    ├── context/
    │   └── AuthContext.tsx              # Contexto de autenticação, persistência e alternador de perfil
    │
    ├── components/
    │   ├── common/                      # Componentes base reutilizáveis com micro-interações
    │   │   ├── Button.tsx               # Botão animado (Framer Motion) com variantes e spinner
    │   │   ├── Input.tsx                # Input com label, ícones de apoio e validação de erro
    │   │   ├── Badge.tsx                # Pílula de status com indicador pulsante de live status
    │   │   ├── Card.tsx                 # Card com efeito de elevação no hover e glassmorphism
    │   │   └── Modal.tsx                # Diálogo modal animado com backdrop blur e tecla ESC
    │   │
    │   ├── layout/                      # Estrutura e navegação responsiva
    │   │   ├── MainLayout.tsx           # Shell com Sidebar, Header, MobileNav e transições
    │   │   ├── Sidebar.tsx              # Menu lateral inteligente adaptado ao papel do usuário
    │   │   ├── Header.tsx               # Barra superior com título, badge do perfil e notificações
    │   │   ├── MobileNav.tsx            # Barra de navegação inferior exclusiva para smartphones
    │   │   └── ProtectedRoute.tsx       # Guarda de rota com checagem de autenticação e RBAC
    │   │
    │   ├── dashboard/                   # Painéis adaptativos por perfil de usuário
    │   │   ├── AdminDashboard.tsx       # Métricas globais da rede, conformidade LGPD e auditoria
    │   │   ├── OwnerDashboard.tsx       # Ocupação, receita prevista, movimentação e insights da IA
    │   │   └── EmployeeDashboard.tsx    # Visão focada em execução: tarefas do dia e checklists
    │   │
    │   └── properties/                  # Módulo de Imóveis
    │       ├── PropertyCard.tsx         # Card moderno com fotos, comodidades, diárias e ações
    │       ├── PropertyFilters.tsx      # Barra de pesquisa com filtros por cidade, tipo e status
    │       ├── PropertyModal.tsx        # Modal de cadastro/edição com seleção de comodidades
    │       └── PropertyDetailModal.tsx  # Modal de detalhes com especificações completas
    │
    └── pages/
        ├── LoginPage.tsx                # Tela de Login/Cadastro em split-screen com atalhos de teste
        ├── DashboardPage.tsx            # Roteador interno que exibe o dashboard do papel ativo
        ├── PropertiesPage.tsx           # Gestão completa de catálogo com grid e filtros
        ├── TasksPage.tsx                # Visão de operações e checklists de campo
        └── NotFoundPage.tsx             # Página 404 personalizada
```

---

## 2. Destaques de Design Moderno e Responsividade

Para atender plenamente ao pedido de interface moderna com animações, efeitos e responsividade total:
1. **Micro-interações e Efeitos de Transição (Framer Motion):**
   - Transições de rota suaves (`opacity` e `translateY`) encapsuladas em `<AnimatePresence>`.
   - Modais com efeito elástico e backdrop blur translúcido (`backdrop-blur-md`).
   - Cards com efeito *hover lift* (`y: -3px`) e sombras de brilho suaves (*glow shadow*).
2. **Design System & Estética Visual:**
   - Paleta de cores exclusiva com gradientes dinâmicos (índigo/violeta para tecnologia, esmeralda para ocupação positiva, âmbar para atenção).
   - Glassmorphism em barras de navegação e cabeçalhos com suporte nativo a modo claro e alto contraste.
   - Tipografia refinada utilizando as famílias **Plus Jakarta Sans** e **Inter**.
3. **Totalmente Responsivo em 3 Breakpoints (RNF-03, RNF-04, RNF-08):**
   - **Desktop (≥ 1024px):** Sidebar lateral fixa com navegação rica e alternador de perfil.
   - **Tablet (768px - 1023px):** Grid de imóveis adaptada para 2 colunas e filtros compactos.
   - **Smartphone (< 768px):** Menu hambúrguer deslizante + **Bottom Navigation Bar** fixa na base da tela, proporcionando experiência idêntica à de um aplicativo nativo.

---

## 3. Fluxo de Autenticação JWT e RBAC

- **Armazenamento Seguro:** O `access_token` e o `refresh_token` são gerenciados via `AuthContext` e sincronizados no `localStorage`.
- **Interceptors no Axios (`api.ts`):**
  - **Injeção de Token:** Toda requisição anexa automaticamente o cabeçalho `Authorization: Bearer <access_token>`.
  - **Renovação Silenciosa:** Se a API responder com `401 Unauthorized`, o interceptor pausa as requisições pendentes em uma fila (`failedQueue`), envia o `refresh_token` para o backend (`POST /api/v1/auth/refresh`), atualiza os tokens e reexecuta a requisição original de forma transparente para o usuário.
  - **Detecção de Reuso:** Se o refresh token falhar, os dados locais são purgados e o evento customizado `auth:logout` redireciona o usuário para `/login`.
- **Alternador de Perfil em 1 Clique (Reviewer Experience):**
  - Tanto na tela de Login quanto no rodapé da Sidebar, existem atalhos rápidos para alternar entre **👑 Administrador**, **🏠 Proprietário/Gestor** e **🧹 Operacional / Equipe**, permitindo verificar instantaneamente como a interface se adapta para cada perfil.

---

## 4. Como Executar o Frontend

```bash
cd frontend
npm install
npm run dev
```

A aplicação estará disponível em [http://localhost:5173](http://localhost:5173).

- Para validar a compilação e integridade de tipos TypeScript:
```bash
npm run build
```
*(Saída esperada: `built in ~4s` com zero erros de compilação).*
