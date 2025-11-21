import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega variáveis de ambiente
dotenv.config();

/**
 * Configurações centralizadas da aplicação
 * Todas as variáveis de ambiente são validadas e tipadas aqui
 */
export const config = {
  // Servidor
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    isDevelopment: process.env.NODE_ENV !== 'production',
    isProduction: process.env.NODE_ENV === 'production'
  },

  // Evolution API
  evolution: {
    apiUrl: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
    apiKey: process.env.EVOLUTION_API_KEY || '',
    instanceName: process.env.INSTANCE_NAME || 'OSZap'
  },

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000', 10),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7')
  },

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  },

  // Assistente
  assistant: {
    name: process.env.ASSISTANT_NAME || 'Assistente Virtual',
    messageTimeout: parseInt(process.env.MESSAGE_TIMEOUT || '30', 10) * 1000,
    maxMessageAgeMinutes: parseInt(process.env.MAX_MESSAGE_AGE_MINUTES || '5', 10),
    enableAudioProcessing: process.env.ENABLE_AUDIO_PROCESSING === 'true',
    enableImageProcessing: process.env.ENABLE_IMAGE_PROCESSING === 'true',
    enableGroupMessages: process.env.ENABLE_GROUP_MESSAGES === 'true'
  },

  // Webhook
  webhook: {
    url: process.env.WEBHOOK_URL || '',
    secret: process.env.WEBHOOK_SECRET || ''
  },

  // Logs
  logs: {
    level: process.env.LOG_LEVEL || 'info',
    saveToFile: process.env.SAVE_LOGS_TO_FILE === 'true',
    directory: process.env.LOGS_DIR || path.join(__dirname, '../../logs')
  },

  // Cache e Performance
  cache: {
    conversationTTL: parseInt(process.env.CONVERSATION_CACHE_TTL || '30', 10) * 60 * 1000,
    maxConversationHistory: parseInt(process.env.MAX_CONVERSATION_HISTORY || '20', 10)
  },

  // Arquivos temporários
  temp: {
    directory: process.env.TEMP_DIR || path.join(__dirname, '../../temp'),
    ttl: parseInt(process.env.TEMP_FILES_TTL || '24', 10) * 60 * 60 * 1000
  },

  // Segurança
  security: {
    allowedNumbers: process.env.ALLOWED_NUMBERS 
      ? process.env.ALLOWED_NUMBERS.split(',').map(n => n.trim()) 
      : [],
    blockedNumbers: process.env.BLOCKED_NUMBERS 
      ? process.env.BLOCKED_NUMBERS.split(',').map(n => n.trim()) 
      : []
  },

  // Rate Limiting
  rateLimit: {
    maxMessagesPerMinute: parseInt(process.env.MAX_MESSAGES_PER_MINUTE || '10', 10),
    messageCooldownMs: parseInt(process.env.MESSAGE_COOLDOWN_MS || '1000', 10)
  }
};

/**
 * Valida configurações obrigatórias
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validações obrigatórias
  if (!config.evolution.apiKey) {
    errors.push('EVOLUTION_API_KEY é obrigatória');
  }

  if (!config.openai.apiKey) {
    errors.push('OPENAI_API_KEY é obrigatória');
  }

  if (!config.supabase.url) {
    errors.push('SUPABASE_URL é obrigatória');
  }

  if (!config.supabase.key) {
    errors.push('SUPABASE_KEY é obrigatória');
  }

  // Validações de formato
  if (config.evolution.apiKey && config.evolution.apiKey.length < 10) {
    errors.push('EVOLUTION_API_KEY parece inválida (muito curta)');
  }

  if (config.openai.apiKey && !config.openai.apiKey.startsWith('sk-')) {
    errors.push('OPENAI_API_KEY deve começar com "sk-"');
  }

  if (config.supabase.url && !config.supabase.url.startsWith('https://')) {
    errors.push('SUPABASE_URL deve começar com "https://"');
  }

  // Validações de valores
  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push('PORT deve estar entre 1 e 65535');
  }

  if (config.openai.temperature < 0 || config.openai.temperature > 2) {
    errors.push('OPENAI_TEMPERATURE deve estar entre 0 e 2');
  }

  if (config.openai.maxTokens < 1 || config.openai.maxTokens > 4096) {
    errors.push('OPENAI_MAX_TOKENS deve estar entre 1 e 4096');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Exibe configurações (sem dados sensíveis)
 */
export function printConfig(): void {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║          CONFIGURAÇÕES DO ASSISTENTE VIRTUAL        ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  
  console.log('🖥️  Servidor:');
  console.log(`   ├─ Porta: ${config.server.port}`);
  console.log(`   ├─ Ambiente: ${config.server.nodeEnv}`);
  console.log(`   └─ URL Base: ${config.server.baseUrl}\n`);
  
  console.log('📱 Evolution API:');
  console.log(`   ├─ URL: ${config.evolution.apiUrl}`);
  console.log(`   ├─ API Key: ${maskString(config.evolution.apiKey)}`);
  console.log(`   └─ Instância: ${config.evolution.instanceName}\n`);
  
  console.log('🤖 OpenAI:');
  console.log(`   ├─ API Key: ${maskString(config.openai.apiKey)}`);
  console.log(`   ├─ Modelo: ${config.openai.model}`);
  console.log(`   ├─ Max Tokens: ${config.openai.maxTokens}`);
  console.log(`   └─ Temperature: ${config.openai.temperature}\n`);
  
  console.log('🗄️  Supabase:');
  console.log(`   ├─ URL: ${config.supabase.url}`);
  console.log(`   └─ Key: ${maskString(config.supabase.key)}\n`);
  
  console.log('⚙️  Assistente:');
  console.log(`   ├─ Nome: ${config.assistant.name}`);
  console.log(`   ├─ Áudio: ${config.assistant.enableAudioProcessing ? '✅' : '❌'}`);
  console.log(`   ├─ Imagem: ${config.assistant.enableImageProcessing ? '✅' : '❌'}`);
  console.log(`   └─ Grupos: ${config.assistant.enableGroupMessages ? '✅' : '❌'}\n`);
  
  console.log('🔒 Segurança:');
  console.log(`   ├─ Números Permitidos: ${config.security.allowedNumbers.length || 'Todos'}`);
  console.log(`   ├─ Números Bloqueados: ${config.security.blockedNumbers.length || 'Nenhum'}`);
  console.log(`   └─ Rate Limit: ${config.rateLimit.maxMessagesPerMinute} msgs/min\n`);
  
  console.log('════════════════════════════════════════════════════\n');
}

/**
 * Mascara strings sensíveis para exibição
 */
function maskString(str: string): string {
  if (!str || str.length < 8) return '****';
  return str.substring(0, 4) + '...' + str.substring(str.length - 4);
}

// Valida configurações ao carregar o módulo
const validation = validateConfig();
if (!validation.valid) {
  console.error('\n❌ ERRO: Configurações inválidas!\n');
  validation.errors.forEach(error => {
    console.error(`   • ${error}`);
  });
  console.error('\n💡 Verifique seu arquivo .env e tente novamente.\n');
  
  if (config.server.isProduction) {
    process.exit(1);
  }
}

export default config;
