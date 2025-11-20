-- Schema SQL para Supabase
-- Execute este script no SQL Editor do Supabase

-- Criar tabela de Ordens de Serviço
CREATE TABLE IF NOT EXISTS orders_service (
  id BIGSERIAL PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  pdf_path TEXT
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_orders_service_created_at ON orders_service(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_service_status ON orders_service(status);
-- Nota: O índice em created_at já otimiza consultas por data, não é necessário índice adicional

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at
CREATE TRIGGER update_orders_service_updated_at
  BEFORE UPDATE ON orders_service
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentários nas colunas
COMMENT ON TABLE orders_service IS 'Tabela de Ordens de Serviço';
COMMENT ON COLUMN orders_service.services IS 'Array JSON com os serviços realizados';
COMMENT ON COLUMN orders_service.status IS 'Status da OS: pendente, em_andamento, concluida';

