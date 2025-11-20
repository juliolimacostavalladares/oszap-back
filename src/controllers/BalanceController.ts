import { Request, Response } from 'express';
import { OrderServiceService } from '../services/OrderServiceService.js';
import type { BalanceQueryParams, BalanceResponse } from '../types/index.js';

/**
 * Controller para endpoints de saldo
 */
export class BalanceController {
  constructor(private orderServiceService: OrderServiceService) {}

  /**
   * Consulta saldo (dia ou mês)
   */
  getBalance = async (req: Request<{}, BalanceResponse, {}, BalanceQueryParams>, res: Response<BalanceResponse>): Promise<void> => {
    try {
      const { period = 'day' } = req.query;

      let balance: number;
      if (period === 'month') {
        balance = await this.orderServiceService.getMonthBalance();
      } else {
        balance = await this.orderServiceService.getDayBalance();
      }

      res.json({ success: true, balance });
    } catch (error: any) {
      console.error('Erro ao consultar saldo:', error);
      res.status(500).json({ success: false, balance: 0 });
    }
  };
}

