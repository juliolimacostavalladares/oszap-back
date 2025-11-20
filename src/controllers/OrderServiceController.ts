import { Request, Response } from 'express';
import { OrderServiceService } from '../services/OrderServiceService.js';
import type { CreateOSDTO, OSQueryParams, UpdateOSStatusDTO, ApiResponse, OrderService } from '../types/index.js';

/**
 * Controller para endpoints de Ordens de Serviço
 * Responsável por lidar com requisições HTTP e respostas
 */
export class OrderServiceController {
  constructor(private orderServiceService: OrderServiceService) {}

  /**
   * Lista todas as OSs
   */
  list = async (req: Request<{}, ApiResponse<OrderService[]>, {}, OSQueryParams>, res: Response<ApiResponse<OrderService[]>>): Promise<void> => {
    try {
      const { status, limit, offset } = req.query;
      
      const osList = await this.orderServiceService.listOS({
        status,
        limit: limit ? parseInt(limit.toString()) : undefined,
        offset: offset ? parseInt(offset.toString()) : undefined
      });

      res.json({ success: true, data: osList });
    } catch (error: any) {
      console.error('Erro ao listar OSs:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /**
   * Busca OS por ID
   */
  getById = async (req: Request<{ id: string }>, res: Response<ApiResponse<OrderService>>): Promise<void> => {
    try {
      const { id } = req.params;
      const os = await this.orderServiceService.getOSById(parseInt(id));

      if (!os) {
        res.status(404).json({ success: false, error: 'OS não encontrada' });
        return;
      }

      res.json({ success: true, data: os });
    } catch (error: any) {
      console.error('Erro ao buscar OS:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /**
   * Cria uma nova OS
   */
  create = async (req: Request<{}, ApiResponse<OrderService>, CreateOSDTO>, res: Response<ApiResponse<OrderService>>): Promise<void> => {
    try {
      const { client_name, client_phone, services, total_amount, notes, status } = req.body;

      if (!client_name || !total_amount) {
        res.status(400).json({ success: false, error: 'client_name e total_amount são obrigatórios' });
        return;
      }

      const { os } = await this.orderServiceService.createOS({
        client_name,
        client_phone,
        services: Array.isArray(services) ? services : [services],
        total_amount: parseFloat(total_amount.toString()),
        notes,
        status: status || 'pendente'
      });

      res.status(201).json({ success: true, data: os });
    } catch (error: any) {
      console.error('Erro ao criar OS:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /**
   * Atualiza status da OS
   */
  updateStatus = async (req: Request<{ id: string }, ApiResponse<OrderService>, UpdateOSStatusDTO>, res: Response<ApiResponse<OrderService>>): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        res.status(400).json({ success: false, error: 'status é obrigatório' });
        return;
      }

      const os = await this.orderServiceService.updateStatus(parseInt(id), status);
      
      if (!os) {
        res.status(404).json({ success: false, error: 'OS não encontrada' });
        return;
      }

      res.json({ success: true, data: os });
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };
}

