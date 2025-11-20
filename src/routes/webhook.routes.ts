import { Router } from 'express';
import { WebhookHandler } from '../middleware/webhook.js';
import type { WhatsAppHandler } from '../handlers/WhatsAppHandler.js';

/**
 * Rotas de webhook do Evolution API
 */
export function createWebhookRoutes(whatsappHandler: WhatsAppHandler | null): Router {
  const router = Router();
  
  if (!whatsappHandler) {
    router.post('/', (_req, res) => {
      res.status(503).json({ 
        error: 'WhatsApp Handler não disponível. Evolution API não está configurada.' 
      });
    });
    return router;
  }

  const webhookHandler = new WebhookHandler(whatsappHandler);

  // Webhook para receber mensagens do Evolution API
  // Evolution API pode chamar diferentes rotas, então aceitamos todas
  router.post('/', webhookHandler.handle);
  router.post('/*', webhookHandler.handle); // Aceita qualquer rota como /webhook/remove-instance, etc

  return router;
}

