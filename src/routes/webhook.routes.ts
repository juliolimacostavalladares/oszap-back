import { Router, Request, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { WhatsAppHandler } from '../handlers/WhatsAppHandler.js';

const router: ExpressRouter = Router();
const whatsappHandler = new WhatsAppHandler();

/**
 * Rota principal do webhook
 * Processa todos os eventos da Evolution API
 */
const handleWebhook = async (req: Request, res: Response) => {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    const { event, instance, data } = req.body;
    
    console.log('======================== WEBHOOK ========================');
    console.log(`[Webhook][${requestId}] Evento: ${event}`);
    console.log(`[Webhook][${requestId}] Instância: ${instance}`);
    console.log(`[Webhook][${requestId}] Dados:`, JSON.stringify(data, null, 2));
    console.log('=========================================================');

    // Responde imediatamente para não deixar a Evolution API esperando
    res.status(200).json({ received: true, requestId });

    // Processa o evento de forma assíncrona
    setImmediate(async () => {
      try {
        await processWebhookEvent(event, data, requestId);
      } catch (error) {
        console.error(`[Webhook][${requestId}] Erro ao processar evento:`, error);
      }
    });

  } catch (error: any) {
    console.error(`[Webhook][${requestId}] Erro no webhook:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Rotas do webhook - aceita tanto / quanto rotas específicas
router.post('/', handleWebhook);
router.post('/messages-upsert', handleWebhook);
router.post('/messages-update', handleWebhook);
router.post('/chats-update', handleWebhook);
router.post('/chats-upsert', handleWebhook);
router.post('/contacts-update', handleWebhook);
router.post('/contacts-upsert', handleWebhook);
router.post('/connection-update', handleWebhook);
router.post('/presence-update', handleWebhook);
router.post('/groups-update', handleWebhook);
router.post('/groups-upsert', handleWebhook);
router.post('/qrcode-updated', handleWebhook);

/**
 * Processa eventos do webhook
 */
async function processWebhookEvent(event: string, data: any, requestId: string): Promise<void> {
  try {
    switch (event) {
      case 'messages.upsert':
        await handleMessageUpsert(data, requestId);
        break;

      case 'messages.update':
        console.log(`[Webhook][${requestId}] Mensagem atualizada (ignorado)`);
        break;

      case 'connection.update':
        await handleConnectionUpdate(data, requestId);
        break;

      case 'qrcode.updated':
        console.log(`[Webhook][${requestId}] QR Code atualizado`);
        break;

      case 'chats.update':
      case 'chats.upsert':
        console.log(`[Webhook][${requestId}] Chat atualizado (ignorado)`);
        break;

      case 'contacts.update':
      case 'contacts.upsert':
        console.log(`[Webhook][${requestId}] Contato atualizado (ignorado)`);
        break;

      case 'presence.update':
        console.log(`[Webhook][${requestId}] Presença atualizada (ignorado)`);
        break;

      case 'groups.update':
      case 'groups.upsert':
        console.log(`[Webhook][${requestId}] Grupo atualizado (ignorado)`);
        break;

      default:
        console.log(`[Webhook][${requestId}] Evento não tratado: ${event}`);
    }
  } catch (error) {
    console.error(`[Webhook][${requestId}] Erro ao processar evento ${event}:`, error);
    throw error;
  }
}

/**
 * Processa novas mensagens
 */
async function handleMessageUpsert(data: any, requestId: string): Promise<void> {
  try {
    console.log(`[Webhook][${requestId}] ✉️  Nova mensagem recebida`);

    // Validações básicas
    if (!data || !data.key) {
      console.log(`[Webhook][${requestId}] ⚠️  Dados de mensagem inválidos`);
      return;
    }

    // Ignora mensagens de grupos por enquanto (pode ser habilitado depois)
    if (data.key.remoteJid?.includes('@g.us')) {
      console.log(`[Webhook][${requestId}] 👥 Mensagem de grupo ignorada`);
      return;
    }

    // Ignora mensagens de status/broadcast
    if (data.key.remoteJid?.includes('@broadcast') || data.key.remoteJid?.includes('status@broadcast')) {
      console.log(`[Webhook][${requestId}] 📢 Mensagem de status/broadcast ignorada`);
      return;
    }

    // Ignora mensagens enviadas pelo próprio bot (fromMe: true)
    if (data.key.fromMe === true) {
      console.log(`[Webhook][${requestId}] 🤖 Mensagem própria ignorada (fromMe: true)`);
      return;
    }

    // Ignora mensagens muito antigas (mais de 5 minutos)
    const messageTimestamp = data.messageTimestamp ? parseInt(data.messageTimestamp) * 1000 : Date.now();
    const messageAge = Date.now() - messageTimestamp;
    const MAX_MESSAGE_AGE = 5 * 60 * 1000; // 5 minutos

    if (messageAge > MAX_MESSAGE_AGE) {
      console.log(`[Webhook][${requestId}] ⏰ Mensagem muito antiga ignorada (${Math.floor(messageAge / 1000)}s)`);
      return;
    }

    // Log detalhado para debug de áudio
    if (data.messageType === 'audioMessage') {
      console.log(`[Webhook][${requestId}] 🎤 ÁUDIO RECEBIDO - speechToText presente?`, !!data.speechToText);
      console.log(`[Webhook][${requestId}] 🎤 Campos em data:`, Object.keys(data));
      console.log(`[Webhook][${requestId}] 🎤 Campos em data.message:`, data.message ? Object.keys(data.message) : 'N/A');
      console.log(`[Webhook][${requestId}] 🎤 Tem base64?`, {
        'data.message.audioMessage.base64': !!(data.message?.audioMessage?.base64),
        'data.message.base64': !!(data.message?.base64),
      });
    }

    // Processa a mensagem
    console.log(`[Webhook][${requestId}] 🤖 Processando com assistente IA...`);
    await whatsappHandler.handleMessage(data);
    console.log(`[Webhook][${requestId}] ✅ Mensagem processada com sucesso`);

  } catch (error: any) {
    console.error(`[Webhook][${requestId}] ❌ Erro ao processar mensagem:`, error.message);
    throw error;
  }
}

/**
 * Processa atualizações de conexão
 */
async function handleConnectionUpdate(data: any, requestId: string): Promise<void> {
  try {
    console.log(`[Webhook][${requestId}] 🔌 Atualização de conexão:`, data);
    await whatsappHandler.handleConnectionUpdate(data);
  } catch (error) {
    console.error(`[Webhook][${requestId}] Erro ao processar atualização de conexão:`, error);
  }
}

/**
 * Rota de health check do webhook
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'webhook',
    timestamp: new Date().toISOString()
  });
});

/**
 * Rota para limpar histórico de conversa (útil para debug/testes)
 */
router.post('/clear-history', (req: Request, res: Response) => {
  try {
    const { userPhone, chatId } = req.body;

    if (!userPhone || !chatId) {
      return res.status(400).json({
        error: 'userPhone e chatId são obrigatórios'
      });
    }

    whatsappHandler.clearUserHistory(userPhone, chatId);

    res.json({
      success: true,
      message: 'Histórico limpo com sucesso'
    });
  } catch (error: any) {
    console.error('[Webhook] Erro ao limpar histórico:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
