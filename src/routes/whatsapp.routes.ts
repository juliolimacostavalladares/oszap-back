import { Router } from 'express';
import { WhatsAppController } from '../controllers/WhatsAppController.js';
import EvolutionService from '../services/EvolutionService.js';

/**
 * Rotas relacionadas ao WhatsApp
 */
export function createWhatsAppRoutes(): Router {
  const router = Router();
  const controller = new WhatsAppController(EvolutionService);

  // Enviar mensagem de teste
  router.post('/send-message', controller.sendMessage);

  // Diagnóstico rápido da configuração Evolution
  router.get('/instance/diagnostics', controller.getDiagnostics);

  return router;
}

