-- =============================================================================
--  Dados de referência (idempotente)
--  Obs.: o usuário administrador NÃO é criado aqui para evitar credenciais
--  fixas em repositório. Ele será criado via CLI do backend (Etapa 2).
-- =============================================================================

BEGIN;

-- Comodidades / características dos imóveis (RF-04)
INSERT INTO amenities (code, name, category) VALUES
    ('wifi',             'Wi-Fi',                    'conectividade'),
    ('workspace',        'Espaço de trabalho',       'conectividade'),
    ('tv',               'TV',                       'entretenimento'),
    ('streaming',        'Streaming',                'entretenimento'),
    ('air_conditioning', 'Ar-condicionado',          'conforto'),
    ('heating',          'Aquecedor',                'conforto'),
    ('kitchen',          'Cozinha equipada',         'cozinha'),
    ('microwave',        'Micro-ondas',              'cozinha'),
    ('coffee_maker',     'Cafeteira',                'cozinha'),
    ('washing_machine',  'Máquina de lavar',         'lavanderia'),
    ('iron',             'Ferro de passar',          'lavanderia'),
    ('linens',           'Roupa de cama e banho',    'enxoval'),
    ('parking',          'Estacionamento',           'área externa'),
    ('pool',             'Piscina',                  'área externa'),
    ('bbq_grill',        'Churrasqueira',            'área externa'),
    ('balcony',          'Varanda',                  'área externa'),
    ('elevator',         'Elevador',                 'acessibilidade'),
    ('step_free_access', 'Acesso sem degraus',       'acessibilidade'),
    ('pet_friendly',     'Aceita animais',           'regras'),
    ('self_check_in',    'Check-in autônomo',        'acesso'),
    ('smoke_detector',   'Detector de fumaça',       'segurança'),
    ('security_cameras', 'Câmeras em áreas externas','segurança')
ON CONFLICT DO NOTHING;

-- Categorias financeiras padrão do sistema (owner_id NULL) (RF-13)
INSERT INTO financial_categories (owner_id, name, type) VALUES
    (NULL, 'Hospedagem',            'income'),
    (NULL, 'Taxa de limpeza',       'income'),
    (NULL, 'Taxas extras',          'income'),
    (NULL, 'Outras receitas',       'income'),
    (NULL, 'Limpeza',               'expense'),
    (NULL, 'Lavanderia',            'expense'),
    (NULL, 'Manutenção',            'expense'),
    (NULL, 'Suprimentos',           'expense'),
    (NULL, 'Condomínio',            'expense'),
    (NULL, 'IPTU',                  'expense'),
    (NULL, 'Energia elétrica',      'expense'),
    (NULL, 'Água e esgoto',         'expense'),
    (NULL, 'Gás',                   'expense'),
    (NULL, 'Internet e TV',         'expense'),
    (NULL, 'Taxas de plataforma',   'expense'),
    (NULL, 'Impostos',              'expense'),
    (NULL, 'Seguro',                'expense'),
    (NULL, 'Mobília e utensílios',  'expense'),
    (NULL, 'Outras despesas',       'expense')
ON CONFLICT DO NOTHING;

COMMIT;
