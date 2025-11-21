-- =====================================================
-- TABELA DE LEADS DA LANDING PAGE
-- =====================================================
-- Captura leads interessados no OSZap
-- =====================================================

-- Cria a tabela de leads
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  telefone VARCHAR(20),
  feedback TEXT,
  origem VARCHAR(50) DEFAULT 'landing_page',
  status VARCHAR(50) DEFAULT 'novo',
  convertido_em_usuario BOOLEAN DEFAULT FALSE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  primeira_mensagem_enviada BOOLEAN DEFAULT FALSE,
  data_primeira_mensagem TIMESTAMP WITH TIME ZONE
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_telefone ON leads(telefone);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_criado_em ON leads(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_leads_convertido ON leads(convertido_em_usuario) WHERE convertido_em_usuario = TRUE;

-- Função para atualizar timestamp
CREATE OR REPLACE FUNCTION atualizar_lead_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar automaticamente o timestamp
DROP TRIGGER IF EXISTS trigger_atualizar_lead_timestamp ON leads;
CREATE TRIGGER trigger_atualizar_lead_timestamp
BEFORE UPDATE ON leads
FOR EACH ROW
EXECUTE FUNCTION atualizar_lead_timestamp();

-- View para estatísticas de leads
CREATE OR REPLACE VIEW view_estatisticas_leads AS
SELECT 
  COUNT(*) as total_leads,
  COUNT(*) FILTER (WHERE convertido_em_usuario = TRUE) as leads_convertidos,
  COUNT(*) FILTER (WHERE status = 'novo') as leads_novos,
  COUNT(*) FILTER (WHERE status = 'contatado') as leads_contatados,
  COUNT(*) FILTER (WHERE primeira_mensagem_enviada = TRUE) as com_mensagem_enviada,
  COUNT(*) FILTER (WHERE criado_em >= NOW() - INTERVAL '7 days') as leads_ultimos_7_dias,
  COUNT(*) FILTER (WHERE criado_em >= NOW() - INTERVAL '30 days') as leads_ultimos_30_dias,
  ROUND(
    (COUNT(*) FILTER (WHERE convertido_em_usuario = TRUE)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 
    2
  ) as taxa_conversao_pct
FROM leads;

-- Comentários
COMMENT ON TABLE leads IS 'Leads capturados da Landing Page';
COMMENT ON COLUMN leads.nome IS 'Nome do lead';
COMMENT ON COLUMN leads.email IS 'Email do lead (único)';
COMMENT ON COLUMN leads.telefone IS 'Telefone do lead (opcional)';
COMMENT ON COLUMN leads.feedback IS 'Feedback deixado pelo lead na LP';
COMMENT ON COLUMN leads.origem IS 'Origem do lead (landing_page, indicacao, etc)';
COMMENT ON COLUMN leads.status IS 'Status do lead (novo, contatado, qualificado, convertido)';
COMMENT ON COLUMN leads.convertido_em_usuario IS 'Se o lead virou usuário do sistema';
COMMENT ON COLUMN leads.primeira_mensagem_enviada IS 'Se já foi enviada mensagem de boas-vindas';

-- =====================================================
-- PERMISSÕES RLS (Row Level Security)
-- =====================================================
-- Ativa RLS na tabela
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Política: Service role tem acesso total (para API)
DROP POLICY IF EXISTS "Service role tem acesso total aos leads" ON leads;
CREATE POLICY "Service role tem acesso total aos leads"
  ON leads FOR ALL
  USING (true);

-- =====================================================
-- FUNÇÃO PARA REGISTRAR LEAD
-- =====================================================
CREATE OR REPLACE FUNCTION registrar_lead(
  p_nome VARCHAR,
  p_email VARCHAR,
  p_telefone VARCHAR DEFAULT NULL,
  p_feedback TEXT DEFAULT NULL,
  p_origem VARCHAR DEFAULT 'landing_page'
)
RETURNS JSON AS $$
DECLARE
  v_lead_id INTEGER;
  v_ja_existe BOOLEAN;
BEGIN
  -- Verifica se o email já existe
  SELECT EXISTS(SELECT 1 FROM leads WHERE email = p_email) INTO v_ja_existe;
  
  IF v_ja_existe THEN
    -- Atualiza o lead existente
    UPDATE leads 
    SET 
      nome = p_nome,
      telefone = COALESCE(p_telefone, telefone),
      feedback = COALESCE(p_feedback, feedback),
      atualizado_em = CURRENT_TIMESTAMP
    WHERE email = p_email
    RETURNING id INTO v_lead_id;
    
    RETURN json_build_object(
      'success', true,
      'lead_id', v_lead_id,
      'novo', false,
      'mensagem', 'Lead atualizado com sucesso'
    );
  ELSE
    -- Insere novo lead
    INSERT INTO leads (nome, email, telefone, feedback, origem)
    VALUES (p_nome, p_email, p_telefone, p_feedback, p_origem)
    RETURNING id INTO v_lead_id;
    
    RETURN json_build_object(
      'success', true,
      'lead_id', v_lead_id,
      'novo', true,
      'mensagem', 'Lead registrado com sucesso'
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================
SELECT 'Tabela de leads criada com sucesso!' as status;

