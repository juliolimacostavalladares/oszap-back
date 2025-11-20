import { Router } from 'express';
import { BalanceController } from '../controllers/BalanceController.js';
import { OrderServiceService } from '../services/OrderServiceService.js';

/**
 * Rotas relacionadas a saldo
 */
export function createBalanceRoutes(orderServiceService: OrderServiceService): Router {
  const router = Router();
  const controller = new BalanceController(orderServiceService);

  // Consultar saldo (dia ou mês)
  router.get('/', controller.getBalance);

  return router;
}

