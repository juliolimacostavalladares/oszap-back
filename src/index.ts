import express, { Express } from 'express';
import cors from 'cors';
import { config, printConfig } from './config/env.js';

// Rotas
import webhookRoutes from './routes/webhook.routes.js';
import leadRoutes from './routes/lead.routes.js';

// Serviços
import { NotificationService } from './services/NotificationService.js';

/**
 * =====================================================
 * ASSISTENTE VIRTUAL DE WHATSAPP
 * Sistema de Gerenciamento de Ordens de Serviço com IA
 * =====================================================
 */

const app: Express = express();

// =====================================================
// MIDDLEWARES
// =====================================================

// CORS - Permite requisições da Landing Page
app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições sem origin (Postman, curl, etc)
    if (!origin) return callback(null, true);
    
    // Lista de domínios permitidos
    const allowedOrigins = [
      'https://oszap.com.br',
      'https://www.oszap.com.br',
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    // Permite TODOS os domínios ngrok (desenvolvimento)
    if (origin.includes('ngrok-free.app') || origin.includes('ngrok.io')) {
      return callback(null, true);
    }
    
    // Verifica se está na lista OU é desenvolvimento
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // Bloqueia origem não autorizada
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
  exposedHeaders: ['Content-Length', 'Content-Type']
}));

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logger de requisições
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Servir arquivos estáticos (PDFs, etc)
app.use('/temp', express.static(config.temp.directory));

// =====================================================
// ROTAS
// =====================================================

app.use('/webhook', webhookRoutes);
app.use('/api/leads', leadRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Assistente Virtual de WhatsApp',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    service: 'Assistente Virtual de WhatsApp',
    version: '2.0.0',
    status: 'online',
    features: [
      'Gerenciamento de Ordens de Serviço',
      'Assistente IA com OpenAI',
      'Processamento de áudio e texto',
      'Elementos nativos do WhatsApp',
      'Geração de PDFs',
      'Histórico completo'
    ],
    endpoints: {
      health: '/health',
      webhook: '/webhook'
    }
  });
});

// =====================================================
// TRATAMENTO DE ERROS
// =====================================================

// Rota não encontrada
app.use((req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.path,
    method: req.method
  });
});

// Handler de erros global
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[ERROR] Erro não tratado:', err);
  
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno do servidor',
    ...(config.server.isDevelopment && { stack: err.stack })
  });
});

// =====================================================
// INICIALIZAÇÃO DO SERVIDOR
// =====================================================

async function startServer() {
  try {
    console.log('\n🚀 Iniciando Assistente Virtual de WhatsApp...\n');

    // Exibe configurações
    printConfig();

    // Verifica conexão com Supabase
    console.log('🗄️  Verificando conexão com Supabase...');
    try {
      const { supabase } = await import('./config/supabase.js');
      const { data, error } = await supabase.from('usuarios').select('count').limit(1);
      if (error && error.code !== 'PGRST116') throw error;
      console.log('✅ Supabase conectado!\n');
    } catch (error: any) {
      console.error('❌ Erro ao conectar com Supabase:', error.message);
      console.error('⚠️  O sistema continuará, mas sem acesso ao banco de dados.\n');
    }

    // Verifica conexão com Evolution API
    console.log('📱 Verificando conexão com Evolution API...');
    try {
      const { EvolutionService } = await import('./services/EvolutionService.js');
      const evolutionService = new EvolutionService();
      const instanceStatus = await evolutionService.getInstanceStatus();
      console.log(`✅ Evolution API conectada!`);
      if (instanceStatus && Array.isArray(instanceStatus) && instanceStatus.length > 0) {
        console.log(`   ├─ Instância: ${instanceStatus[0].instance?.instanceName || 'N/A'}`);
        console.log(`   └─ Status: ${instanceStatus[0].instance?.state || 'N/A'}\n`);
      } else {
        console.log(`   └─ Nenhuma instância encontrada\n`);
      }
    } catch (error: any) {
      console.error('❌ Erro ao conectar com Evolution API:', error.message);
      console.error('⚠️  Verifique se a Evolution API está rodando e as credenciais estão corretas.\n');
    }

    // Verifica conexão com OpenAI
    console.log('🤖 Verificando conexão com OpenAI...');
    try {
      const { OpenAIAssistantService } = await import('./services/OpenAIAssistantService.js');
      const openaiService = new OpenAIAssistantService();
      console.log('✅ OpenAI configurada!\n');
    } catch (error: any) {
      console.error('❌ Erro ao configurar OpenAI:', error.message);
      console.error('⚠️  O assistente IA não funcionará sem uma API key válida.\n');
    }

    // Inicia servidor
    app.listen(config.server.port, () => {
      console.log('═══════════════════════════════════════════════════');
      console.log('🎉 SERVIDOR INICIADO COM SUCESSO!');
      console.log('═══════════════════════════════════════════════════');
      console.log(`\n📍 Servidor rodando em: ${config.server.baseUrl}`);
      console.log(`📱 Webhook: ${config.server.baseUrl}/webhook`);
      console.log(`💚 Health check: ${config.server.baseUrl}/health`);
      console.log('\n═══════════════════════════════════════════════════');
      console.log('⚙️  CONFIGURAÇÕES IMPORTANTES:');
      console.log('═══════════════════════════════════════════════════');
      console.log(`✅ Processamento de Áudio: ${config.assistant.enableAudioProcessing ? 'Habilitado' : 'Desabilitado'}`);
      console.log(`✅ Processamento de Imagens: ${config.assistant.enableImageProcessing ? 'Habilitado' : 'Desabilitado'}`);
      console.log(`✅ Mensagens de Grupos: ${config.assistant.enableGroupMessages ? 'Habilitado' : 'Desabilitado'}`);
      console.log(`✅ Rate Limit: ${config.rateLimit.maxMessagesPerMinute} mensagens/minuto`);
      console.log('\n═══════════════════════════════════════════════════');
      console.log('📝 PRÓXIMOS PASSOS:');
      console.log('═══════════════════════════════════════════════════');
      console.log('1. Configure o webhook na Evolution API:');
      console.log(`   URL: ${config.server.baseUrl}/webhook`);
      console.log('   Eventos: messages.upsert, connection.update');
      console.log('\n2. Execute o schema SQL no Supabase:');
      console.log('   Arquivo: database/schema.sql');
      console.log('\n3. Teste enviando uma mensagem para seu WhatsApp!');
      console.log('\n═══════════════════════════════════════════════════\n');
      
      console.log('💡 Dica: Use Ctrl+C para parar o servidor\n');
    });

  } catch (error: any) {
    console.error('\n❌ ERRO FATAL ao iniciar servidor:', error);
    process.exit(1);
  }
}

// =====================================================
// TRATAMENTO DE SINAIS E ERROS NÃO TRATADOS
// =====================================================

process.on('SIGINT', () => {
  console.log('\n\n🛑 Servidor encerrado pelo usuário (SIGINT)');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Servidor encerrado (SIGTERM)');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
  console.error('Promise:', promise);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// =====================================================
// SISTEMA DE NOTIFICAÇÕES AUTOMÁTICAS
// =====================================================

const notificationService = new NotificationService();

// Processa notificações pendentes a cada 30 segundos
const NOTIFICATION_INTERVAL = 30 * 1000; // 30 segundos

console.log('\n🔔 Iniciando sistema de notificações automáticas...');
console.log(`⏰ Processamento a cada ${NOTIFICATION_INTERVAL / 1000} segundos\n`);

// Primeira execução imediata
(async () => {
  try {
    console.log('🔄 Primeira verificação de notificações...');
    const processadas = await notificationService.processarNotificacoesPendentes();
    if (processadas > 0) {
      console.log(`✅ ${processadas} notificações processadas na inicialização`);
    }
  } catch (error) {
    console.error('❌ Erro ao processar notificações na inicialização:', error);
  }
})();

// Cron job - executa periodicamente
setInterval(async () => {
  try {
    const processadas = await notificationService.processarNotificacoesPendentes();
    if (processadas > 0) {
      console.log(`\n🔔 ${processadas} notificação(ões) enviada(s) com sucesso!`);
    }
  } catch (error) {
    console.error('❌ Erro ao processar notificações:', error);
  }
}, NOTIFICATION_INTERVAL);

// Inicia o servidor
startServer();

export default app;
