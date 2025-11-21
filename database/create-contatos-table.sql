-- =====================================================
-- TABELA DE CONTATOS PARA ENVIO DE MENSAGENS
-- =====================================================
-- Permite salvar contatos para facilitar envio de mensagens
-- sem depender da busca de contatos do WhatsApp
-- =====================================================

-- Cria a tabela de contatos
CREATE TABLE IF NOT EXISTS contatos (
  id SERIAL PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  observacoes TEXT,
  favorito BOOLEAN DEFAULT FALSE,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Garante que não haja contatos duplicados para o mesmo usuário
  UNIQUE(usuario_id, telefone)
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_contatos_usuario ON contatos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_contatos_nome ON contatos(nome);
CREATE INDEX IF NOT EXISTS idx_contatos_telefone ON contatos(telefone);
CREATE INDEX IF NOT EXISTS idx_contatos_favorito ON contatos(favorito) WHERE favorito = TRUE;

-- Função para atualizar o campo atualizado_em automaticamente
CREATE OR REPLACE FUNCTION atualizar_contato_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar automaticamente o timestamp
DROP TRIGGER IF EXISTS trigger_atualizar_contato_timestamp ON contatos;
CREATE TRIGGER trigger_atualizar_contato_timestamp
BEFORE UPDATE ON contatos
FOR EACH ROW
EXECUTE FUNCTION atualizar_contato_timestamp();

-- View para listar contatos com informações úteis
CREATE OR REPLACE VIEW view_contatos_usuario AS
SELECT 
  c.id,
  c.usuario_id,
  c.nome,
  c.telefone,
  c.email,
  c.observacoes,
  c.favorito,
  c.criado_em,
  c.atualizado_em,
  COUNT(DISTINCT os.id) as total_os,
  MAX(os.data_abertura) as ultima_os_data
FROM contatos c
LEFT JOIN ordens_servico os ON 
  os.usuario_id = c.usuario_id AND 
  (os.cliente_telefone = c.telefone OR os.cliente_nome = c.nome)
GROUP BY c.id, c.usuario_id, c.nome, c.telefone, c.email, c.observacoes, c.favorito, c.criado_em, c.atualizado_em;

-- Comentários nas tabelas
COMMENT ON TABLE contatos IS 'Contatos salvos para envio de mensagens via WhatsApp';
COMMENT ON COLUMN contatos.usuario_id IS 'ID do usuário dono do contato';
COMMENT ON COLUMN contatos.nome IS 'Nome do contato';
COMMENT ON COLUMN contatos.telefone IS 'Número de telefone (formato internacional)';
COMMENT ON COLUMN contatos.email IS 'Email do contato (opcional)';
COMMENT ON COLUMN contatos.observacoes IS 'Observações sobre o contato';
COMMENT ON COLUMN contatos.favorito IS 'Se o contato está marcado como favorito';

-- =====================================================
-- DADOS DE EXEMPLO (OPCIONAL - REMOVA EM PRODUÇÃO)
-- =====================================================
-- Insere alguns contatos de exemplo para o primeiro usuário
-- REMOVA ESSES INSERTs EM PRODUÇÃO!
/*
INSERT INTO contatos (usuario_id, nome, telefone, observacoes, favorito)
SELECT 
  u.id,
  'Rafael Silva',
  '5522992531720',
  'Cliente frequente - Serviços de manutenção',
  TRUE
FROM usuarios u
LIMIT 1
ON CONFLICT (usuario_id, telefone) DO NOTHING;
*/

-- =====================================================
-- PERMISSÕES RLS (Row Level Security)
-- =====================================================
-- Ativa RLS na tabela
ALTER TABLE contatos ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver apenas seus próprios contatos
DROP POLICY IF EXISTS "Usuários podem ver seus próprios contatos" ON contatos;
CREATE POLICY "Usuários podem ver seus próprios contatos"
  ON contatos FOR SELECT
  USING (auth.uid() = usuario_id);

-- Política: Usuários podem inserir contatos para si mesmos
DROP POLICY IF EXISTS "Usuários podem criar seus próprios contatos" ON contatos;
CREATE POLICY "Usuários podem criar seus próprios contatos"
  ON contatos FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

-- Política: Usuários podem atualizar seus próprios contatos
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios contatos" ON contatos;
CREATE POLICY "Usuários podem atualizar seus próprios contatos"
  ON contatos FOR UPDATE
  USING (auth.uid() = usuario_id);

-- Política: Usuários podem deletar seus próprios contatos
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios contatos" ON contatos;
CREATE POLICY "Usuários podem deletar seus próprios contatos"
  ON contatos FOR DELETE
  USING (auth.uid() = usuario_id);

-- Política SERVICE ROLE: Acesso total para operações do backend
DROP POLICY IF EXISTS "Service role tem acesso total aos contatos" ON contatos;
CREATE POLICY "Service role tem acesso total aos contatos"
  ON contatos FOR ALL
  USING (true);

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================
SELECT 'Tabela de contatos criada com sucesso!' as status;

