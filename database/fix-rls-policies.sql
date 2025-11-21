-- =====================================================
-- FIX: Políticas RLS para Service Role
-- =====================================================
-- Este script corrige as políticas RLS para permitir que
-- a aplicação (usando SERVICE_ROLE_KEY) acesse as tabelas

-- Remove políticas antigas
DROP POLICY IF EXISTS usuarios_policy ON usuarios;
DROP POLICY IF EXISTS ordens_servico_policy ON ordens_servico;
DROP POLICY IF EXISTS conversas_policy ON conversas_whatsapp;
DROP POLICY IF EXISTS mensagens_policy ON mensagens_whatsapp;

-- =====================================================
-- NOVAS POLÍTICAS: Permitem acesso via Service Role
-- =====================================================

-- Política: Service Role pode fazer tudo na tabela usuarios
CREATE POLICY usuarios_service_role_policy ON usuarios
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Política: Service Role pode fazer tudo na tabela ordens_servico
CREATE POLICY ordens_servico_service_role_policy ON ordens_servico
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Política: Service Role pode fazer tudo na tabela conversas_whatsapp
CREATE POLICY conversas_service_role_policy ON conversas_whatsapp
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Política: Service Role pode fazer tudo na tabela mensagens_whatsapp
CREATE POLICY mensagens_service_role_policy ON mensagens_whatsapp
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================
-- Execute estas queries para verificar se as políticas foram aplicadas:
-- 
-- SELECT schemaname, tablename, policyname 
-- FROM pg_policies 
-- WHERE tablename IN ('usuarios', 'ordens_servico', 'conversas_whatsapp', 'mensagens_whatsapp');

