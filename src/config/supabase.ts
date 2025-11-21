// Carregar variáveis de ambiente primeiro
import './env.js';

import { createClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase para acesso ao banco de dados
 * Usa SERVICE_ROLE_KEY para bypassar RLS e ter acesso completo
 */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_KEY) devem estar configurados no .env');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export default supabase;

