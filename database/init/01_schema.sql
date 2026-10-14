-- =============================================================================
--  Sistema de Gestão Inteligente para Locação por Temporada
--  Etapa 1 — Modelo Relacional (PostgreSQL 15+)
-- -----------------------------------------------------------------------------
--  Convenções
--    * Identificadores em inglês (snake_case); comentários em português.
--    * PK UUID (gen_random_uuid) nas entidades de domínio — evita enumeração
--      de IDs em URLs (segurança) e facilita geração distribuída.
--    * BIGINT IDENTITY em tabelas de alto volume e append-only (logs).
--    * Prefixos: pk_, fk_, uq_, ck_, ix_, ex_, trg_, fn_, vw_.
--    * Valores monetários: NUMERIC(12,2). Datas/horas: TIMESTAMPTZ.
--    * Soft delete (deleted_at) em users e properties; demais entidades
--      históricas usam ON DELETE RESTRICT para preservar a rastreabilidade.
--    * O usuário autenticado é propagado pela aplicação via
--        SET LOCAL app.current_user_id = '<uuid>';
--      permitindo auditoria automática por triggers.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;      -- e-mails case-insensitive
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- EXCLUDE constraint (reservas sobrepostas)

-- =============================================================================
-- 1. TIPOS ENUMERADOS
-- =============================================================================
CREATE TYPE user_role            AS ENUM ('admin', 'owner', 'employee');
CREATE TYPE consent_type         AS ENUM ('terms_of_use', 'privacy_policy', 'marketing', 'ai_data_processing');
CREATE TYPE property_type        AS ENUM ('apartment', 'house', 'studio', 'room', 'chalet', 'farm', 'other');
CREATE TYPE property_status      AS ENUM ('active', 'inactive', 'under_maintenance');
CREATE TYPE reservation_status   AS ENUM ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show');
CREATE TYPE reservation_source   AS ENUM ('direct', 'airbnb', 'booking', 'vrbo', 'other');
CREATE TYPE task_type            AS ENUM ('cleaning', 'maintenance', 'inspection', 'check_in', 'check_out', 'restock', 'other');
CREATE TYPE task_priority        AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_status          AS ENUM ('pending', 'in_progress', 'blocked', 'completed', 'cancelled');
CREATE TYPE maintenance_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE maintenance_status   AS ENUM ('open', 'scheduled', 'in_progress', 'resolved', 'cancelled');
CREATE TYPE stock_movement_type  AS ENUM ('in', 'out', 'adjustment');
CREATE TYPE transaction_type     AS ENUM ('income', 'expense');
CREATE TYPE payment_status       AS ENUM ('pending', 'paid', 'overdue', 'cancelled');
CREATE TYPE payment_method       AS ENUM ('pix', 'credit_card', 'debit_card', 'bank_transfer', 'cash', 'platform_payout', 'other');
CREATE TYPE ai_message_role      AS ENUM ('system', 'user', 'assistant', 'tool');
CREATE TYPE insight_severity     AS ENUM ('info', 'warning', 'critical');

-- =============================================================================
-- 2. FUNÇÕES UTILITÁRIAS
-- =============================================================================

-- Atualiza automaticamente a coluna updated_at.
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$;

-- Usuário autenticado da transação corrente (definido pela aplicação).
CREATE OR REPLACE FUNCTION fn_current_app_user()
RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
$$;

-- Garante que a coluna (TG_ARGV[0]) referencia um usuário com um dos perfis
-- permitidos (TG_ARGV[1..n]). Ex.: properties.owner_id deve ser 'owner'.
CREATE OR REPLACE FUNCTION fn_assert_user_role()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_user_id uuid;
    v_role    user_role;
    v_allowed text[] := TG_ARGV[1:TG_NARGS - 1];
BEGIN
    v_user_id := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
    IF v_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT role INTO v_role FROM users WHERE id = v_user_id;

    IF v_role IS NULL OR NOT (v_role::text = ANY (v_allowed)) THEN
        RAISE EXCEPTION 'Usuário % (perfil %) não pode ser atribuído a %.% (perfis permitidos: %)',
            v_user_id, COALESCE(v_role::text, 'inexistente'), TG_TABLE_NAME, TG_ARGV[0],
            array_to_string(v_allowed, ', ')
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;

-- Bloqueia alterações em tabelas append-only (trilhas de auditoria).
CREATE OR REPLACE FUNCTION fn_prevent_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Registros de "%" são imutáveis (operação % não permitida)', TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'insufficient_privilege';
END $$;

-- =============================================================================
-- 3. IDENTIDADE, ACESSO E LGPD  (RF-01, RF-02, RNF-01, RNF-02)
-- =============================================================================

CREATE TABLE users (
    id                    uuid         NOT NULL DEFAULT gen_random_uuid(),
    full_name             varchar(150) NOT NULL,
    email                 citext       NOT NULL,
    password_hash         varchar(255) NOT NULL,          -- Argon2id/bcrypt; nunca a senha
    role                  user_role    NOT NULL,
    phone                 varchar(20),
    is_active             boolean      NOT NULL DEFAULT TRUE,
    failed_login_attempts smallint     NOT NULL DEFAULT 0, -- proteção contra força bruta
    locked_until          timestamptz,
    last_login_at         timestamptz,
    created_at            timestamptz  NOT NULL DEFAULT now(),
    updated_at            timestamptz  NOT NULL DEFAULT now(),
    deleted_at            timestamptz,
    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT ck_users_email_format    CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    CONSTRAINT ck_users_failed_attempts CHECK (failed_login_attempts >= 0)
);
CREATE UNIQUE INDEX uq_users_email_active ON users (email) WHERE deleted_at IS NULL;
CREATE INDEX ix_users_role ON users (role) WHERE deleted_at IS NULL;
COMMENT ON TABLE users IS 'Usuários da plataforma: administrador, proprietário/gestor e funcionário.';

-- Vínculo proprietário ↔ funcionário (um diarista pode atender vários proprietários).
CREATE TABLE team_members (
    owner_id    uuid        NOT NULL,
    employee_id uuid        NOT NULL,
    job_title   varchar(80),
    is_active   boolean     NOT NULL DEFAULT TRUE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_team_members PRIMARY KEY (owner_id, employee_id),
    CONSTRAINT fk_team_members_owner    FOREIGN KEY (owner_id)    REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_team_members_employee FOREIGN KEY (employee_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT ck_team_members_distinct CHECK (owner_id <> employee_id)
);
CREATE INDEX ix_team_members_employee ON team_members (employee_id);

-- Refresh tokens com rotação (JWT de acesso é stateless e de curta duração).
CREATE TABLE refresh_tokens (
    id          uuid         NOT NULL DEFAULT gen_random_uuid(),
    user_id     uuid         NOT NULL,
    token_hash  char(64)     NOT NULL,   -- SHA-256 do token; o valor bruto nunca é persistido
    family_id   uuid         NOT NULL,   -- detecção de reuso: revoga toda a família
    expires_at  timestamptz  NOT NULL,
    revoked_at  timestamptz,
    replaced_by uuid,
    user_agent  varchar(255),
    ip_address  inet,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT pk_refresh_tokens PRIMARY KEY (id),
    CONSTRAINT uq_refresh_tokens_hash UNIQUE (token_hash),
    CONSTRAINT fk_refresh_tokens_user     FOREIGN KEY (user_id)     REFERENCES users (id)          ON DELETE CASCADE,
    CONSTRAINT fk_refresh_tokens_replaced FOREIGN KEY (replaced_by) REFERENCES refresh_tokens (id) ON DELETE SET NULL,
    CONSTRAINT ck_refresh_tokens_expiry   CHECK (expires_at > created_at)
);
CREATE INDEX ix_refresh_tokens_user_active ON refresh_tokens (user_id) WHERE revoked_at IS NULL;
CREATE INDEX ix_refresh_tokens_family      ON refresh_tokens (family_id);

-- Registro de consentimentos (LGPD art. 8º — prova do consentimento).
CREATE TABLE user_consents (
    id             uuid         NOT NULL DEFAULT gen_random_uuid(),
    user_id        uuid         NOT NULL,
    consent_type   consent_type NOT NULL,
    policy_version varchar(20)  NOT NULL,
    granted_at     timestamptz  NOT NULL DEFAULT now(),
    revoked_at     timestamptz,
    ip_address     inet,
    CONSTRAINT pk_user_consents PRIMARY KEY (id),
    CONSTRAINT fk_user_consents_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT ck_user_consents_dates CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);
CREATE UNIQUE INDEX uq_user_consents_active ON user_consents (user_id, consent_type) WHERE revoked_at IS NULL;

-- =============================================================================
-- 4. IMÓVEIS  (RF-03, RF-04)
-- =============================================================================

CREATE TABLE properties (
    id                   uuid            NOT NULL DEFAULT gen_random_uuid(),
    owner_id             uuid            NOT NULL,
    name                 varchar(120)    NOT NULL,
    description          text,
    property_type        property_type   NOT NULL DEFAULT 'apartment',
    status               property_status NOT NULL DEFAULT 'active',
    -- Endereço
    address_street       varchar(150)    NOT NULL,
    address_number       varchar(20),
    address_complement   varchar(80),
    address_neighborhood varchar(80),
    address_city         varchar(80)     NOT NULL,
    address_state        char(2)         NOT NULL,
    address_postal_code  varchar(9),
    address_country      char(2)         NOT NULL DEFAULT 'BR',
    -- Capacidade e características
    max_guests           smallint        NOT NULL,
    bedrooms             smallint        NOT NULL DEFAULT 0,
    bathrooms            smallint        NOT NULL DEFAULT 1,
    beds                 smallint        NOT NULL DEFAULT 1,
    area_m2              numeric(8,2),
    -- Parâmetros operacionais
    base_nightly_rate    numeric(12,2),
    cleaning_fee         numeric(12,2)   NOT NULL DEFAULT 0,
    check_in_time        time            NOT NULL DEFAULT '15:00',
    check_out_time       time            NOT NULL DEFAULT '11:00',
    created_at           timestamptz     NOT NULL DEFAULT now(),
    updated_at           timestamptz     NOT NULL DEFAULT now(),
    deleted_at           timestamptz,
    CONSTRAINT pk_properties PRIMARY KEY (id),
    CONSTRAINT fk_properties_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT ck_properties_max_guests CHECK (max_guests BETWEEN 1 AND 100),
    CONSTRAINT ck_properties_rooms      CHECK (bedrooms >= 0 AND bathrooms >= 0 AND beds >= 0),
    CONSTRAINT ck_properties_area       CHECK (area_m2 IS NULL OR area_m2 > 0),
    CONSTRAINT ck_properties_rates      CHECK ((base_nightly_rate IS NULL OR base_nightly_rate >= 0) AND cleaning_fee >= 0),
    CONSTRAINT ck_properties_state      CHECK (address_state ~ '^[A-Z]{2}$'),
    CONSTRAINT ck_properties_postal     CHECK (address_postal_code IS NULL OR address_postal_code ~ '^\d{5}-?\d{3}$')
);
CREATE INDEX ix_properties_owner ON properties (owner_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_properties_city  ON properties (address_city, address_state);
CREATE UNIQUE INDEX uq_properties_owner_name ON properties (owner_id, lower(name)) WHERE deleted_at IS NULL;
COMMENT ON TABLE properties IS 'Imóveis de locação por temporada (agregado raiz do contexto Imóveis).';

-- Catálogo de comodidades/características (Wi-Fi, piscina, ar-condicionado...).
CREATE TABLE amenities (
    id       integer     GENERATED ALWAYS AS IDENTITY,
    code     varchar(50) NOT NULL,
    name     varchar(80) NOT NULL,
    category varchar(40) NOT NULL,
    CONSTRAINT pk_amenities PRIMARY KEY (id),
    CONSTRAINT uq_amenities_code UNIQUE (code)
);

CREATE TABLE property_amenities (
    property_id uuid    NOT NULL,
    amenity_id  integer NOT NULL,
    notes       varchar(150),
    CONSTRAINT pk_property_amenities PRIMARY KEY (property_id, amenity_id),
    CONSTRAINT fk_property_amenities_property FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE,
    CONSTRAINT fk_property_amenities_amenity  FOREIGN KEY (amenity_id)  REFERENCES amenities (id)  ON DELETE RESTRICT
);
CREATE INDEX ix_property_amenities_amenity ON property_amenities (amenity_id);

-- =============================================================================
-- 5. HÓSPEDES, RESERVAS E CALENDÁRIO  (RF-05, RF-06, RF-07)
-- =============================================================================

-- Dados pessoais isolados em uma única tabela → facilita anonimização (LGPD art. 18).
CREATE TABLE guests (
    id                 uuid         NOT NULL DEFAULT gen_random_uuid(),
    owner_id           uuid         NOT NULL,
    full_name          varchar(150) NOT NULL,
    email              citext,
    phone              varchar(20),
    document_encrypted bytea,        -- CPF/passaporte cifrado na aplicação (AES-256-GCM)
    document_hash      char(64),     -- HMAC-SHA256 para busca/deduplicação sem expor o dado
    nationality        char(2),
    notes              text,
    anonymized_at      timestamptz,
    created_at         timestamptz  NOT NULL DEFAULT now(),
    updated_at         timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT pk_guests PRIMARY KEY (id),
    CONSTRAINT fk_guests_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE RESTRICT
);
CREATE INDEX ix_guests_owner_name ON guests (owner_id, lower(full_name));
CREATE UNIQUE INDEX uq_guests_owner_document ON guests (owner_id, document_hash) WHERE document_hash IS NOT NULL;
COMMENT ON COLUMN guests.document_encrypted IS 'Dado pessoal sensível cifrado na camada de aplicação; a chave NÃO fica no banco.';

CREATE TABLE reservations (
    id                  uuid               NOT NULL DEFAULT gen_random_uuid(),
    property_id         uuid               NOT NULL,
    guest_id            uuid               NOT NULL,
    source              reservation_source NOT NULL DEFAULT 'direct',
    external_reference  varchar(80),        -- código da reserva na plataforma de origem (opcional)
    status              reservation_status NOT NULL DEFAULT 'confirmed',
    check_in_date       date               NOT NULL,
    check_out_date      date               NOT NULL,
    nights              integer            GENERATED ALWAYS AS (check_out_date - check_in_date) STORED,
    guests_count        smallint           NOT NULL,
    total_amount        numeric(12,2)      NOT NULL DEFAULT 0,
    platform_fee        numeric(12,2)      NOT NULL DEFAULT 0,
    notes               text,
    cancelled_at        timestamptz,
    cancellation_reason varchar(255),
    created_by          uuid,
    created_at          timestamptz        NOT NULL DEFAULT now(),
    updated_at          timestamptz        NOT NULL DEFAULT now(),
    CONSTRAINT pk_reservations PRIMARY KEY (id),
    CONSTRAINT fk_reservations_property   FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE RESTRICT,
    CONSTRAINT fk_reservations_guest      FOREIGN KEY (guest_id)    REFERENCES guests (id)     ON DELETE RESTRICT,
    CONSTRAINT fk_reservations_created_by FOREIGN KEY (created_by)  REFERENCES users (id)      ON DELETE SET NULL,
    CONSTRAINT ck_reservations_dates   CHECK (check_out_date > check_in_date),
    CONSTRAINT ck_reservations_guests  CHECK (guests_count >= 1),
    CONSTRAINT ck_reservations_amounts CHECK (total_amount >= 0 AND platform_fee >= 0 AND platform_fee <= total_amount),
    CONSTRAINT ck_reservations_cancel  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL)),
    -- Regra de negócio crítica garantida pelo banco: um imóvel não pode ter
    -- duas reservas ativas no mesmo período (intervalo semiaberto [entrada, saída)).
    CONSTRAINT ex_reservations_no_overlap EXCLUDE USING gist (
        property_id WITH =,
        daterange(check_in_date, check_out_date, '[)') WITH &&
    ) WHERE (status NOT IN ('cancelled', 'no_show'))
);
CREATE INDEX ix_reservations_property_checkin ON reservations (property_id, check_in_date);
CREATE INDEX ix_reservations_guest            ON reservations (guest_id);
CREATE INDEX ix_reservations_checkin          ON reservations (check_in_date) WHERE status IN ('pending', 'confirmed');
CREATE INDEX ix_reservations_checkout         ON reservations (check_out_date) WHERE status IN ('confirmed', 'checked_in');
CREATE UNIQUE INDEX uq_reservations_external  ON reservations (property_id, source, external_reference) WHERE external_reference IS NOT NULL;

-- Bloqueios de calendário (uso pessoal, obras, manutenção prolongada...).
CREATE TABLE property_blocks (
    id          uuid         NOT NULL DEFAULT gen_random_uuid(),
    property_id uuid         NOT NULL,
    start_date  date         NOT NULL,
    end_date    date         NOT NULL,
    reason      varchar(150) NOT NULL,
    created_by  uuid,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT pk_property_blocks PRIMARY KEY (id),
    CONSTRAINT fk_property_blocks_property   FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE,
    CONSTRAINT fk_property_blocks_created_by FOREIGN KEY (created_by)  REFERENCES users (id)      ON DELETE SET NULL,
    CONSTRAINT ck_property_blocks_dates CHECK (end_date > start_date)
);
CREATE INDEX ix_property_blocks_range ON property_blocks USING gist (property_id, daterange(start_date, end_date, '[)'));

-- =============================================================================
-- 6. TAREFAS E OPERAÇÕES  (RF-08, RF-09, RF-10, RF-11, RF-17)
-- =============================================================================

CREATE TABLE tasks (
    id                uuid          NOT NULL DEFAULT gen_random_uuid(),
    property_id       uuid          NOT NULL,
    reservation_id    uuid,          -- ex.: limpeza vinculada ao checkout de uma reserva
    task_type         task_type     NOT NULL,
    title             varchar(150)  NOT NULL,
    description       text,
    priority          task_priority NOT NULL DEFAULT 'medium',
    status            task_status   NOT NULL DEFAULT 'pending',
    due_at            timestamptz   NOT NULL,
    estimated_minutes smallint,
    assigned_to       uuid,
    created_by        uuid,
    started_at        timestamptz,
    completed_at      timestamptz,
    completion_notes  text,
    created_at        timestamptz   NOT NULL DEFAULT now(),
    updated_at        timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT pk_tasks PRIMARY KEY (id),
    CONSTRAINT fk_tasks_property    FOREIGN KEY (property_id)    REFERENCES properties (id)   ON DELETE RESTRICT,
    CONSTRAINT fk_tasks_reservation FOREIGN KEY (reservation_id) REFERENCES reservations (id) ON DELETE SET NULL,
    CONSTRAINT fk_tasks_assigned_to FOREIGN KEY (assigned_to)    REFERENCES users (id)        ON DELETE SET NULL,
    CONSTRAINT fk_tasks_created_by  FOREIGN KEY (created_by)     REFERENCES users (id)        ON DELETE SET NULL,
    CONSTRAINT ck_tasks_estimate    CHECK (estimated_minutes IS NULL OR estimated_minutes > 0),
    CONSTRAINT ck_tasks_timeline    CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at),
    CONSTRAINT ck_tasks_completion  CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);
CREATE INDEX ix_tasks_assignee_status ON tasks (assigned_to, status, due_at);   -- "minhas tarefas" (funcionário)
CREATE INDEX ix_tasks_property_due    ON tasks (property_id, due_at);
CREATE INDEX ix_tasks_reservation     ON tasks (reservation_id) WHERE reservation_id IS NOT NULL;
CREATE INDEX ix_tasks_open_due        ON tasks (due_at) WHERE status IN ('pending', 'in_progress', 'blocked');

-- Histórico de mudanças de status (preenchido por trigger — RF-17 / RF-18).
CREATE TABLE task_status_history (
    id          bigint      GENERATED ALWAYS AS IDENTITY,
    task_id     uuid        NOT NULL,
    from_status task_status,
    to_status   task_status NOT NULL,
    changed_by  uuid,
    changed_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_task_status_history PRIMARY KEY (id),
    CONSTRAINT fk_task_status_history_task FOREIGN KEY (task_id)    REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT fk_task_status_history_user FOREIGN KEY (changed_by) REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX ix_task_status_history_task ON task_status_history (task_id, changed_at);

-- Evidências (fotos) de limpeza/manutenção.
CREATE TABLE task_attachments (
    id          uuid         NOT NULL DEFAULT gen_random_uuid(),
    task_id     uuid         NOT NULL,
    file_url    varchar(500) NOT NULL,
    mime_type   varchar(80)  NOT NULL,
    caption     varchar(255),
    uploaded_by uuid,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT pk_task_attachments PRIMARY KEY (id),
    CONSTRAINT fk_task_attachments_task FOREIGN KEY (task_id)     REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT fk_task_attachments_user FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX ix_task_attachments_task ON task_attachments (task_id);

-- Modelos de checklist reutilizáveis (por proprietário, opcionalmente por imóvel).
CREATE TABLE checklist_templates (
    id          uuid         NOT NULL DEFAULT gen_random_uuid(),
    owner_id    uuid         NOT NULL,
    property_id uuid,         -- NULL = vale para todos os imóveis do proprietário
    task_type   task_type    NOT NULL,
    name        varchar(120) NOT NULL,
    is_active   boolean      NOT NULL DEFAULT TRUE,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    updated_at  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT pk_checklist_templates PRIMARY KEY (id),
    CONSTRAINT fk_checklist_templates_owner    FOREIGN KEY (owner_id)    REFERENCES users (id)      ON DELETE CASCADE,
    CONSTRAINT fk_checklist_templates_property FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE
);
CREATE INDEX ix_checklist_templates_lookup ON checklist_templates (owner_id, task_type, property_id) WHERE is_active;

CREATE TABLE checklist_template_items (
    id             uuid         NOT NULL DEFAULT gen_random_uuid(),
    template_id    uuid         NOT NULL,
    position       smallint     NOT NULL,
    description    varchar(255) NOT NULL,
    is_required    boolean      NOT NULL DEFAULT TRUE,
    requires_photo boolean      NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_checklist_template_items PRIMARY KEY (id),
    CONSTRAINT fk_checklist_template_items_template FOREIGN KEY (template_id) REFERENCES checklist_templates (id) ON DELETE CASCADE,
    CONSTRAINT uq_checklist_template_items_position UNIQUE (template_id, position)
);

-- Itens instanciados na tarefa. A descrição é copiada (snapshot) para que
-- alterações futuras no modelo não reescrevam o histórico de execução.
CREATE TABLE task_checklist_items (
    id               uuid         NOT NULL DEFAULT gen_random_uuid(),
    task_id          uuid         NOT NULL,
    template_item_id uuid,
    position         smallint     NOT NULL,
    description      varchar(255) NOT NULL,
    is_required      boolean      NOT NULL DEFAULT TRUE,
    requires_photo   boolean      NOT NULL DEFAULT FALSE,
    is_checked       boolean      NOT NULL DEFAULT FALSE,
    checked_by       uuid,
    checked_at       timestamptz,
    photo_url        varchar(500),
    notes            varchar(500),
    CONSTRAINT pk_task_checklist_items PRIMARY KEY (id),
    CONSTRAINT fk_task_checklist_items_task     FOREIGN KEY (task_id)          REFERENCES tasks (id)                    ON DELETE CASCADE,
    CONSTRAINT fk_task_checklist_items_template FOREIGN KEY (template_item_id) REFERENCES checklist_template_items (id) ON DELETE SET NULL,
    CONSTRAINT fk_task_checklist_items_user     FOREIGN KEY (checked_by)       REFERENCES users (id)                    ON DELETE SET NULL,
    CONSTRAINT uq_task_checklist_items_position UNIQUE (task_id, position),
    CONSTRAINT ck_task_checklist_items_checked  CHECK (is_checked = (checked_at IS NOT NULL)),
    CONSTRAINT ck_task_checklist_items_photo    CHECK (NOT (is_checked AND requires_photo) OR photo_url IS NOT NULL)
);

-- Solicitações de manutenção: o problema relatado pode originar uma tarefa.
CREATE TABLE maintenance_requests (
    id               uuid                 NOT NULL DEFAULT gen_random_uuid(),
    property_id      uuid                 NOT NULL,
    task_id          uuid,
    reported_by      uuid,
    title            varchar(150)         NOT NULL,
    description      text                 NOT NULL,
    location         varchar(80),          -- ex.: "Banheiro da suíte"
    severity         maintenance_severity NOT NULL DEFAULT 'medium',
    status           maintenance_status   NOT NULL DEFAULT 'open',
    estimated_cost   numeric(12,2),
    actual_cost      numeric(12,2),
    resolved_at      timestamptz,
    resolution_notes text,
    created_at       timestamptz          NOT NULL DEFAULT now(),
    updated_at       timestamptz          NOT NULL DEFAULT now(),
    CONSTRAINT pk_maintenance_requests PRIMARY KEY (id),
    CONSTRAINT uq_maintenance_requests_task UNIQUE (task_id),
    CONSTRAINT fk_maintenance_requests_property FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE RESTRICT,
    CONSTRAINT fk_maintenance_requests_task     FOREIGN KEY (task_id)     REFERENCES tasks (id)      ON DELETE SET NULL,
    CONSTRAINT fk_maintenance_requests_reporter FOREIGN KEY (reported_by) REFERENCES users (id)      ON DELETE SET NULL,
    CONSTRAINT ck_maintenance_requests_costs    CHECK ((estimated_cost IS NULL OR estimated_cost >= 0) AND (actual_cost IS NULL OR actual_cost >= 0)),
    CONSTRAINT ck_maintenance_requests_resolved CHECK ((status = 'resolved') = (resolved_at IS NOT NULL))
);
CREATE INDEX ix_maintenance_requests_property_status ON maintenance_requests (property_id, status);
CREATE INDEX ix_maintenance_requests_open ON maintenance_requests (severity, created_at) WHERE status NOT IN ('resolved', 'cancelled');

-- =============================================================================
-- 7. SUPRIMENTOS / ESTOQUE  (RF-12)
-- =============================================================================

CREATE TABLE inventory_items (
    id               uuid          NOT NULL DEFAULT gen_random_uuid(),
    property_id      uuid          NOT NULL,
    name             varchar(100)  NOT NULL,
    category         varchar(50)   NOT NULL DEFAULT 'general',  -- limpeza, higiene, cozinha, enxoval...
    unit             varchar(20)   NOT NULL DEFAULT 'un',
    current_quantity numeric(12,3) NOT NULL DEFAULT 0,           -- mantido pelo trigger de movimentação
    minimum_quantity numeric(12,3) NOT NULL DEFAULT 0,
    is_active        boolean       NOT NULL DEFAULT TRUE,
    created_at       timestamptz   NOT NULL DEFAULT now(),
    updated_at       timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT pk_inventory_items PRIMARY KEY (id),
    CONSTRAINT fk_inventory_items_property FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE RESTRICT,
    CONSTRAINT ck_inventory_items_quantities CHECK (current_quantity >= 0 AND minimum_quantity >= 0)
);
CREATE UNIQUE INDEX uq_inventory_items_property_name ON inventory_items (property_id, lower(name));
CREATE INDEX ix_inventory_items_low_stock ON inventory_items (property_id) WHERE is_active AND current_quantity <= minimum_quantity;

-- Livro-razão de estoque (append-only). O saldo é derivado e auditável.
CREATE TABLE inventory_movements (
    id            uuid                NOT NULL DEFAULT gen_random_uuid(),
    item_id       uuid                NOT NULL,
    movement_type stock_movement_type NOT NULL,
    quantity      numeric(12,3)       NOT NULL,  -- in/out: sempre positivo; adjustment: delta com sinal
    balance_after numeric(12,3)       NOT NULL,  -- calculado pelo trigger
    unit_cost     numeric(12,2),
    reason        varchar(255),
    task_id       uuid,
    performed_by  uuid,
    occurred_at   timestamptz         NOT NULL DEFAULT now(),
    CONSTRAINT pk_inventory_movements PRIMARY KEY (id),
    CONSTRAINT fk_inventory_movements_item FOREIGN KEY (item_id)      REFERENCES inventory_items (id) ON DELETE RESTRICT,
    CONSTRAINT fk_inventory_movements_task FOREIGN KEY (task_id)      REFERENCES tasks (id)           ON DELETE SET NULL,
    CONSTRAINT fk_inventory_movements_user FOREIGN KEY (performed_by) REFERENCES users (id)           ON DELETE SET NULL,
    CONSTRAINT ck_inventory_movements_quantity CHECK (
        (movement_type IN ('in', 'out') AND quantity > 0) OR (movement_type = 'adjustment' AND quantity <> 0)
    ),
    CONSTRAINT ck_inventory_movements_cost CHECK (unit_cost IS NULL OR unit_cost >= 0)
);
CREATE INDEX ix_inventory_movements_item ON inventory_movements (item_id, occurred_at DESC);

-- =============================================================================
-- 8. FINANCEIRO  (RF-13)
-- =============================================================================

CREATE TABLE financial_categories (
    id         integer          GENERATED ALWAYS AS IDENTITY,
    owner_id   uuid,             -- NULL = categoria padrão do sistema
    name       varchar(80)      NOT NULL,
    type       transaction_type NOT NULL,
    is_active  boolean          NOT NULL DEFAULT TRUE,
    created_at timestamptz      NOT NULL DEFAULT now(),
    CONSTRAINT pk_financial_categories PRIMARY KEY (id),
    CONSTRAINT uq_financial_categories_id_type UNIQUE (id, type),  -- alvo da FK composta
    CONSTRAINT fk_financial_categories_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX uq_financial_categories_name ON financial_categories (owner_id, lower(name), type) NULLS NOT DISTINCT;

CREATE TABLE financial_transactions (
    id                     uuid             NOT NULL DEFAULT gen_random_uuid(),
    property_id            uuid             NOT NULL,
    category_id            integer          NOT NULL,
    type                   transaction_type NOT NULL,
    amount                 numeric(12,2)    NOT NULL,
    description            varchar(255)     NOT NULL,
    transaction_date       date             NOT NULL,   -- data de competência
    due_date               date,
    paid_date              date,
    payment_status         payment_status   NOT NULL DEFAULT 'paid',
    payment_method         payment_method,
    reservation_id         uuid,
    maintenance_request_id uuid,
    inventory_movement_id  uuid,
    created_by             uuid,
    created_at             timestamptz      NOT NULL DEFAULT now(),
    updated_at             timestamptz      NOT NULL DEFAULT now(),
    CONSTRAINT pk_financial_transactions PRIMARY KEY (id),
    CONSTRAINT fk_financial_transactions_property FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE RESTRICT,
    -- FK composta: garante que o tipo do lançamento coincide com o tipo da categoria.
    CONSTRAINT fk_financial_transactions_category FOREIGN KEY (category_id, type)
        REFERENCES financial_categories (id, type) ON DELETE RESTRICT,
    CONSTRAINT fk_financial_transactions_reservation FOREIGN KEY (reservation_id)         REFERENCES reservations (id)         ON DELETE SET NULL,
    CONSTRAINT fk_financial_transactions_maintenance FOREIGN KEY (maintenance_request_id) REFERENCES maintenance_requests (id) ON DELETE SET NULL,
    CONSTRAINT fk_financial_transactions_inventory   FOREIGN KEY (inventory_movement_id)  REFERENCES inventory_movements (id)  ON DELETE SET NULL,
    CONSTRAINT fk_financial_transactions_created_by  FOREIGN KEY (created_by)             REFERENCES users (id)                ON DELETE SET NULL,
    CONSTRAINT ck_financial_transactions_amount CHECK (amount > 0),
    CONSTRAINT ck_financial_transactions_paid   CHECK ((payment_status = 'paid') = (paid_date IS NOT NULL))
);
CREATE INDEX ix_financial_transactions_property_date ON financial_transactions (property_id, transaction_date);
CREATE INDEX ix_financial_transactions_date_type     ON financial_transactions (transaction_date, type) WHERE payment_status <> 'cancelled';
CREATE INDEX ix_financial_transactions_category      ON financial_transactions (category_id);
CREATE INDEX ix_financial_transactions_reservation   ON financial_transactions (reservation_id) WHERE reservation_id IS NOT NULL;
CREATE INDEX ix_financial_transactions_pending       ON financial_transactions (due_date) WHERE payment_status IN ('pending', 'overdue');

-- =============================================================================
-- 9. INTELIGÊNCIA DE NEGÓCIO, AUDITORIA E IA  (RF-14, RF-15, RF-16, RF-18)
-- =============================================================================

-- Histórico de atividades (append-only). Não armazenar dados pessoais em "changes".
CREATE TABLE activity_logs (
    id          bigint      GENERATED ALWAYS AS IDENTITY,
    actor_id    uuid,
    owner_id    uuid,        -- escopo (tenant) do evento → filtro rápido por proprietário
    property_id uuid,
    action      varchar(60) NOT NULL,   -- ex.: 'reservation.created', 'task.completed'
    entity_type varchar(40) NOT NULL,
    entity_id   uuid,
    changes     jsonb       NOT NULL DEFAULT '{}'::jsonb,
    ip_address  inet,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_activity_logs PRIMARY KEY (id),
    CONSTRAINT fk_activity_logs_actor    FOREIGN KEY (actor_id)    REFERENCES users (id)      ON DELETE SET NULL,
    CONSTRAINT fk_activity_logs_owner    FOREIGN KEY (owner_id)    REFERENCES users (id)      ON DELETE SET NULL,
    CONSTRAINT fk_activity_logs_property FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE SET NULL
);
CREATE INDEX ix_activity_logs_owner_time  ON activity_logs (owner_id, occurred_at DESC);
CREATE INDEX ix_activity_logs_entity      ON activity_logs (entity_type, entity_id);
CREATE INDEX ix_activity_logs_actor_time  ON activity_logs (actor_id, occurred_at DESC);
CREATE INDEX ix_activity_logs_time_brin   ON activity_logs USING brin (occurred_at);

-- Relatórios personalizados salvos (filtros parametrizados).
CREATE TABLE saved_reports (
    id                uuid         NOT NULL DEFAULT gen_random_uuid(),
    owner_id          uuid         NOT NULL,
    name              varchar(120) NOT NULL,
    report_type       varchar(40)  NOT NULL,  -- occupancy | cash_flow | tasks | inventory | maintenance | custom
    filters           jsonb        NOT NULL DEFAULT '{}'::jsonb,
    last_generated_at timestamptz,
    created_at        timestamptz  NOT NULL DEFAULT now(),
    updated_at        timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT pk_saved_reports PRIMARY KEY (id),
    CONSTRAINT fk_saved_reports_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT ck_saved_reports_type CHECK (report_type IN ('occupancy', 'cash_flow', 'tasks', 'inventory', 'maintenance', 'custom'))
);
CREATE INDEX ix_saved_reports_owner ON saved_reports (owner_id);

-- Conversas com o assistente de IA.
CREATE TABLE ai_conversations (
    id          uuid         NOT NULL DEFAULT gen_random_uuid(),
    user_id     uuid         NOT NULL,
    property_id uuid,         -- contexto opcional de um imóvel específico
    title       varchar(150),
    archived_at timestamptz,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    updated_at  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT pk_ai_conversations PRIMARY KEY (id),
    CONSTRAINT fk_ai_conversations_user     FOREIGN KEY (user_id)     REFERENCES users (id)      ON DELETE CASCADE,
    CONSTRAINT fk_ai_conversations_property FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE SET NULL
);
CREATE INDEX ix_ai_conversations_user ON ai_conversations (user_id, updated_at DESC);

CREATE TABLE ai_messages (
    id                uuid            NOT NULL DEFAULT gen_random_uuid(),
    conversation_id   uuid            NOT NULL,
    role              ai_message_role NOT NULL,
    content           text            NOT NULL,
    tool_name         varchar(60),     -- função/consulta executada pelo assistente
    tool_payload      jsonb,
    model             varchar(60),
    prompt_tokens     integer,
    completion_tokens integer,
    latency_ms        integer,
    created_at        timestamptz     NOT NULL DEFAULT now(),
    CONSTRAINT pk_ai_messages PRIMARY KEY (id),
    CONSTRAINT fk_ai_messages_conversation FOREIGN KEY (conversation_id) REFERENCES ai_conversations (id) ON DELETE CASCADE,
    CONSTRAINT ck_ai_messages_metrics CHECK (
        COALESCE(prompt_tokens, 0) >= 0 AND COALESCE(completion_tokens, 0) >= 0 AND COALESCE(latency_ms, 0) >= 0
    )
);
CREATE INDEX ix_ai_messages_conversation ON ai_messages (conversation_id, created_at);

-- Insights proativos gerados por regras ou pela IA (ex.: estoque baixo, queda de ocupação).
CREATE TABLE ai_insights (
    id           uuid             NOT NULL DEFAULT gen_random_uuid(),
    owner_id     uuid             NOT NULL,
    property_id  uuid,
    insight_type varchar(40)      NOT NULL,  -- low_stock | occupancy_drop | overdue_tasks | pricing | maintenance_pattern | cash_flow
    severity     insight_severity NOT NULL DEFAULT 'info',
    title        varchar(150)     NOT NULL,
    content      text             NOT NULL,
    data         jsonb,
    generated_by varchar(10)      NOT NULL DEFAULT 'ai',
    is_dismissed boolean          NOT NULL DEFAULT FALSE,
    expires_at   timestamptz,
    created_at   timestamptz      NOT NULL DEFAULT now(),
    CONSTRAINT pk_ai_insights PRIMARY KEY (id),
    CONSTRAINT fk_ai_insights_owner    FOREIGN KEY (owner_id)    REFERENCES users (id)      ON DELETE CASCADE,
    CONSTRAINT fk_ai_insights_property FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE,
    CONSTRAINT ck_ai_insights_generated_by CHECK (generated_by IN ('ai', 'rule'))
);
CREATE INDEX ix_ai_insights_owner_active ON ai_insights (owner_id, created_at DESC) WHERE NOT is_dismissed;

-- =============================================================================
-- 10. REGRAS DE NEGÓCIO EM TRIGGERS (defesa em profundidade)
--     A validação primária ocorre na camada de domínio (DDD); o banco garante
--     integridade mesmo diante de acessos diretos ou bugs na aplicação.
-- =============================================================================

-- 10.1 Reserva: capacidade do imóvel, consistência de tenant e cancelamento.
CREATE OR REPLACE FUNCTION fn_reservation_before_write()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_max_guests     smallint;
    v_property_owner uuid;
    v_guest_owner    uuid;
BEGIN
    IF TG_OP = 'INSERT'
       OR NEW.property_id  IS DISTINCT FROM OLD.property_id
       OR NEW.guest_id     IS DISTINCT FROM OLD.guest_id
       OR NEW.guests_count IS DISTINCT FROM OLD.guests_count THEN

        SELECT max_guests, owner_id INTO v_max_guests, v_property_owner
          FROM properties WHERE id = NEW.property_id AND deleted_at IS NULL;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Imóvel % inexistente ou removido', NEW.property_id
                USING ERRCODE = 'foreign_key_violation';
        END IF;

        IF NEW.guests_count > v_max_guests THEN
            RAISE EXCEPTION 'Quantidade de hóspedes (%) excede a capacidade do imóvel (%)',
                NEW.guests_count, v_max_guests USING ERRCODE = 'check_violation';
        END IF;

        SELECT owner_id INTO v_guest_owner FROM guests WHERE id = NEW.guest_id;
        IF v_guest_owner IS DISTINCT FROM v_property_owner THEN
            RAISE EXCEPTION 'O hóspede não pertence ao proprietário do imóvel'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    -- Carimbo automático de cancelamento
    IF NEW.status = 'cancelled' THEN
        NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
    ELSE
        NEW.cancelled_at := NULL;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_reservations_before_write
    BEFORE INSERT OR UPDATE ON reservations
    FOR EACH ROW EXECUTE FUNCTION fn_reservation_before_write();

-- 10.2 Tarefa: carimbos de tempo e bloqueio de conclusão com checklist pendente.
CREATE OR REPLACE FUNCTION fn_task_before_write()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_pending integer;
BEGIN
    IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.status = 'in_progress' AND NEW.started_at IS NULL THEN
            NEW.started_at := now();
        END IF;

        IF NEW.status = 'completed' THEN
            IF TG_OP = 'UPDATE' THEN
                SELECT count(*) INTO v_pending
                  FROM task_checklist_items
                 WHERE task_id = NEW.id AND is_required AND NOT is_checked;
                IF v_pending > 0 THEN
                    RAISE EXCEPTION 'A tarefa possui % item(ns) obrigatório(s) de checklist pendente(s)', v_pending
                        USING ERRCODE = 'check_violation';
                END IF;
            END IF;
            NEW.completed_at := COALESCE(NEW.completed_at, now());
            NEW.started_at   := COALESCE(NEW.started_at, NEW.completed_at);
        ELSE
            NEW.completed_at := NULL;
        END IF;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_tasks_before_write
    BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION fn_task_before_write();

-- 10.3 Tarefa: trilha de auditoria de status.
CREATE OR REPLACE FUNCTION fn_task_log_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO task_status_history (task_id, from_status, to_status, changed_by)
        VALUES (NEW.id, NULL, NEW.status, COALESCE(fn_current_app_user(), NEW.created_by));
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO task_status_history (task_id, from_status, to_status, changed_by)
        VALUES (NEW.id, OLD.status, NEW.status, fn_current_app_user());
    END IF;
    RETURN NULL;
END $$;

CREATE TRIGGER trg_tasks_log_status
    AFTER INSERT OR UPDATE OF status ON tasks
    FOR EACH ROW EXECUTE FUNCTION fn_task_log_status();

-- 10.4 Estoque: aplica a movimentação ao saldo com lock pessimista.
CREATE OR REPLACE FUNCTION fn_inventory_apply_movement()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_current numeric(12,3);
    v_delta   numeric(12,3);
BEGIN
    SELECT current_quantity INTO v_current
      FROM inventory_items WHERE id = NEW.item_id
       FOR UPDATE;   -- serializa movimentações concorrentes do mesmo item

    v_delta := CASE NEW.movement_type
                   WHEN 'in'  THEN NEW.quantity
                   WHEN 'out' THEN -NEW.quantity
                   ELSE NEW.quantity
               END;

    IF v_current + v_delta < 0 THEN
        RAISE EXCEPTION 'Estoque insuficiente: saldo atual %, movimentação %', v_current, v_delta
            USING ERRCODE = 'check_violation';
    END IF;

    UPDATE inventory_items SET current_quantity = v_current + v_delta WHERE id = NEW.item_id;
    NEW.balance_after := v_current + v_delta;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_inventory_movements_apply
    BEFORE INSERT ON inventory_movements
    FOR EACH ROW EXECUTE FUNCTION fn_inventory_apply_movement();

-- 10.5 Tabelas append-only. "UPDATE OF <colunas>" permite que ações de FK
--      (ON DELETE SET NULL) continuem funcionando.
CREATE TRIGGER trg_inventory_movements_immutable
    BEFORE UPDATE OF item_id, movement_type, quantity, balance_after, unit_cost, occurred_at OR DELETE
    ON inventory_movements
    FOR EACH ROW EXECUTE FUNCTION fn_prevent_mutation();

CREATE TRIGGER trg_task_status_history_immutable
    BEFORE UPDATE OF task_id, from_status, to_status, changed_at ON task_status_history
    FOR EACH ROW EXECUTE FUNCTION fn_prevent_mutation();

-- Logs podem ser expurgados (política de retenção LGPD), mas nunca alterados.
CREATE TRIGGER trg_activity_logs_immutable
    BEFORE UPDATE OF action, entity_type, entity_id, changes, occurred_at ON activity_logs
    FOR EACH ROW EXECUTE FUNCTION fn_prevent_mutation();

-- 10.6 Validação de perfis nas associações com usuários.
CREATE TRIGGER trg_team_members_owner_role    BEFORE INSERT OR UPDATE OF owner_id    ON team_members        FOR EACH ROW EXECUTE FUNCTION fn_assert_user_role('owner_id', 'owner');
CREATE TRIGGER trg_team_members_employee_role BEFORE INSERT OR UPDATE OF employee_id ON team_members        FOR EACH ROW EXECUTE FUNCTION fn_assert_user_role('employee_id', 'employee');
CREATE TRIGGER trg_properties_owner_role      BEFORE INSERT OR UPDATE OF owner_id    ON properties          FOR EACH ROW EXECUTE FUNCTION fn_assert_user_role('owner_id', 'owner');
CREATE TRIGGER trg_guests_owner_role          BEFORE INSERT OR UPDATE OF owner_id    ON guests              FOR EACH ROW EXECUTE FUNCTION fn_assert_user_role('owner_id', 'owner');
CREATE TRIGGER trg_tasks_assignee_role        BEFORE INSERT OR UPDATE OF assigned_to ON tasks               FOR EACH ROW EXECUTE FUNCTION fn_assert_user_role('assigned_to', 'employee', 'owner');
CREATE TRIGGER trg_checklist_templates_role   BEFORE INSERT OR UPDATE OF owner_id    ON checklist_templates FOR EACH ROW EXECUTE FUNCTION fn_assert_user_role('owner_id', 'owner');
CREATE TRIGGER trg_ai_insights_owner_role     BEFORE INSERT OR UPDATE OF owner_id    ON ai_insights         FOR EACH ROW EXECUTE FUNCTION fn_assert_user_role('owner_id', 'owner');
CREATE TRIGGER trg_ai_conversations_user_role BEFORE INSERT OR UPDATE OF user_id     ON ai_conversations    FOR EACH ROW EXECUTE FUNCTION fn_assert_user_role('user_id', 'owner', 'admin');

-- 10.7 updated_at automático.
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'users', 'properties', 'guests', 'reservations', 'tasks', 'checklist_templates',
        'maintenance_requests', 'inventory_items', 'financial_transactions',
        'saved_reports', 'ai_conversations'
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$I
               FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()', t);
    END LOOP;
END $$;

-- =============================================================================
-- 11. LGPD — DIREITO DE ELIMINAÇÃO / ANONIMIZAÇÃO (art. 16 e 18)
--     Reservas e lançamentos são preservados (obrigação legal/fiscal), mas
--     desvinculados de dados que identifiquem o titular.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_anonymize_guest(p_guest_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    UPDATE guests
       SET full_name          = 'Hóspede anonimizado',
           email              = NULL,
           phone              = NULL,
           document_encrypted = NULL,
           document_hash      = NULL,
           nationality        = NULL,
           notes              = NULL,
           anonymized_at      = now()
     WHERE id = p_guest_id AND anonymized_at IS NULL;

    UPDATE reservations SET notes = NULL WHERE guest_id = p_guest_id;
END $$;

CREATE OR REPLACE FUNCTION fn_anonymize_user(p_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    UPDATE users
       SET full_name     = 'Usuário removido',
           email         = 'removed+' || id::text || '@anonymized.invalid',
           phone         = NULL,
           password_hash = '!',     -- hash inválido: login impossível
           is_active     = FALSE,
           deleted_at    = COALESCE(deleted_at, now())
     WHERE id = p_user_id;

    UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = p_user_id AND revoked_at IS NULL;
    UPDATE user_consents  SET revoked_at = now() WHERE user_id = p_user_id AND revoked_at IS NULL;
END $$;

-- =============================================================================
-- 12. VIEWS ANALÍTICAS (Dashboard RF-14 e contexto do Assistente de IA RF-16)
-- =============================================================================

-- Uma linha por noite ocupada (base para taxa de ocupação e receita diária).
CREATE VIEW vw_reservation_nights AS
SELECT r.id                                 AS reservation_id,
       r.property_id,
       gs::date                             AS night_date,
       r.total_amount / NULLIF(r.nights, 0) AS nightly_revenue
  FROM reservations r
 CROSS JOIN LATERAL generate_series(r.check_in_date::timestamp,
                                    (r.check_out_date - 1)::timestamp,
                                    interval '1 day') AS gs
 WHERE r.status NOT IN ('cancelled', 'no_show');

CREATE VIEW vw_property_monthly_occupancy AS
SELECT p.id                                     AS property_id,
       p.owner_id,
       date_trunc('month', n.night_date)::date  AS month,
       count(*)                                 AS occupied_nights,
       extract(day FROM date_trunc('month', n.night_date) + interval '1 month - 1 day')::int AS days_in_month,
       round(count(*)::numeric
             / extract(day FROM date_trunc('month', n.night_date) + interval '1 month - 1 day') * 100, 2)
                                                AS occupancy_rate_pct,
       round(sum(n.nightly_revenue), 2)         AS accommodation_revenue
  FROM vw_reservation_nights n
  JOIN properties p ON p.id = n.property_id
 GROUP BY p.id, p.owner_id, date_trunc('month', n.night_date);

CREATE VIEW vw_monthly_cash_flow AS
SELECT ft.property_id,
       p.owner_id,
       date_trunc('month', ft.transaction_date)::date                        AS month,
       COALESCE(sum(ft.amount) FILTER (WHERE ft.type = 'income'), 0)         AS total_income,
       COALESCE(sum(ft.amount) FILTER (WHERE ft.type = 'expense'), 0)        AS total_expense,
       COALESCE(sum(CASE ft.type WHEN 'income' THEN ft.amount ELSE -ft.amount END), 0) AS net_result
  FROM financial_transactions ft
  JOIN properties p ON p.id = ft.property_id
 WHERE ft.payment_status <> 'cancelled'
 GROUP BY ft.property_id, p.owner_id, date_trunc('month', ft.transaction_date);

CREATE VIEW vw_low_stock_items AS
SELECT i.id AS item_id, i.property_id, p.owner_id, p.name AS property_name,
       i.name, i.category, i.unit, i.current_quantity, i.minimum_quantity,
       (i.minimum_quantity - i.current_quantity) AS shortage
  FROM inventory_items i
  JOIN properties p ON p.id = i.property_id AND p.deleted_at IS NULL
 WHERE i.is_active AND i.current_quantity <= i.minimum_quantity;

CREATE VIEW vw_overdue_tasks AS
SELECT t.id AS task_id, t.property_id, p.owner_id, p.name AS property_name,
       t.title, t.task_type, t.priority, t.status, t.due_at, t.assigned_to,
       now() - t.due_at AS overdue_by
  FROM tasks t
  JOIN properties p ON p.id = t.property_id
 WHERE t.status IN ('pending', 'in_progress', 'blocked') AND t.due_at < now();

COMMIT;
