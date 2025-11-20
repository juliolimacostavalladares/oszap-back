/**
 * Configuração de variáveis de ambiente
 * Este arquivo DEVE ser importado antes de qualquer outro módulo que use process.env
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar .env da raiz do projeto
const envPath = path.resolve(__dirname, '../../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn(`⚠️  Aviso: Não foi possível carregar .env de ${envPath}`);
  console.warn('   Tentando carregar do diretório atual...');
  dotenv.config(); // Tenta carregar do diretório atual
}

// Validar variáveis obrigatórias
const requiredEnvVars = [
  'GEMINI_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Variáveis de ambiente obrigatórias não encontradas:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\n💡 Certifique-se de que o arquivo .env existe na raiz do projeto.');
  console.error('💡 Veja SETUP_ENV.md para mais informações.\n');
  process.exit(1);
}

export {};

