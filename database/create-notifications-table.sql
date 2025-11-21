-- =====================================================
-- TABELA DE NOTIFICAÇÕES AGENDADAS
-- =====================================================

-- Cria tabela de notificações
CREATE TABLE IF NOT EXISTS notificacoes_agendadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  ordem_servico_id INTEGER REFERENCES ordens_servico(id) ON DELETE CASCADE,
  
  -- Tipo de notificação
  tipo VARCHAR(50) NOT NULL, -- 'lembrete', 'conclusao', 'atualizacao', 'pdf', 'custom'
  
  -- Destinatário
  destinatario_telefone VARCHAR(20) NOT NULL,
  destinatario_nome VARCHAR(255),
  
  -- Conteúdo
  titulo VARCHAR(255) NOT NULL,
  mensagem TEXT NOT NULL,
  
  -- Anexos
  enviar_pdf BOOLEAN DEFAULT false,
  anexo_url TEXT,
  
  -- Agendamento
  data_agendada TIMESTAMPTZ NOT NULL,
  enviar_em TIMESTAMPTZ NOT NULL, -- Quando realmente enviar
  
  -- Status
  status VARCHAR(20) DEFAULT 'pendente', -- 'pendente', 'enviada', 'erro', 'cancelada'
  enviada_em TIMESTAMPTZ,
  erro_mensagem TEXT,
  tentativas INTEGER DEFAULT 0,
  
  -- Recorrência (opcional)
  recorrente BOOLEAN DEFAULT false,
  intervalo_dias INTEGER,
  proxima_execucao TIMESTAMPTZ,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notificacoes_status ON notificacoes_agendadas(status);
CREATE INDEX IF NOT EXISTS idx_notificacoes_enviar_em ON notificacoes_agendadas(enviar_em);
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario ON notificacoes_agendadas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_os ON notificacoes_agendadas(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_pendentes ON notificacoes_agendadas(status, enviar_em) 
  WHERE status = 'pendente';

-- =====================================================
-- TABELA DE TRIGGERS/EVENTOS AUTOMÁTICOS
-- =====================================================

CREATE TABLE IF NOT EXISTS triggers_automaticos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- Tipo de trigger
  tipo_evento VARCHAR(50) NOT NULL, -- 'os_concluida', 'os_atualizada', 'status_mudou', 'data_chegando'
  
  -- Condições
  condicoes JSONB NOT NULL, -- Ex: {"status": "concluida"}, {"prioridade": "urgente"}
  
  -- Ação
  tipo_acao VARCHAR(50) NOT NULL, -- 'enviar_notificacao', 'enviar_pdf', 'criar_os', 'atualizar_campo'
  parametros_acao JSONB NOT NULL,
  
  -- Status
  ativo BOOLEAN DEFAULT true,
  
  -- Estatísticas
  execucoes INTEGER DEFAULT 0,
  ultima_execucao TIMESTAMPTZ,
  
  -- Timestamps
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_triggers_usuario ON triggers_automaticos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_triggers_tipo ON triggers_automaticos(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_triggers_ativos ON triggers_automaticos(ativo) WHERE ativo = true;

-- =====================================================
-- FUNÇÕES AUXILIARES
-- =====================================================

-- Atualiza timestamp automaticamente
CREATE OR REPLACE FUNCTION update_notificacao_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notificacao_timestamp
  BEFORE UPDATE ON notificacoes_agendadas
  FOR EACH ROW
  EXECUTE FUNCTION update_notificacao_timestamp();

CREATE TRIGGER trigger_update_trigger_timestamp
  BEFORE UPDATE ON triggers_automaticos
  FOR EACH ROW
  EXECUTE FUNCTION update_notificacao_timestamp();

-- =====================================================
-- POLÍTICAS RLS
-- =====================================================

-- Habilita RLS
ALTER TABLE notificacoes_agendadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE triggers_automaticos ENABLE ROW LEVEL SECURITY;

-- Políticas para notificações
DROP POLICY IF EXISTS "Usuários podem ver suas notificações" ON notificacoes_agendadas;
CREATE POLICY "Usuários podem ver suas notificações" ON notificacoes_agendadas
  FOR SELECT USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Usuários podem criar notificações" ON notificacoes_agendadas;
CREATE POLICY "Usuários podem criar notificações" ON notificacoes_agendadas
  FOR INSERT WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Service role tem acesso total - notificações" ON notificacoes_agendadas;
CREATE POLICY "Service role tem acesso total - notificações" ON notificacoes_agendadas
  FOR ALL USING (true);

-- Políticas para triggers
DROP POLICY IF EXISTS "Usuários podem ver seus triggers" ON triggers_automaticos;
CREATE POLICY "Usuários podem ver seus triggers" ON triggers_automaticos
  FOR SELECT USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Usuários podem criar triggers" ON triggers_automaticos;
CREATE POLICY "Usuários podem criar triggers" ON triggers_automaticos
  FOR INSERT WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Service role tem acesso total - triggers" ON triggers_automaticos;
CREATE POLICY "Service role tem acesso total - triggers" ON triggers_automaticos
  FOR ALL USING (true);

-- =====================================================
-- VIEWS ÚTEIS
-- =====================================================

-- View de notificações pendentes prontas para envio
CREATE OR REPLACE VIEW notificacoes_prontas_envio AS
SELECT 
  n.*,
  u.telefone as usuario_telefone,
  u.nome as usuario_nome,
  os.numero_os,
  os.titulo as os_titulo
FROM notificacoes_agendadas n
LEFT JOIN usuarios u ON n.usuario_id = u.id
LEFT JOIN ordens_servico os ON n.ordem_servico_id = os.id
WHERE n.status = 'pendente'
  AND n.enviar_em <= NOW()
ORDER BY n.enviar_em ASC;

COMMENT ON TABLE notificacoes_agendadas IS 'Notificações agendadas para envio via WhatsApp';
COMMENT ON TABLE triggers_automaticos IS 'Triggers automáticos baseados em eventos do sistema';

