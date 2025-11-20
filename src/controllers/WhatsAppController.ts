import { Request, Response } from 'express';
import EvolutionService from '../services/EvolutionService.js';
import type { EvolutionSendMessageResponse, ApiResponse } from '../types/index.js';

/**
 * Controller para endpoints relacionados ao WhatsApp
 */
export class WhatsAppController {
  constructor(private evolutionService: typeof EvolutionService) {}

  /**
   * Envia mensagem de teste
   */
  sendMessage = async (req: Request<{}, ApiResponse<EvolutionSendMessageResponse>, { number: string; message: string }>, res: Response<ApiResponse<EvolutionSendMessageResponse>>): Promise<void> => {
    try {
      const { number, message } = req.body;

      if (!number || !message) {
        res.status(400).json({ success: false, error: 'Número e mensagem são obrigatórios' });
        return;
      }

      const result = await this.evolutionService.sendTextMessage(number, message);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /**
   * Diagnóstico da configuração
   */
  getDiagnostics = async (_req: Request, res: Response): Promise<void> => {
    try {
      const apiKey = process.env.EVOLUTION_API_KEY || process.env.AUTHENTICATION_API_KEY || '';
      const baseURL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
      const instanceName = process.env.INSTANCE_NAME || 'OSZap';
      
      const diagnostics = {
        apiKeyConfigured: !!apiKey,
        apiKeyLength: apiKey.length,
        baseURL,
        instanceName,
        message: apiKey 
          ? 'API Key configurada' 
          : '⚠️ API Key NÃO configurada! Configure EVOLUTION_API_KEY ou AUTHENTICATION_API_KEY no .env'
      };

      res.json({ success: true, data: diagnostics });
    } catch (error: any) {
      console.error('Erro ao obter diagnósticos:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };
}

