import { Router } from 'express';
import { createHealthRoutes } from './health.routes.js';
import { createOrderServiceRoutes } from './orderService.routes.js';
import { createBalanceRoutes } from './balance.routes.js';
import { createWhatsAppRoutes } from './whatsapp.routes.js';
import { createWebhookRoutes } from './webhook.routes.js';
import { OrderServiceService } from '../services/OrderServiceService.js';
import type { WhatsAppHandler } from '../handlers/WhatsAppHandler.js';

/**
 * Configuração central de todas as rotas da aplicação
 * Organiza as rotas em grupos lógicos
 */
export function createRoutes(
  orderServiceService: OrderServiceService,
  whatsappHandler: WhatsAppHandler | null
): Router {
  const router = Router();

  // Health check
  router.use(createHealthRoutes());

  // Rotas de WhatsApp
  router.use('/whatsapp', createWhatsAppRoutes());

  // Rotas de API - Ordens de Serviço
  router.use('/api/os', createOrderServiceRoutes(orderServiceService));

  // Rotas de API - Saldo
  router.use('/api/balance', createBalanceRoutes(orderServiceService));

  // Webhook do Evolution API
  router.use('/webhook', createWebhookRoutes(whatsappHandler));

  return router;
}
