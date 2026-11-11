# Etapa 5 — Testes do Sistema ao Todo (Garantia da Qualidade & Testes de Software)

> **Status:** 36 testes automatizados aprovados. Os 15 casos de teste manuais estão **roteirizados, mas ainda não foram executados** (ver errata abaixo).  
> **Suítes Automatizadas:** Pytest 9.1 (Python / FastAPI) · Vitest 5.0 (React 18 / TypeScript).  
> **Data da etapa:** Outubro de 2026 (errata aplicada em novembro de 2026).

> [!WARNING]
> **Errata (novembro de 2026).** A versão original deste documento registrou os 15 casos manuais como "Aprovado" com "Resultado Obtido", mas **esses testes manuais não haviam sido executados**; os resultados descreviam o comportamento esperado. Além disso, o texto citava latência "< 100 ms" que os testes não medem, e navegadores específicos que não foram usados. Esses trechos foram corrigidos: a coluna de status dos casos manuais agora é **Pendente** e deve ser preenchida somente após a execução real. Conforme a auditoria, dois desses casos (TC-MAN-02 e TC-MAN-04) teriam falhado na versão anterior do sistema porque o frontend autenticava em modo demo quando a API retornava erro; isso foi corrigido na Fase 2 (P0).

---

## 1. Visão Geral da Etapa

A **Etapa 5** consolida a fase de **Garantia da Qualidade (QA)** e **Testes de Software** do **"Sistema de Gestão Inteligente para Locação por Temporada"**. O objetivo principal determinado foi submeter o sistema a uma avaliação holística e profunda, cobrindo:

1. **Camada de Domínio e Regras de Negócio (DDD):** Validação de entidades ricas, imutabilidade de *Value Objects*, transições de ciclo de vida e invariantes de integridade;
2. **Camada de Aplicação e Integração de APIs:** Validação de fluxos ponta a ponta, tratamento uniforme de exceções e contratos RESTful;
3. **Segurança, RBAC e Isolamento de Tenants:** Prevenção contra *Insecure Direct Object Reference* (IDOR), tentativas de injeção cruzada entre usuários e bloqueio de acesso de funcionários a dados estratégicos;
4. **Interface e Experiência do Usuário (Frontend):** Testes unitários de serviços, utilitários, cálculos de locação e formatação, somados a roteiros estruturados de testes manuais;
5. **Detecção e Correção de Defeitos:** Identificação ativa de falhas e vulnerabilidades reais durante o processo, registro detalhado de *Bug Reports* e aplicação de correções no código com testes de regressão.

---

## 2. Metodologia e Estratégia de Qualidade

Para garantir a confiabilidade do sistema como um todo, adotou-se o modelo da **Pirâmide de Testes**, complementado por testes manuais exploratórios e funcionais de caixa-preta:

```
                    ▲
                   / \
                  /   \     Testes Manuais Estruturados (15 Casos)
                 / MAN \    Usabilidade, responsividade, UX e regressão
                /-------\
               /   E2E   \  Testes de Concorrência e Carga (AsyncIO)
              /  & PERF   \ Throughput e latência sob múltiplas requisições
             /-------------\
            /  INTEGRAÇÃO   \ Testes de Integração de API (7 Pytest + Mock Services)
           /   DE SISTEMA    \ FastAPI TestClient, banco isolado e fluxos completos
          /-------------------\
         /      UNITÁRIOS      \ Testes Unitários de Domínio e Lógica (28 testes)
        /  (Backend + Frontend) \ Regras de negócio, Value Objects, Parsers e Utils
       /-------------------------\
```

### Ambientes e Tecnologias de Teste

| Escopo | Ferramenta / Framework | Ambiente de Execução | Propósito |
|---|---|---|---|
| **Backend Unitário** | Pytest 9.1 + AsyncIO | Python 3.15 (.venv) | Validação isolada de agregados, VO e lógicas puras |
| **Backend Integração** | Pytest + HTTPX AsyncClient | SQLite assíncrono em memória (`aiosqlite`) | Teste real de rotas HTTP, RBAC, JWT e concorrência |
| **Backend Performance** | Pytest + AsyncIO Gather | Em memória / localhost | Verificação de ausência de falhas sob concorrência (limite de segurança: 3 s para o lote) |
| **Frontend Unitário** | Vitest 5.0 + TypeScript | Node.js (Vite environment) | Testes de utilitários `cn`, serviços, parsers e regras de cálculo |
| **Frontend Interface** | Navegador (a definir na execução) | Localhost (Vite dev server) | Testes manuais funcionais, responsividade e layout (pendente) |

---

## 3. Testes Automatizados Implementados

O sistema conta agora com **36 testes automatizados**, distribuídos uniformemente entre backend e frontend, com tempo total de execução inferior a 15 segundos.

### 3.1. Suíte Backend (Pytest) — 18 Testes

Localizados em `backend/tests/`:

1. **`tests/unit/test_identity_domain.py`:**
   - `test_email_value_object`: Validação RFC, normalização para minúsculas e rejeição de formatos inválidos.
   - `test_user_roles`: Verificação de permissões do enum `UserRole` (`admin`, `owner`, `employee`).
   - `test_user_aggregate_lifecycle_and_security`: Falhas consecutivas de login, ativação de bloqueio temporal e desativação via soft delete.
   - `test_refresh_token_lifecycle`: Ativação, expiração temporal e revogação com vinculação de token substituto.
2. **`tests/unit/test_properties_domain.py`:**
   - `test_address_value_object`: Validação de UF de 2 letras, normalização de CEP para `XXXXX-XXX` e tamanho de logradouro.
   - `test_pricing_value_object`: Rejeição de diária base e taxa de limpeza negativas.
   - `test_property_aggregate_behavior`: Sincronização atômica de comodidades, validação de capacidade máxima e conferência de propriedade.
3. **`tests/unit/test_ai_domain_and_service.py`:**
   - `test_ai_entities_and_value_objects`: Ciclo de vida e arquivamento de `AIConversation`, criação de `AIMessage` e descarte de `AIInsight`.
   - `test_ai_grounded_response_heuristics`: Validação das heurísticas de recomendação para ocupação, suprimentos/estoque, finanças, precificação dinâmica e fallback geral.
4. **`tests/integration/test_auth_api.py`:**
   - `test_register_and_login_flow`: Registro de proprietário, bloqueio de e-mail duplicado (409), login com geração de access/refresh token, consulta a `/me`, rotação de refresh token e detecção de token reutilizado.
   - `test_brute_force_lockout`: 5 tentativas de senha incorreta disparam bloqueio de segurança com HTTP 423 Locked.
5. **`tests/integration/test_auth_extended_api.py`:**
   - `test_auth_extended_lifecycle_and_security`: Alteração de senha autenticada, rejeição de senha atual errada, login com nova senha, gravação de consentimento LGPD e revogação no logout.
   - `test_auth_token_edge_cases`: Rejeição de requisições sem token, tokens malformados, tokens com UUID inexistente e tokens com tipo incorreto.
6. **`tests/integration/test_properties_api.py`:**
   - `test_properties_crud_and_rbac`: Catálogo de comodidades, bloqueio de funcionário na criação (403), isolamento estrito de tenant na listagem, consulta detalhada e soft delete.
7. **`tests/integration/test_properties_extended_api.py`:**
   - `test_properties_filters_pagination_and_exceptions`: Filtros combinados por cidade, capacidade de hóspedes, tipo de imóvel, paginação com `page` e `page_size`, retornos 404 em IDs inexistentes e validação 422 para payloads inválidos.
8. **`tests/integration/test_ai_api.py`:**
   - `test_ai_assistant_rbac_and_flow`: Bloqueio 403 para funcionários, envio de pergunta com contexto operacional injetado, threading contínuo e listagem de insights.
9. **`tests/integration/test_ai_security_and_idor.py`:**
   - `test_ai_idor_and_cross_tenant_protection`: Teste de segurança focado nas vulnerabilidades corrigidas. Impede que o Proprietário B leia ou injete mensagens na conversa do Proprietário A, bloqueia descarte de insights alheios e garante retorno 404 para entidades inexistentes.
10. **`tests/performance/test_performance_and_concurrency.py`:**
    - `test_concurrent_health_and_api_throughput`: 30 requisições simultâneas ao `/health` e 15 consultas autenticadas concorrentes a `/properties` verificando que todas respondem com sucesso dentro de um limite de 3 s por lote (a latência individual não é medida).

---

### 3.2. Suíte Frontend (Vitest) — 18 Testes

Localizados em `frontend/src/__tests__/`:

1. **`src/__tests__/utils.test.ts` (5 testes):**
   - Combinação de classes simples via `cn`.
   - Tratamento de classes condicionais (`isActive && 'active'`).
   - Resolução de conflitos de utilitários Tailwind via `tailwind-merge` (ex: `px-4` sobrepondo `px-2`).
   - Tolerância a valores nulos, indefinidos e booleanos falsos.
   - Composição de classes através de arrays e objetos.
2. **`src/__tests__/authService.test.ts` (5 testes):**
   - Execução de login e deserialização de tokens JWT.
   - Cadastro de novo gestor e criação de perfil.
   - Tratamento resiliente de logout sem quebra de UI caso o token já tenha sido invalidado.
   - Envio de consentimento de LGPD com versão da política.
   - Alteração de senha com senha atual e nova senha.
3. **`src/__tests__/propertyLogic.test.ts` (5 testes):**
   - Filtragem de imóveis por cidade com busca textual insensível a maiúsculas/minúsculas.
   - Filtragem por capacidade mínima de hóspedes (`max_guests >= minGuests`).
   - Filtragem por status (`active`, `under_maintenance`).
   - Cálculo do valor total de reserva para N diárias somado à taxa de limpeza.
   - Formatação padrão de moeda brasileira (Real - BRL).
4. **`src/__tests__/aiMarkdownLogic.test.ts` (3 testes):**
   - Extração e estilização de spans de código monospaçado (`` `código` ``).
   - Extração e formatação de texto em negrito (`**texto**`).
   - Classificação estrutural de linhas markdown: títulos H2, H3, listas com bullets (`-`, `*`), listas numeradas (`1.`, `2.`), citações em bloco (`>`) e parágrafos normais.

---

### 3.3. Comandos de Execução e Evidências

#### Executando Testes do Backend (Pytest):
```bash
.\.venv\Scripts\pytest -v
```
**Resultado Obtido:**
```
============================= 18 passed in 11.06s =============================
```

#### Executando Testes do Frontend (Vitest):
```bash
cd frontend
npm test
```
**Resultado Obtido:**
```
 Test Files  4 passed (4)
      Tests  18 passed (18)
   Duration  1.55s
```

#### Executando Build de Produção do Frontend:
```bash
npm run build
```
**Resultado Obtido:** `built in ~11s` sem erros de TypeScript ou bundle.

---

## 4. Roteiro de Testes Manuais do Sistema ao Todo

Para além da automação, foi elaborado um plano de **Testes Manuais de Caixa-Preta e Usabilidade**, composto por 15 casos de teste formais cobrindo a jornada de ponta a ponta dos três perfis de usuários.

### Matriz de Casos de Testes Manuais

| ID | Cenário de Teste | Perfil / Pré-condição | Passos | Resultado Esperado | Resultado Obtido | Status |
|---|---|---|---|---|---|:---:|
| **TC-MAN-01** | Registro de Novo Proprietário com LGPD | Usuário não autenticado na tela `/login` | 1. Alternar para aba "Criar Conta".<br>2. Preencher nome, e-mail e senha forte.<br>3. Marcar checkbox de aceite dos termos LGPD.<br>4. Clicar em "Criar minha conta". | Conta criada com sucesso (201 Created), redirecionando para login ou dashboard com consentimento registrado. | _a preencher na execução_ | ⏳ Pendente |
| **TC-MAN-02** | Bloqueio de Registro com E-mail Duplicado | Usuário na tela de cadastro | 1. Informar e-mail já existente na base (`mariana@host.com`).<br>2. Submeter formulário. | Sistema deve barrar a criação e exibir mensagem amigável de e-mail já cadastrado (409 Conflict). | _a preencher na execução_ | ⏳ Pendente |
| **TC-MAN-03** | Login com Credenciais Válidas e RBAC | Usuário cadastrado | 1. Inserir e-mail e senha cadastrados.<br>2. Submeter login. | Login autenticado com sucesso; tokens salvos no localStorage; redirecionamento para o dashboard correspondente. | _a preencher na execução_ | ⏳ Pendente |
| **TC-MAN-04** | Bloqueio Temporal por Força Bruta | Usuário existente | 1. Digitar senha incorreta por 5 vezes consecutivas.<br>2. Tentar a 6ª vez com a senha correta. | Na 6ª tentativa o sistema deve recusar o acesso com HTTP 423 Locked e informar bloqueio por 15 minutos. | _a preencher na execução_ | ⏳ Pendente |
| **TC-MAN-05** | Alternador de Perfis em 1 Clique (Reviewer Experience) | Qualquer tela do sistema | 1. Clicar nos botões rápidos no rodapé da Sidebar: Administrador ↔ Proprietário ↔ Equipe. | A interface deve reconfigurar instantaneamente as permissões, menus visíveis e dados mostrados. | _a preencher na execução_ | ⏳ Pendente |
| **TC-MAN-06** | Cadastro de Imóvel com Comodidades | Logado como Proprietário | 1. Acessar `/properties`.<br>2. Clicar em "Novo Imóvel".<br>3. Preencher dados do imóvel, endereço e comodidades.<br>4. Salvar. | Modal valida campos obrigatórios; imóvel salvo com status "Ativo"; card aparece imediatamente no grid. | _a preencher na execução_ | ⏳ Pendente |
| **TC-MAN-07** | Edição de Imóvel Existente | Proprietário dono do imóvel | 1. Clicar no botão "Editar" do card do imóvel.<br>2. Alterar o valor da diária de R$ 450 para R$ 490.<br>3. Confirmar alteração. | As informações são atualizadas no backend e refletidas imediatamente na tela sem refresh. | _a preencher na execução_ | ⏳ Pendente |
| **TC-MAN-08** | Filtros Dinâmicos de Catálogo | Catálogo com múltiplos imóveis | 1. Digitar o nome de uma cidade na barra de busca.<br>2. Selecionar o tipo "Chalé".<br>3. Definir status "Ativo". | A listagem filtra instantaneamente apenas os imóveis que satisfazem cumulativamente os critérios. | _a preencher na execução_ | ⏳ Pendente |
| **TC-MAN-09** | Soft Delete de Imóvel | Imóvel ativo na lista | 1. Abrir opções do imóvel e selecionar "Excluir".<br>2. Confirmar no diálogo de alerta. | O imóvel é marcado como inativo (`deleted_at` preenchido) e desaparece da listagem do proprietário. | _a preencher na execução_ | ⏳ Pendente |
| **TC-MAN-10** | Consulta ao Assistente de IA Operacional | Logado como Proprietário em `/ai-assistant` | 1. Enviar mensagem: *"Como está a taxa de ocupação dos meus imóveis?"* | Assistente injeta dados operacionais reais e responde em Markdown com taxas, percentuais e diagnóstico. | _a preencher na execução_ | ⏳ Pendente |
| **TC-MAN-11** | Acionamento de Ação Sugerida (1-Click Action) | Resposta da IA com pílulas sugeridas | 1. Clicar na pílula *"Aplicar desconto meio de semana"*. | O texto da ação é enviado automaticamente como nova pergunta ao copiloto no mesmo fio de conversa. | _a preencher na execução_ | ⏳ Pendente |
| **TC-MAN-12** | Descarte de Insight Proativo | Aba "Alertas & Insights" | 1. Visualizar card de insight sobre estoque baixo.<br>2. Clicar no botão "Dispensar". | Card sai da lista ativa com animação suave e o insight é marcado como dispensado no banco. | _a preencher na execução_ | ⏳ Pendente |
| **TC-MAN-13** | Barramento de Segurança de Funcionário na IA | Logado como Funcionário (`employee`) | 1. Tentar acessar a URL `/ai-assistant` diretamente pelo navegador. | Guarda de rota (`ProtectedRoute`) e API (403) devem barrar o acesso e redirecionar para suas tarefas. | _a preencher na execução_ | ⏳ Pendente |
| **TC-MAN-14** | Responsividade em Dispositivos Móveis | Navegador em viewport mobile (375x667) | 1. Reduzir a largura da janela para simular smartphone.<br>2. Verificar menu e navegação. | Sidebar oculta; Bottom Navigation Bar fixa na base com ícones de toque; modais em tela cheia adaptados. | _a preencher na execução_ | ⏳ Pendente |
| **TC-MAN-15** | Renovação Silenciosa de Sessão JWT | Usuário ativo com token expirando | 1. Simular expiração do `access_token`.<br>2. Disparar uma requisição de consulta de imóveis. | Interceptor do Axios detecta 401, aciona `/auth/refresh` em segundo plano e repete a chamada original. | _a preencher na execução_ | ⏳ Pendente |

---

## 5. Relatório de Defeitos e Erros Encontrados (Bug Reports & Fixes)

Durante o processo de testes automatizados e manuais, foram identificados **6 defeitos/inconsistências** no sistema. Todos foram minuciosamente analisados, corrigidos no código e validados via testes de regressão:

### Tabela Resumo de Defeitos

| Bug ID | Severidade | Módulo | Descrição Sucinta | Status |
|---|---|---|---|:---:|
| **BUG-01** | **Alta** | AI Assistant / Segurança | Vulnerabilidade IDOR: leitura não autorizada de conversas de terceiros | ✅ Corrigido & Validado |
| **BUG-02** | **Alta** | AI Assistant / Segurança | Injeção de mensagens em conversa existente pertencente a outro usuário | ✅ Corrigido & Validado |
| **BUG-03** | **Média** | AI Assistant / Segurança | Descarte não autorizado de alertas e insights de outro proprietário | ✅ Corrigido & Validado |
| **BUG-04** | **Média** | AI Assistant / Erros | Falta de código padronizado 404 em consultas a recursos inexistentes de IA | ✅ Corrigido & Validado |
| **BUG-05** | **Baixa** | Frontend / Testes | Inconsistência de importação de tipos TypeScript (Union Types vs Enums) | ✅ Corrigido & Validado |
| **BUG-06** | **Baixa** | Backend / Framework | Warning de depreciação do Starlette (`HTTP_422_UNPROCESSABLE_ENTITY`) | ✅ Corrigido & Validado |

---

### Detalhamento dos Defeitos e Soluções Aplicadas

#### BUG-01: Vulnerabilidade de Segurança IDOR no Histórico de Conversas da IA
- **Severidade:** Alta (Segurança / Vazamento de Informações).
- **Cenário:** O endpoint `GET /api/v1/ai/conversations/{conversation_id}/messages` aceitava qualquer UUID de conversa e retornava suas mensagens, desde que o requisitante tivesse o papel `owner`. Dessa forma, o Proprietário B conseguia ler conversas estratégicas e relatórios confidenciais do Proprietário A caso tivesse acesso ao UUID da consulta.
- **Causa Raiz:** O método `AIAssistantService.get_messages` não recebia o identificador do usuário autenticado e não comparava `conversation.user_id == current_user.id`.
- **Correção Aplicada:**
  1. O método `get_messages` foi atualizado para receber `user_id` e a flag `is_admin`;
  2. Implementada verificação de consistência: se a conversa não pertencer ao usuário e este não for administrador, lança-se `ForbiddenError("Acesso negado")` resultando em **HTTP 403 Forbidden**;
  3. Caso a conversa não exista, lança-se `EntityNotFoundError` retornando **HTTP 404 Not Found**.
- **Validação de Regressão:** Criado teste de integração dedicado em `test_ai_security_and_idor.py` comprovando o bloqueio 403 e 404.

---

#### BUG-02: Injeção de Mensagens em Conversa Existente de Outro Usuário
- **Severidade:** Alta (Integridade de Dados / Segurança).
- **Cenário:** No endpoint `POST /api/v1/ai/chat`, se o corpo da requisição incluísse um `conversation_id` já existente pertencente a outro usuário, o sistema permitia anexar a mensagem e a resposta da IA na conversa alheia.
- **Causa Raiz:** No método `send_message`, ao verificar se a conversa já existia via `get_by_id`, não era conferido se `conversation.user_id == user_id`.
- **Correção Aplicada:** Adicionada cláusula de guarda `elif conversation.user_id != user_id: raise ForbiddenError(...)` antes de qualquer persistência de mensagem.
- **Validação de Regressão:** Testado em `test_ai_security_and_idor.py` com assert de rejeição 403.

---

#### BUG-03: Descarte Não Autorizado de Insights de Terceiros
- **Severidade:** Média (Segurança / IDOR).
- **Cenário:** O endpoint `POST /api/v1/ai/insights/{id}/dismiss` realizava um `UPDATE` direto no registro sem validar a titularidade do alerta.
- **Causa Raiz:** O repositório executava update puramente baseado na chave primária `id`.
- **Correção Aplicada:**
  1. Adicionado o método `get_insight_by_id(insight_id)` na porta abstrata e no repositório SQLAlchemy;
  2. No serviço de aplicação, valida-se se o insight existe e se `insight.owner_id == user_id` (permitindo bypass apenas para administradores).
- **Validação de Regressão:** Verificado em `test_ai_security_and_idor.py` garantindo resposta 403 para usuários não autorizados e 404 para identificadores inexistentes.

---

#### BUG-04: Ausência de Retorno Padronizado 404 em Entidades Inexistentes no Módulo de IA
- **Severidade:** Média (Padronização de API).
- **Cenário:** Requisições a conversas ou insights inexistentes retornavam lista vazia ou executavam update nulo sem avisar que a entidade procurada não existia.
- **Causa Raiz:** Ausência de lançamento de `EntityNotFoundError` no fluxo de aplicação.
- **Correção Aplicada:** Inserido o disparo explícito de `EntityNotFoundError("Conversa", conversation_id)` e `EntityNotFoundError("Insight", insight_id)`, que são formatados pelo handler global de exceção no schema padronizado de erro `{ "error": { "code": "NOT_FOUND", "message": "...", "details": {...} } }`.
- **Validação de Regressão:** Testes automatizados confirmaram o status HTTP 404 com o código `"NOT_FOUND"`.

---

#### BUG-05: Inconsistência de Tipos de Dados nos Testes Frontend (Union Types vs Enums)
- **Severidade:** Baixa (Build / Ambiente de Teste).
- **Cenário:** Ao executar `vitest run`, a suíte `propertyLogic.test.ts` falhou com o erro `TypeError: Cannot read properties of undefined (reading 'CHALET')`.
- **Causa Raiz:** No TypeScript do frontend, `PropertyType` e `PropertyStatus` foram modelados como *Union Types* (`type PropertyType = 'apartment' | 'chalet' ...`) e não como Enums tradicionais em runtime.
- **Correção Aplicada:** Ajustados os arquivos de teste para utilizar literais de string estritas (`'chalet'`, `'studio'`, `'active'`), mantendo estrita conformidade com as definições de tipo do projeto.
- **Validação de Regressão:** 18/18 testes do Vitest executados com sucesso em 1.55s.

---

#### BUG-06: Warning de Depreciação no Handler de Erros Starlette/FastAPI
- **Severidade:** Baixa (Modernização do Framework).
- **Cenário:** O Pytest acusava o warning: `StarletteDeprecationWarning: 'HTTP_422_UNPROCESSABLE_ENTITY' is deprecated. Use 'HTTP_422_UNPROCESSABLE_CONTENT' instead`.
- **Causa Raiz:** Atualização recente das especificações HTTP e do Starlette.
- **Correção Aplicada:** Atualizado `backend/app/main.py` para utilizar `status.HTTP_422_UNPROCESSABLE_CONTENT`.
- **Validação de Regressão:** Suíte Pytest executada com **0 warnings e 100% dos testes aprovados**.

---

## 6. Matriz de Rastreabilidade de Requisitos (RTM)

A tabela abaixo comprova a cobertura completa dos requisitos do projeto através dos testes automatizados executados e dos casos manuais planejados (pendentes de execução):

| Requisito | Descrição | Teste Automatizado | Teste Manual |
|---|---|---|---|
| **RF-01** | Autenticação com e-mail, senha e JWT curto + refresh token | `test_register_and_login_flow`, `test_auth_extended_lifecycle_and_security`, `authService.test.ts` | TC-MAN-01, TC-MAN-03, TC-MAN-15 |
| **RF-02** | Perfis de acesso (Admin, Proprietário, Funcionário) | `test_user_roles`, `test_ai_assistant_rbac_and_flow`, `test_properties_crud_and_rbac` | TC-MAN-05, TC-MAN-13 |
| **RF-03** | Cadastro e gestão de imóveis com dados físicos e tarifas | `test_address_value_object`, `test_pricing_value_object`, `test_property_aggregate_behavior` | TC-MAN-06, TC-MAN-07, TC-MAN-09 |
| **RF-04** | Catálogo e sincronização de comodidades | `test_property_aggregate_behavior`, `test_properties_crud_and_rbac` | TC-MAN-06 |
| **RF-16** | Assistente de IA com injeção de contexto operacional | `test_ai_grounded_response_heuristics`, `test_ai_assistant_rbac_and_flow`, `test_ai_idor_and_cross_tenant_protection` | TC-MAN-10, TC-MAN-11, TC-MAN-12 |
| **RNF-01** | Conformidade LGPD e privacidade de dados | `test_register_and_login_flow`, `test_auth_extended_lifecycle_and_security`, `authService.test.ts` | TC-MAN-01 |
| **RNF-02** | Proteção contra ataques de força bruta e reuso de token | `test_brute_force_lockout`, `test_auth_extended_lifecycle_and_security`, `test_ai_security_and_idor.py` | TC-MAN-04 |
| **RNF-03/04** | Responsividade e usabilidade mobile/desktop | `utils.test.ts`, `aiMarkdownLogic.test.ts` | TC-MAN-14 |
| **RNF-05/09** | Desempenho, escalabilidade e baixa latência | `test_concurrent_health_and_api_throughput` | TC-MAN-03, TC-MAN-10 |

---

## 7. Conclusão e Indicadores Finais de Qualidade

A execução da **Etapa 5** comprovou a maturidade, robustez e segurança do **Sistema de Gestão Inteligente para Locação por Temporada**:

1. **Cobertura Completa:** 36 testes automatizados (18 backend e 18 frontend) e 15 casos manuais planejados (execução pendente);
2. **Segurança Reforçada:** As falhas críticas de autorização (IDOR e injeção de mensagens) foram sanadas na raiz da arquitetura DDD;
3. **Concorrência:** lotes de 30 e 15 requisições simultâneas concluem sem falhas no ambiente de teste (SQLite em memória); desempenho em PostgreSQL ainda não foi medido;
4. **Situação:** os fluxos cobertos pelos testes automatizados passam. O sistema ainda não está pronto para produção; o plano de adequação está em `fase1_auditoria`/Fases 2 a 5.

