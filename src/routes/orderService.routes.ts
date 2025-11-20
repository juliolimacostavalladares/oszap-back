import { Router } from 'express';
import { OrderServiceController } from '../controllers/OrderServiceController.js';
import { OrderServiceService } from '../services/OrderServiceService.js';

/**
 * Rotas relacionadas a Ordens de Serviço
 */
export function createOrderServiceRoutes(orderServiceService: OrderServiceService): Router {
  const router = Router();
  const controller = new OrderServiceController(orderServiceService);

  // Listar todas as OSs
  router.get('/', controller.list);

  // Buscar OS por ID
  router.get('/:id', controller.getById);

  // Criar nova OS
  router.post('/', controller.create);

  // Atualizar status da OS
  router.patch('/:id/status', controller.updateStatus);

  return router;
}

