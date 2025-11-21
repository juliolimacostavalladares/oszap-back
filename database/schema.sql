-- =====================================================
-- SCHEMA COMPLETO PARA ASSISTENTE VIRTUAL DE WHATSAPP
-- Sistema de Gerenciamento de Ordens de Serviço
-- =====================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- TABELA: usuarios
-- Gerencia usuários do WhatsApp
-- =====================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telefone VARCHAR(20) UNIQUE NOT NULL,
    nome VARCHAR(255),
    email VARCHAR(255),
    avatar_url TEXT,
    preferencias JSONB DEFAULT '{}',
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_usuarios_telefone ON usuarios(telefone);

-- =====================================================
-- TABELA: ordens_servico
-- Gerencia as ordens de serviço
-- =====================================================
CREATE TABLE IF NOT EXISTS ordens_servico (
    id SERIAL PRIMARY KEY,
    numero_os VARCHAR(50) UNIQUE NOT NULL,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    
    -- Informações do cliente
    cliente_nome VARCHAR(255) NOT NULL,
    cliente_telefone VARCHAR(20),
    cliente_email VARCHAR(255),
    cliente_endereco TEXT,
    
    -- Detalhes do serviço
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT NOT NULL,
    categoria VARCHAR(100),
    prioridade VARCHAR(20) DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
    
    -- Status e gestão
    status VARCHAR(50) DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_andamento', 'aguardando_pecas', 'concluida', 'cancelada')),
    tecnico_responsavel VARCHAR(255),
    
    -- Valores
    valor_estimado DECIMAL(10,2),
    valor_final DECIMAL(10,2),
    valor_pecas DECIMAL(10,2),
    valor_mao_obra DECIMAL(10,2),
    
    -- Datas importantes
    data_abertura TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_previsao TIMESTAMP WITH TIME ZONE,
    data_conclusao TIMESTAMP WITH TIME ZONE,
    
    -- Arquivos e anotações
    pdf_url TEXT,
    observacoes TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_os_numero ON ordens_servico(numero_os);
CREATE INDEX idx_os_usuario ON ordens_servico(usuario_id);
CREATE INDEX idx_os_status ON ordens_servico(status);
CREATE INDEX idx_os_data_abertura ON ordens_servico(data_abertura DESC);

-- =====================================================
-- TABELA: historico_os
-- Registra todas as mudanças nas ordens de serviço
-- =====================================================
CREATE TABLE IF NOT EXISTS historico_os (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ordem_servico_id INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    
    tipo_evento VARCHAR(50) NOT NULL, -- 'criacao', 'atualizacao', 'mudanca_status', 'comentario'
    descricao TEXT NOT NULL,
    dados_anteriores JSONB,
    dados_novos JSONB,
    
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_historico_os ON historico_os(ordem_servico_id, criado_em DESC);

-- =====================================================
-- TABELA: pecas_os
-- Gerencia peças utilizadas nas ordens de serviço
-- =====================================================
CREATE TABLE IF NOT EXISTS pecas_os (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ordem_servico_id INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
    
    descricao VARCHAR(255) NOT NULL,
    codigo VARCHAR(100),
    quantidade INTEGER NOT NULL DEFAULT 1,
    valor_unitario DECIMAL(10,2) NOT NULL,
    valor_total DECIMAL(10,2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
    
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pecas_os ON pecas_os(ordem_servico_id);

-- =====================================================
-- TABELA: conversas_whatsapp
-- Gerencia conversas e contexto das interações
-- =====================================================
CREATE TABLE IF NOT EXISTS conversas_whatsapp (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    
    -- Identificadores WhatsApp
    chat_id VARCHAR(100) NOT NULL,
    remote_jid VARCHAR(100) NOT NULL,
    
    -- Thread da conversa com OpenAI
    openai_thread_id VARCHAR(255),
    openai_assistant_id VARCHAR(255),
    
    -- Contexto da conversa
    contexto_atual JSONB DEFAULT '{}',
    ultima_intencao VARCHAR(100),
    aguardando_resposta BOOLEAN DEFAULT FALSE,
    
    -- Estatísticas
    total_mensagens INTEGER DEFAULT 0,
    ultima_mensagem_em TIMESTAMP WITH TIME ZONE,
    
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(usuario_id, chat_id)
);

CREATE INDEX idx_conversas_usuario ON conversas_whatsapp(usuario_id);
CREATE INDEX idx_conversas_chat ON conversas_whatsapp(chat_id);
CREATE INDEX idx_conversas_thread ON conversas_whatsapp(openai_thread_id);

-- =====================================================
-- TABELA: mensagens_whatsapp
-- Armazena histórico completo de mensagens
-- =====================================================
CREATE TABLE IF NOT EXISTS mensagens_whatsapp (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversa_id UUID NOT NULL REFERENCES conversas_whatsapp(id) ON DELETE CASCADE,
    
    -- Identificadores da mensagem
    message_id VARCHAR(255) UNIQUE NOT NULL,
    from_me BOOLEAN DEFAULT FALSE,
    
    -- Conteúdo
    tipo_mensagem VARCHAR(50) NOT NULL, -- 'text', 'audio', 'image', 'document', 'interactive'
    conteudo_texto TEXT,
    conteudo_transcrito TEXT, -- Para áudios transcritos
    media_url TEXT,
    
    -- Metadados
    metadata JSONB DEFAULT '{}',
    processado BOOLEAN DEFAULT FALSE,
    erro TEXT,
    
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mensagens_conversa ON mensagens_whatsapp(conversa_id, criado_em DESC);
CREATE INDEX idx_mensagens_id ON mensagens_whatsapp(message_id);

-- =====================================================
-- TABELA: templates_mensagem
-- Templates pré-configurados para respostas profissionais
-- =====================================================
CREATE TABLE IF NOT EXISTS templates_mensagem (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(100) UNIQUE NOT NULL,
    nome VARCHAR(255) NOT NULL,
    categoria VARCHAR(100),
    
    -- Conteúdo do template
    tipo VARCHAR(50) NOT NULL, -- 'text', 'buttons', 'list', 'template'
    conteudo JSONB NOT NULL,
    
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_templates_codigo ON templates_mensagem(codigo);
CREATE INDEX idx_templates_categoria ON templates_mensagem(categoria);

-- =====================================================
-- FUNÇÕES E TRIGGERS
-- =====================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar updated_at
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ordens_servico_updated_at BEFORE UPDATE ON ordens_servico
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversas_updated_at BEFORE UPDATE ON conversas_whatsapp
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates_mensagem
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para gerar número de OS automático
CREATE OR REPLACE FUNCTION gerar_numero_os()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero_os IS NULL THEN
        NEW.numero_os := 'OS-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('ordens_servico_id_seq')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_gerar_numero_os BEFORE INSERT ON ordens_servico
    FOR EACH ROW EXECUTE FUNCTION gerar_numero_os();

-- Função para registrar histórico automaticamente
CREATE OR REPLACE FUNCTION registrar_historico_os()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO historico_os (ordem_servico_id, tipo_evento, descricao, dados_novos)
        VALUES (NEW.id, 'criacao', 'Ordem de serviço criada', row_to_json(NEW));
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != NEW.status THEN
            INSERT INTO historico_os (ordem_servico_id, tipo_evento, descricao, dados_anteriores, dados_novos)
            VALUES (NEW.id, 'mudanca_status', 
                   'Status alterado de ' || OLD.status || ' para ' || NEW.status,
                   jsonb_build_object('status', OLD.status),
                   jsonb_build_object('status', NEW.status));
        ELSE
            INSERT INTO historico_os (ordem_servico_id, tipo_evento, descricao, dados_anteriores, dados_novos)
            VALUES (NEW.id, 'atualizacao', 'Ordem de serviço atualizada', 
                   row_to_json(OLD), row_to_json(NEW));
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_registrar_historico_os AFTER INSERT OR UPDATE ON ordens_servico
    FOR EACH ROW EXECUTE FUNCTION registrar_historico_os();

-- =====================================================
-- VIEWS ÚTEIS
-- =====================================================

-- View: Ordens de serviço com informações completas
CREATE OR REPLACE VIEW view_os_completa AS
SELECT 
    os.*,
    u.nome as usuario_nome,
    u.telefone as usuario_telefone,
    COUNT(DISTINCT p.id) as total_pecas,
    COALESCE(SUM(p.valor_total), 0) as total_valor_pecas,
    COUNT(DISTINCT h.id) as total_eventos
FROM ordens_servico os
LEFT JOIN usuarios u ON os.usuario_id = u.id
LEFT JOIN pecas_os p ON os.id = p.ordem_servico_id
LEFT JOIN historico_os h ON os.id = h.ordem_servico_id
GROUP BY os.id, u.nome, u.telefone;

-- View: Estatísticas por usuário
CREATE OR REPLACE VIEW view_estatisticas_usuario AS
SELECT 
    u.id,
    u.nome,
    u.telefone,
    COUNT(os.id) as total_os,
    COUNT(CASE WHEN os.status = 'aberta' THEN 1 END) as os_abertas,
    COUNT(CASE WHEN os.status = 'em_andamento' THEN 1 END) as os_em_andamento,
    COUNT(CASE WHEN os.status = 'concluida' THEN 1 END) as os_concluidas,
    COALESCE(SUM(os.valor_final), 0) as valor_total_servicos,
    MAX(os.data_abertura) as ultima_os
FROM usuarios u
LEFT JOIN ordens_servico os ON u.id = os.usuario_id
GROUP BY u.id, u.nome, u.telefone;

-- =====================================================
-- DADOS INICIAIS - Templates de Mensagem
-- =====================================================

INSERT INTO templates_mensagem (codigo, nome, categoria, tipo, conteudo) VALUES
('boas_vindas', 'Mensagem de Boas-Vindas', 'geral', 'text', 
 '{"text": "👋 Olá! Sou seu assistente virtual para gerenciamento de Ordens de Serviço.\n\nPosso ajudá-lo a:\n✅ Criar novas ordens de serviço\n📋 Consultar suas ordens\n🔄 Atualizar status\n📄 Gerar PDFs\n\nComo posso ajudá-lo hoje?"}'),

('menu_principal', 'Menu Principal', 'menu', 'buttons',
 '{"text": "📱 Menu Principal\n\nEscolha uma opção:", "buttons": [{"type": "reply", "reply": {"id": "criar_os", "title": "➕ Nova OS"}}, {"type": "reply", "reply": {"id": "listar_os", "title": "📋 Minhas OS"}}, {"type": "reply", "reply": {"id": "ajuda", "title": "❓ Ajuda"}}]}'),

('os_criada_sucesso', 'OS Criada com Sucesso', 'ordem_servico', 'text',
 '{"text": "✅ Ordem de Serviço criada com sucesso!\n\n📋 Número: {{numero_os}}\n👤 Cliente: {{cliente_nome}}\n📝 Descrição: {{descricao}}\n📅 Data: {{data_abertura}}\n\n🔔 Deseja receber o PDF agora?"}'),

('status_atualizado', 'Status Atualizado', 'ordem_servico', 'text',
 '{"text": "🔄 Status atualizado!\n\n📋 OS: {{numero_os}}\n📊 Status Anterior: {{status_anterior}}\n✅ Novo Status: {{status_novo}}\n🕐 Atualizado em: {{data_atualizacao}}"}'),

('erro_generico', 'Erro Genérico', 'erro', 'text',
 '{"text": "😔 Desculpe, ocorreu um erro ao processar sua solicitação.\n\nPor favor, tente novamente ou entre em contato com o suporte."}'),

('os_nao_encontrada', 'OS Não Encontrada', 'erro', 'text',
 '{"text": "🔍 Ordem de Serviço não encontrada.\n\nVerifique o número e tente novamente."}');

-- =====================================================
-- POLÍTICAS RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS nas tabelas principais
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversas_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens_whatsapp ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver apenas seus próprios dados
CREATE POLICY usuarios_policy ON usuarios
    FOR ALL USING (auth.uid()::text = id::text);

-- Política: Usuários podem ver apenas suas próprias ordens de serviço
CREATE POLICY ordens_servico_policy ON ordens_servico
    FOR ALL USING (auth.uid()::text = usuario_id::text);

-- Política: Usuários podem ver apenas suas próprias conversas
CREATE POLICY conversas_policy ON conversas_whatsapp
    FOR ALL USING (auth.uid()::text = usuario_id::text);

-- Política: Usuários podem ver apenas suas próprias mensagens
CREATE POLICY mensagens_policy ON mensagens_whatsapp
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM conversas_whatsapp c 
            WHERE c.id = mensagens_whatsapp.conversa_id 
            AND c.usuario_id::text = auth.uid()::text
        )
    );

-- =====================================================
-- ÍNDICES ADICIONAIS PARA PERFORMANCE
-- =====================================================

CREATE INDEX idx_os_usuario_status ON ordens_servico(usuario_id, status);
CREATE INDEX idx_os_data_criacao ON ordens_servico(criado_em DESC);
CREATE INDEX idx_mensagens_processado ON mensagens_whatsapp(processado) WHERE processado = FALSE;
CREATE INDEX idx_conversas_ativo ON conversas_whatsapp(aguardando_resposta) WHERE aguardando_resposta = TRUE;

-- =====================================================
-- COMENTÁRIOS NAS TABELAS
-- =====================================================

COMMENT ON TABLE usuarios IS 'Gerencia usuários do WhatsApp que interagem com o assistente';
COMMENT ON TABLE ordens_servico IS 'Armazena todas as ordens de serviço do sistema';
COMMENT ON TABLE historico_os IS 'Registra todas as mudanças nas ordens de serviço para auditoria';
COMMENT ON TABLE pecas_os IS 'Gerencia peças utilizadas em cada ordem de serviço';
COMMENT ON TABLE conversas_whatsapp IS 'Mantém contexto das conversas com OpenAI';
COMMENT ON TABLE mensagens_whatsapp IS 'Histórico completo de mensagens trocadas';
COMMENT ON TABLE templates_mensagem IS 'Templates profissionais para respostas do assistente';

-- =====================================================
-- FIM DO SCHEMA
-- =====================================================
