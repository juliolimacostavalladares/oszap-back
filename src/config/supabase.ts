// Carregar variáveis de ambiente primeiro
import './env.js';

import { createClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase para acesso ao banco de dados
 */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL e SUPABASE_ANON_KEY devem estar configurados no .env');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;

